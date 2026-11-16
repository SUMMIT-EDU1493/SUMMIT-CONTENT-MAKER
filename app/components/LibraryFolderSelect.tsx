"use client";

import { useEffect, useState } from "react";

type Folder = { id: string; parentId: string | null; name: string; sort: number; itemCount: number };

/** Full "모의고사 / 고2 / 2026년 9월" paths in tree order. */
export function folderPaths(folders: Folder[]): Array<{ id: string; path: string; depth: number }> {
  const children = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const list = children.get(folder.parentId) || [];
    list.push(folder);
    children.set(folder.parentId, list);
  }
  const out: Array<{ id: string; path: string; depth: number }> = [];
  const walk = (parentId: string | null, prefix: string, depth: number) => {
    for (const folder of (children.get(parentId) || []).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "ko"))) {
      const path = prefix ? `${prefix} / ${folder.name}` : folder.name;
      out.push({ id: folder.id, path, depth });
      walk(folder.id, path, depth + 1);
    }
  };
  walk(null, "", 0);
  return out;
}

/**
 * Pick the library folder that new pages are saved to. The choice is remembered per page.
 * Shows a login hint when the library needs the admin login.
 */
export default function LibraryFolderSelect({ storageKey, value, onChange, note }: {
  storageKey: string; value: string; onChange: (id: string) => void; note?: string;
}) {
  const [options, setOptions] = useState<Array<{ id: string; path: string; depth: number }>>([]);
  const [state, setState] = useState<"loading" | "ready" | "login" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/library/folders", { cache: "no-store" });
        if (cancelled) return;
        if (response.status === 401) return setState("login");
        const data = await response.json();
        if (!response.ok) throw new Error(data?.detail || data?.error);
        const paths = folderPaths(data.folders || []);
        setOptions(paths);
        setState("ready");
        let saved = "";
        try { saved = window.localStorage.getItem(storageKey) || ""; } catch { /* storage unavailable */ }
        if (saved && paths.some(p => p.id === saved)) onChange(saved);
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; };
    // onChange is a state setter from the parent; load once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const choose = (id: string) => {
    onChange(id);
    try { window.localStorage.setItem(storageKey, id); } catch { /* storage unavailable */ }
  };

  return (
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black text-slate-900">보관함에 저장</h2>
        <a href="/library" target="_blank" rel="noreferrer"
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:border-emerald-300 hover:bg-emerald-50">
          보관함 열기 ↗
        </a>
      </div>
      {state === "loading" && <p className="mt-3 text-sm text-slate-500">보관함 폴더를 불러오는 중…</p>}
      {state === "login" && (
        <p className="mt-3 text-sm text-slate-600">
          보관함은 관리자 로그인 후 쓸 수 있어요. <a href="/library" className="font-black text-emerald-700 underline">보관함</a>에서 로그인한 뒤 이 페이지를 새로고침해 주세요.
        </p>
      )}
      {state === "error" && <p className="mt-3 text-sm text-rose-600">보관함 폴더를 불러오지 못했어요. 새로고침해 주세요.</p>}
      {state === "ready" && (
        <>
          <select value={value} onChange={e => choose(e.target.value)}
            className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-800">
            <option value="">저장 안 함</option>
            {options.map(option => (
              <option key={option.id} value={option.id}>{option.path}</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            폴더를 고르면 이미지를 만들 때마다 자동으로 저장돼요. 같은 지문을 다시 만들면 최신 이미지로 바뀌어요.
          </p>
          {note && <p className="mt-2 text-sm font-bold text-emerald-700">{note}</p>}
        </>
      )}
    </section>
  );
}
