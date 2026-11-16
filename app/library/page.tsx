"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import HomeButton from "../components/HomeButton";
import { putDraft } from "../lib/autosave";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type Folder = { id: string; parentId: string | null; name: string; sort: number; itemCount: number };
type Item = { id: string; folderId: string; title: string; subtitle: string; sourceRange: string; imageUrl: string; updatedAt: string };
type Picked = { id: string; title: string; subtitle: string; folderName: string };
type ImportPage = { number: number; image: string; checked: boolean };

async function api(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) throw Object.assign(new Error("login"), { login: true });
  if (!response.ok) throw new Error(data?.detail || data?.error || `요청 실패 (HTTP ${response.status})`);
  return data;
}

export default function LibraryPage() {
  const [needsLogin, setNeedsLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [currentId, setCurrentId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Item | null>(null);
  const [importName, setImportName] = useState("");
  const [importPages, setImportPages] = useState<ImportPage[]>([]);

  const fail = useCallback((error: unknown) => {
    if ((error as { login?: boolean })?.login) return setNeedsLogin(true);
    setMessage(error instanceof Error ? error.message : String(error));
  }, []);

  const loadFolders = useCallback(async () => {
    try {
      const data = await api("/api/library/folders");
      setFolders(data.folders || []);
      setNeedsLogin(false);
    } catch (error) { fail(error); }
  }, [fail]);

  const loadItems = useCallback(async (folderId: string) => {
    if (!folderId) return setItems([]);
    try { setItems((await api(`/api/library/items?folderId=${folderId}`)).items || []); } catch (error) { fail(error); }
  }, [fail]);

  useEffect(() => { void loadFolders(); }, [loadFolders]);
  useEffect(() => { void loadItems(currentId); setImportPages([]); }, [currentId, loadItems]);

  const children = useMemo(() => {
    const map = new Map<string | null, Folder[]>();
    for (const folder of folders) map.set(folder.parentId, [...(map.get(folder.parentId) || []), folder]);
    for (const list of map.values()) list.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "ko"));
    return map;
  }, [folders]);
  // Item counts include sub-folders so a closed folder still shows what is inside.
  const totals = useMemo(() => {
    const total = new Map<string, number>();
    const count = (folder: Folder): number => {
      const sum = folder.itemCount + (children.get(folder.id) || []).reduce((acc, child) => acc + count(child), 0);
      total.set(folder.id, sum);
      return sum;
    };
    (children.get(null) || []).forEach(count);
    return total;
  }, [children]);
  const current = folders.find(folder => folder.id === currentId);
  const pathOf = (id: string) => {
    const names: string[] = [];
    for (let f = folders.find(x => x.id === id); f; f = folders.find(x => x.id === f!.parentId)) names.unshift(f.name);
    return names.join(" / ");
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      setPassword("");
      await loadFolders();
    } catch (error) { setMessage(error instanceof Error && error.message !== "login" ? error.message : "비밀번호가 올바르지 않습니다."); }
  };

  const addFolder = async () => {
    const name = window.prompt(current ? `'${current.name}' 안에 만들 폴더 이름` : "새 최상위 폴더 이름");
    if (!name?.trim()) return;
    try {
      await api("/api/library/folders", { method: "POST", body: JSON.stringify({ parentId: currentId || null, name }) });
      if (currentId) setOpen(prev => new Set(prev).add(currentId));
      await loadFolders();
    } catch (error) { fail(error); }
  };
  const renameFolder = async () => {
    if (!current) return;
    const name = window.prompt("새 폴더 이름", current.name);
    if (!name?.trim() || name === current.name) return;
    try { await api("/api/library/folders", { method: "PATCH", body: JSON.stringify({ id: current.id, name }) }); await loadFolders(); }
    catch (error) { fail(error); }
  };
  const removeFolder = async () => {
    if (!current || !window.confirm(`'${current.name}' 폴더를 지울까요? (빈 폴더만 지울 수 있어요)`)) return;
    try { await api(`/api/library/folders?id=${current.id}`, { method: "DELETE" }); setCurrentId(current.parentId || ""); await loadFolders(); }
    catch (error) { fail(error); }
  };

  const togglePick = (item: Item) => setPicked(prev => prev.some(p => p.id === item.id)
    ? prev.filter(p => p.id !== item.id)
    : [...prev, { id: item.id, title: item.title, subtitle: item.subtitle, folderName: current?.name || "" }]);
  const pickAll = () => setPicked(prev => [...prev, ...items.filter(item => !prev.some(p => p.id === item.id))
    .map(item => ({ id: item.id, title: item.title, subtitle: item.subtitle, folderName: current?.name || "" }))]);

  const renameItem = async (item: Item) => {
    const title = window.prompt("새 이름", item.title);
    if (!title?.trim() || title === item.title) return;
    try { await api("/api/library/items", { method: "PATCH", body: JSON.stringify({ id: item.id, title }) }); await loadItems(currentId); }
    catch (error) { fail(error); }
  };
  const removeItem = async (item: Item) => {
    if (!window.confirm(`'${item.title || "이 자료"}'를 보관함에서 지울까요? 지우면 되돌릴 수 없어요.`)) return;
    try {
      await api(`/api/library/items?id=${item.id}`, { method: "DELETE" });
      setPicked(prev => prev.filter(p => p.id !== item.id));
      await Promise.all([loadItems(currentId), loadFolders()]);
    } catch (error) { fail(error); }
  };

  // Send the picked pages, in the order they were picked, to the four-cut page's work box.
  const sendToWorkbox = async () => {
    if (!picked.length) return;
    try {
      const work: Array<{ id: string; title: string; subtitle: string; image: string }> = [];
      for (const [i, item] of picked.entries()) {
        setBusy(`이미지 불러오는 중 ${i + 1} / ${picked.length}`);
        const data = await api(`/api/library/image?id=${item.id}`);
        work.push({ id: `library-${item.id}`, title: data.title || item.title, subtitle: data.subtitle || item.subtitle, image: data.image });
      }
      if (!(await putDraft("library:send", work))) throw new Error("브라우저 저장 공간을 쓸 수 없어요. 시크릿 창이 아닌지 확인해 주세요.");
      window.location.href = "/high-test";
    } catch (error) { fail(error); } finally { setBusy(""); }
  };

  // Recover earlier work: split a finished four-cut PDF into pages and save the chosen ones.
  const readPdf = async (file: File) => {
    try {
      setBusy("PDF 페이지를 읽는 중…");
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const pages: ImportPage[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        setBusy(`PDF 페이지를 읽는 중 ${n} / ${pdf.numPages}`);
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(3, 1700 / base.width) });
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvas, viewport }).promise;
        // The first and last pages are usually the covers.
        pages.push({ number: n, image: canvas.toDataURL("image/jpeg", 0.9), checked: n !== 1 && n !== pdf.numPages });
      }
      setImportName(file.name.replace(/\.pdf$/i, ""));
      setImportPages(pages);
    } catch (error) { fail(error); } finally { setBusy(""); }
  };
  const saveImported = async () => {
    const chosen = importPages.filter(page => page.checked);
    if (!currentId || !chosen.length) return;
    try {
      for (const [i, page] of chosen.entries()) {
        setBusy(`보관함에 저장하는 중 ${i + 1} / ${chosen.length}`);
        await api("/api/library/items", { method: "POST", body: JSON.stringify({
          folderId: currentId, image: page.image, title: `${importName} p.${page.number}`,
          itemKey: `${importName}#${page.number}`,
        }) });
      }
      setImportPages([]);
      setMessage(`${chosen.length}장을 '${current?.name}'에 저장했어요.`);
      await Promise.all([loadItems(currentId), loadFolders()]);
    } catch (error) { fail(error); } finally { setBusy(""); }
  };

  const renderTree = (parentId: string | null, depth: number) => (children.get(parentId) || []).map(folder => {
    const kids = children.get(folder.id) || [];
    const isOpen = open.has(folder.id);
    return (
      <div key={folder.id}>
        <div className={`flex items-center gap-1 rounded-lg py-1 pr-2 ${folder.id === currentId ? "bg-emerald-100" : "hover:bg-slate-100"}`}
          style={{ paddingLeft: 6 + depth * 14 }}>
          <button type="button" className="w-5 text-xs text-slate-500" aria-label={isOpen ? "접기" : "펼치기"}
            onClick={() => setOpen(prev => { const next = new Set(prev); if (next.has(folder.id)) next.delete(folder.id); else next.add(folder.id); return next; })}>
            {kids.length ? (isOpen ? "▾" : "▸") : ""}
          </button>
          <button type="button" className="flex-1 truncate text-left text-sm font-bold text-slate-800"
            onClick={() => { setCurrentId(folder.id); if (kids.length) setOpen(prev => new Set(prev).add(folder.id)); }}>
            {folder.name}
          </button>
          {(totals.get(folder.id) || 0) > 0 && <span className="text-xs font-black text-emerald-700">{totals.get(folder.id)}</span>}
        </div>
        {isOpen && renderTree(folder.id, depth + 1)}
      </div>
    );
  });

  if (needsLogin) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-md">
          <HomeButton />
          <form onSubmit={login} className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h1 className="text-2xl font-black text-slate-900">보관함 로그인</h1>
            <p className="mt-2 text-sm text-slate-600">관리자 비밀번호를 입력해 주세요. 한 번 로그인하면 7일 동안 유지돼요.</p>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3" placeholder="관리자 비밀번호" />
            <button className="mt-4 w-full rounded-xl bg-slate-900 py-3 font-black text-white">로그인</button>
            {message && <p className="mt-3 text-sm font-bold text-rose-600">{message}</p>}
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-7xl">
        <HomeButton />
        <p className="mt-6 text-sm font-bold text-emerald-600">LIBRARY</p>
        <h1 className="mt-1 text-4xl font-black text-slate-900">보관함</h1>
        <p className="mt-2 text-slate-600">만든 써밋네컷을 폴더별로 모아 두고, 필요한 것만 골라 한 권으로 묶어요.</p>

        {message && (
          <div className="mt-5 flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} className="text-emerald-600">닫기</button>
          </div>
        )}
        {busy && <div className="mt-5 rounded-2xl bg-slate-900 p-4 text-sm font-bold text-white">{busy}</div>}

        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-6 lg:max-h-[85vh] lg:overflow-auto">
            <div className="mb-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void addFolder()} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-black text-white">+ 새 폴더</button>
              <button type="button" disabled={!current} onClick={() => void renameFolder()} className="rounded-full border px-3 py-1.5 text-xs font-black disabled:opacity-40">이름 바꾸기</button>
              <button type="button" disabled={!current} onClick={() => void removeFolder()} className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-black text-rose-600 disabled:opacity-40">폴더 삭제</button>
            </div>
            <p className="mb-2 text-xs text-slate-500">새 폴더는 지금 선택한 폴더 안에 만들어져요.</p>
            {renderTree(null, 0)}
          </aside>

          <section className="min-w-0">
            {picked.length > 0 && (
              <div className="mb-5 rounded-3xl bg-slate-900 p-5 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-black">선택한 {picked.length}장 · 고른 순서대로 PDF에 들어가요</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPicked([])} className="rounded-full border border-white/40 px-4 py-2 text-sm font-black">선택 비우기</button>
                    <button type="button" disabled={Boolean(busy)} onClick={() => void sendToWorkbox()}
                      className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-white hover:bg-emerald-400 disabled:opacity-50">
                      써밋네컷 작업함으로 보내기 →
                    </button>
                  </div>
                </div>
                <ol className="mt-3 flex flex-wrap gap-2 text-xs">
                  {picked.map((p, i) => <li key={p.id} className="rounded-full bg-white/10 px-3 py-1">{i + 1}. {p.folderName} · {p.title}</li>)}
                </ol>
              </div>
            )}

            {!current ? (
              <div className="rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">왼쪽에서 폴더를 고르세요.</div>
            ) : (
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500">{pathOf(current.id)}</p>
                    <h2 className="text-2xl font-black text-slate-900">{current.name} <span className="text-base text-slate-400">{items.length}장</span></h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.length > 0 && <button type="button" onClick={pickAll} className="rounded-full border px-4 py-2 text-sm font-black">이 폴더 전체 선택</button>}
                    <label className="cursor-pointer rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800">
                      예전 PDF에서 가져오기
                      <input type="file" accept=".pdf,application/pdf" className="hidden"
                        onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void readPdf(file); }} />
                    </label>
                  </div>
                </div>

                {importPages.length > 0 && (
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="font-black text-emerald-900">{importName} · 저장할 페이지를 고르세요 (앞·뒤 표지는 빼 두었어요)</p>
                    <div className="mt-3 grid grid-cols-3 gap-3 md:grid-cols-5">
                      {importPages.map(page => (
                        <label key={page.number} className={`cursor-pointer rounded-xl border-2 bg-white p-1 ${page.checked ? "border-emerald-500" : "border-transparent opacity-60"}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={page.image} alt={`${page.number}쪽`} className="w-full rounded-lg" />
                          <span className="mt-1 flex items-center gap-1 text-xs font-bold">
                            <input type="checkbox" checked={page.checked}
                              onChange={() => setImportPages(prev => prev.map(p => p.number === page.number ? { ...p, checked: !p.checked } : p))} />
                            {page.number}쪽
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" disabled={Boolean(busy)} onClick={() => void saveImported()}
                        className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
                        {importPages.filter(p => p.checked).length}장 저장하기
                      </button>
                      <button type="button" onClick={() => setImportPages([])} className="rounded-full border px-4 py-2 text-sm font-black">취소</button>
                    </div>
                  </div>
                )}

                {items.length === 0 ? (
                  <p className="mt-8 text-center text-slate-500">아직 저장된 자료가 없어요.</p>
                ) : (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map(item => {
                      const order = picked.findIndex(p => p.id === item.id);
                      return (
                        <div key={item.id} className={`rounded-2xl border-2 p-2 ${order >= 0 ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>
                          <button type="button" onClick={() => setPreview(item)} className="relative block w-full">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.imageUrl} alt={item.title} loading="lazy" className="w-full rounded-xl" />
                            {order >= 0 && <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-black text-white">{order + 1}</span>}
                          </button>
                          <p className="mt-2 truncate text-sm font-black text-slate-900">{item.title || "(제목 없음)"}</p>
                          <p className="truncate text-xs text-slate-500">{item.subtitle || item.sourceRange}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button type="button" onClick={() => togglePick(item)}
                              className={`rounded-full px-3 py-1 text-xs font-black ${order >= 0 ? "bg-emerald-600 text-white" : "border border-emerald-300 text-emerald-800"}`}>
                              {order >= 0 ? "선택됨" : "선택"}
                            </button>
                            <button type="button" onClick={() => void renameItem(item)} className="rounded-full border px-3 py-1 text-xs font-black">이름</button>
                            <button type="button" onClick={() => void removeItem(item)} className="rounded-full border border-rose-200 px-3 py-1 text-xs font-black text-rose-600">삭제</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {preview && (
        <button type="button" onClick={() => setPreview(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.imageUrl} alt={preview.title} className="max-h-full max-w-full rounded-xl bg-white" />
        </button>
      )}
    </main>
  );
}
