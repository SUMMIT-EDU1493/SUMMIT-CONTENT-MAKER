"use client";

import { useEffect, useMemo, useState } from "react";
import HomeButton from "../components/HomeButton";

type SavedPassage = {
  id: string;
  title: string;
  source: string;
  createdAt: string;
};

type ExtractedPassage = {
  id: string;
  title: string;
  source: string;
};

const QUESTION_TYPES = [
  "주제·제목",
  "내용 일치·불일치",
  "빈칸 추론",
  "어휘",
  "어법",
  "요약문 완성",
  "문장 삽입",
  "글의 순서",
  "서술형",
  "학교시험형 종합",
];

const COLORS = [
  { name: "민트", value: "#8FE7C1" },
  { name: "레몬", value: "#F6E77A" },
  { name: "블루", value: "#A9D8FF" },
  { name: "라벤더", value: "#D9C6FF" },
  { name: "코랄", value: "#FFB7A6" },
  { name: "그레이", value: "#CBD5E1" },
];

const DIFFICULTIES = ["기본", "중상", "고난도"];

const STORAGE_KEY = "summit-english-passages";

function makePassageId(source: string) {
  const normalized = source
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  let hash = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }

  return `passage-${hash.toString(16)}`;
}

export default function EnglishTestMakerPage() {
  const [schoolName, setSchoolName] = useState("");
  const [gradeName, setGradeName] = useState("");
  const [rangeName, setRangeName] = useState("");

  const [savedPassages, setSavedPassages] = useState<SavedPassage[]>([]);
  const [selectedPassageIds, setSelectedPassageIds] = useState<string[]>([]);

  const [extractedPassages, setExtractedPassages] = useState<
    ExtractedPassage[]
  >([]);

  const [selectedExtractedIds, setSelectedExtractedIds] = useState<string[]>(
    []
  );

  const [pdfFileName, setPdfFileName] = useState("");
  const [readingPdf, setReadingPdf] = useState(false);
  const [analyzingPdf, setAnalyzingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");

  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "주제·제목",
    "내용 일치·불일치",
  ]);

  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({
    "주제·제목": 1,
    "내용 일치·불일치": 1,
  });

  const [difficulties, setDifficulties] = useState<string[]>(["기본"]);

  const [themeColor, setThemeColor] = useState(COLORS[0].value);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        setSavedPassages(parsed);
      }
    } catch {
      console.error("저장된 지문을 불러오지 못했습니다.");
    }
  }, []);

  const totalQuestions = useMemo(() => {
    return selectedTypes.reduce(
      (sum, type) => sum + (questionCounts[type] || 0),
      0
    );
  }, [selectedTypes, questionCounts]);

  const savePassageList = (passages: SavedPassage[]) => {
    setSavedPassages(passages);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(passages));
  };

  const toggleQuestionType = (type: string) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((item) => item !== type);
      }

      return [...prev, type];
    });

    setQuestionCounts((prev) => ({
      ...prev,
      [type]: prev[type] || 1,
    }));
  };

  const toggleSavedPassage = (id: string) => {
    setSelectedPassageIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }

      return [...prev, id];
    });
  };

  const toggleExtractedPassage = (id: string) => {
    setSelectedExtractedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }

      return [...prev, id];
    });
  };

  const toggleDifficulty = (difficulty: string) => {
    setDifficulties((prev) => {
      if (prev.includes(difficulty)) {
        if (prev.length === 1) {
          return prev;
        }

        return prev.filter((item) => item !== difficulty);
      }

      return [...prev, difficulty];
    });
  };

  const deleteSavedPassage = (id: string) => {
    const next = savedPassages.filter((item) => item.id !== id);

    savePassageList(next);

    setSelectedPassageIds((prev) =>
      prev.filter((selectedId) => selectedId !== id)
    );
  };

  const saveExtractedPassages = (onlySelected: boolean) => {
    const targets = onlySelected
      ? extractedPassages.filter((item) =>
          selectedExtractedIds.includes(item.id)
        )
      : extractedPassages;

    if (targets.length === 0) {
      alert("저장할 지문을 선택해 주세요.");
      return;
    }

    const existingIds = new Set(savedPassages.map((item) => item.id));

    const newItems: SavedPassage[] = [];

    for (const passage of targets) {
      const id = makePassageId(passage.source);

      if (existingIds.has(id)) {
        continue;
      }

      existingIds.add(id);

      newItems.push({
        id,
        title: passage.title,
        source: passage.source,
        createdAt: new Date().toISOString(),
      });
    }

    if (newItems.length === 0) {
      alert("선택한 지문은 이미 라이브러리에 저장되어 있습니다.");
      return;
    }

    const next = [...savedPassages, ...newItems];

    savePassageList(next);

    setSelectedPassageIds((prev) => [
      ...new Set([...prev, ...newItems.map((item) => item.id)]),
    ]);

    alert(`${newItems.length}개의 지문을 저장했습니다.`);
  };

  const extractPdfText = async (file: File) => {
    try {
      setReadingPdf(true);
      setAnalyzingPdf(false);
      setPdfStatus("PDF에서 텍스트를 읽고 있습니다...");
      setExtractedPassages([]);
      setSelectedExtractedIds([]);
      setPdfFileName(file.name);

      const pdfjs = await import("pdfjs-dist");

      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();

      const pdf = await pdfjs.getDocument({
        data: arrayBuffer,
      }).promise;

      let fullText = "";

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        setPdfStatus(
          `PDF 읽는 중... ${pageNumber} / ${pdf.numPages} 페이지`
        );

        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const pageText = content.items
          .map((item) => {
            if ("str" in item) {
              return item.str;
            }

            return "";
          })
          .join(" ");

        fullText += `\n\n--- PAGE ${pageNumber} ---\n\n${pageText}`;
      }

      if (!fullText.trim()) {
        throw new Error("PDF에서 텍스트를 추출하지 못했습니다.");
      }

      setReadingPdf(false);
      setAnalyzingPdf(true);
      setPdfStatus("AI가 영어 지문을 찾아 분리하고 있습니다...");

      const response = await fetch("/api/english-test-passages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceText: fullText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "영어 지문 분석 중 오류가 발생했습니다."
        );
      }

      const passages: ExtractedPassage[] = Array.isArray(data?.passages)
        ? data.passages.map(
            (
              item: {
                title?: string;
                source?: string;
              },
              index: number
            ) => ({
              id: `extracted-${Date.now()}-${index}`,
              title: item.title || `Passage ${index + 1}`,
              source: item.source || "",
            })
          )
        : [];

      if (passages.length === 0) {
        throw new Error("사용 가능한 영어 지문을 찾지 못했습니다.");
      }

      setExtractedPassages(passages);
      setSelectedExtractedIds(passages.map((item) => item.id));

      setPdfStatus(
        `${passages.length}개의 영어 지문을 찾았습니다. 저장할 지문을 확인해 주세요.`
      );
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "PDF 분석 중 오류가 발생했습니다.";

      setPdfStatus(message);
      alert(message);
    } finally {
      setReadingPdf(false);
      setAnalyzingPdf(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <HomeButton />

          <div className="rounded-full bg-sky-100 px-4 py-2 text-xs font-black tracking-[0.16em] text-sky-700">
            ENG MOCK TEST LAB
          </div>
        </div>

        <section className="mt-8">
          <p className="text-sm font-black tracking-[0.18em] text-sky-600">
            SUMMIT VISUAL LAB
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            고등영어 변형문제 제작
          </h1>

          <p className="mt-3 text-base font-medium text-slate-600">
            교재 PDF를 분석해 원하는 유형의 모의고사·내신형 변형문제를
            제작합니다.
          </p>
        </section>

        {/* 1 */}
        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-slate-900">1. 기본정보</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label>
              <span className="text-sm font-bold text-slate-700">학교명</span>

              <input
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="예) 써밋고"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 placeholder:text-slate-400"
              />
            </label>

            <label>
              <span className="text-sm font-bold text-slate-700">학년</span>

              <input
                value={gradeName}
                onChange={(e) => setGradeName(e.target.value)}
                placeholder="예) 고 2"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 placeholder:text-slate-400"
              />
            </label>

            <label>
              <span className="text-sm font-bold text-slate-700">
                시험 범위
              </span>

              <input
                value={rangeName}
                onChange={(e) => setRangeName(e.target.value)}
                placeholder="예) Extra Reading Ⅰ & Ⅱ"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 placeholder:text-slate-400"
              />
            </label>
          </div>
        </section>

        {/* 2 */}
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                2. 지문 라이브러리
              </h2>

              <p className="mt-2 text-sm font-medium text-slate-500">
                한 번 저장한 지문은 다음 제작에서도 다시 사용할 수 있습니다.
              </p>
            </div>

            <label
              className={`inline-flex cursor-pointer rounded-2xl px-5 py-3 font-black text-white shadow-sm transition ${
                readingPdf || analyzingPdf
                  ? "bg-slate-400"
                  : "bg-sky-600 hover:bg-sky-700"
              }`}
            >
              {readingPdf || analyzingPdf ? "분석 중..." : "PDF 업로드"}

              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={readingPdf || analyzingPdf}
                onChange={(e) => {
                  const file = e.target.files?.[0];

                  if (file) {
                    extractPdfText(file);
                  }

                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {pdfFileName && (
            <div className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-sm font-bold text-sky-700">
              {pdfFileName}
            </div>
          )}

          {pdfStatus && (
            <div className="mt-3 text-sm font-bold text-slate-600">
              {pdfStatus}
            </div>
          )}

          {/* 분석된 새 지문 */}
          {extractedPassages.length > 0 && (
            <div className="mt-6 rounded-3xl border border-sky-200 bg-sky-50/50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    PDF에서 찾은 지문
                  </h3>

                  <p className="mt-1 text-sm font-medium text-slate-500">
                    저장하지 않을 지문은 체크를 해제할 수 있습니다.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedExtractedIds(
                        extractedPassages.map((item) => item.id)
                      )
                    }
                    className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm"
                  >
                    전체 선택
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedExtractedIds([])}
                    className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm"
                  >
                    전체 해제
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {extractedPassages.map((passage, index) => {
                  const selected = selectedExtractedIds.includes(passage.id);

                  return (
                    <button
                      key={passage.id}
                      type="button"
                      onClick={() => toggleExtractedPassage(passage.id)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-sky-400 bg-white"
                          : "border-slate-200 bg-slate-50 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm font-black ${
                            selected
                              ? "border-sky-600 bg-sky-600 text-white"
                              : "border-slate-300 bg-white text-transparent"
                          }`}
                        >
                          ✓
                        </div>

                        <div className="min-w-0">
                          <p className="font-black text-slate-900">
                            {index + 1}. {passage.title}
                          </p>

                          <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-500">
                            {passage.source}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => saveExtractedPassages(true)}
                  className="rounded-2xl bg-sky-600 px-5 py-3 font-black text-white hover:bg-sky-700"
                >
                  선택한 지문 저장
                </button>

                <button
                  type="button"
                  onClick={() => saveExtractedPassages(false)}
                  className="rounded-2xl bg-slate-900 px-5 py-3 font-black text-white hover:bg-slate-800"
                >
                  전체 지문 저장
                </button>
              </div>
            </div>
          )}

          {/* 저장된 라이브러리 */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-black text-slate-900">저장된 지문</h3>

              <span className="text-sm font-bold text-slate-400">
                {savedPassages.length}개
              </span>
            </div>

            {savedPassages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm font-bold text-slate-400">
                아직 저장된 지문이 없습니다.
              </div>
            ) : (
              <div className="grid gap-3">
                {savedPassages.map((passage) => {
                  const selected = selectedPassageIds.includes(passage.id);

                  return (
                    <div
                      key={passage.id}
                      className={`rounded-2xl border p-4 ${
                        selected
                          ? "border-sky-400 bg-sky-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <button
                          type="button"
                          onClick={() => toggleSavedPassage(passage.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm font-black ${
                                selected
                                  ? "border-sky-600 bg-sky-600 text-white"
                                  : "border-slate-300 bg-white text-transparent"
                              }`}
                            >
                              ✓
                            </div>

                            <div className="min-w-0">
                              <p className="font-black text-slate-900">
                                {passage.title}
                              </p>

                              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
                                {passage.source}
                              </p>
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteSavedPassage(passage.id)}
                          className="shrink-0 rounded-full bg-red-50 px-3 py-2 text-xs font-black text-red-500 transition hover:bg-red-100"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* 3 */}
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-slate-900">
            3. 문제 유형 선택
          </h2>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {QUESTION_TYPES.map((type) => {
              const checked = selectedTypes.includes(type);

              return (
                <div
                  key={type}
                  className={`flex items-center justify-between rounded-2xl border p-4 ${
                    checked
                      ? "border-sky-300 bg-sky-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleQuestionType(type)}
                      className="h-5 w-5"
                    />

                    <span className="font-bold text-slate-800">{type}</span>
                  </label>

                  {checked && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setQuestionCounts((prev) => ({
                            ...prev,
                            [type]: Math.max(1, (prev[type] || 1) - 1),
                          }))
                        }
                        className="h-8 w-8 rounded-full bg-white font-black shadow-sm"
                      >
                        −
                      </button>

                      <span className="min-w-6 text-center font-black">
                        {questionCounts[type] || 1}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setQuestionCounts((prev) => ({
                            ...prev,
                            [type]: Math.min(10, (prev[type] || 1) + 1),
                          }))
                        }
                        className="h-8 w-8 rounded-full bg-white font-black shadow-sm"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl bg-slate-900 px-5 py-4 text-white">
            <span className="text-sm font-bold text-slate-300">
              총 문항 수
            </span>

            <strong className="ml-3 text-2xl">{totalQuestions}문항</strong>
          </div>
        </section>

        {/* 4 + 5 */}
        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-900">4. 난이도</h2>

            <p className="mt-2 text-sm font-medium text-slate-500">
              여러 난이도를 선택하면 선택한 수준을 섞어 출제합니다.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {DIFFICULTIES.map((item) => {
                const checked = difficulties.includes(item);

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleDifficulty(item)}
                    className={`rounded-2xl px-4 py-3 font-black transition ${
                      checked
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {checked ? "✓ " : ""}
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-900">
              5. THEME COLOR
            </h2>

            <p className="mt-2 text-sm font-medium text-slate-500">
              시험지 제목, 문항 태그, 지문 테두리 등에 적용됩니다.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              {COLORS.map((color) => {
                const selected = themeColor === color.value;

                return (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setThemeColor(color.value)}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black ${
                      selected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    <span
                      className="h-5 w-5 rounded-full border border-black/10"
                      style={{
                        backgroundColor: color.value,
                      }}
                    />

                    {color.name}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 6 */}
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-slate-900">6. 문제 제작</h2>

          <div className="mt-5 grid gap-3 text-sm font-bold text-slate-600 md:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              선택 지문
              <strong className="mt-1 block text-xl text-slate-900">
                {selectedPassageIds.length}
              </strong>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              문제 유형
              <strong className="mt-1 block text-xl text-slate-900">
                {selectedTypes.length}
              </strong>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              총 문항
              <strong className="mt-1 block text-xl text-slate-900">
                {totalQuestions}
              </strong>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              난이도
              <strong className="mt-1 block text-lg text-slate-900">
                {difficulties.join(" · ")}
              </strong>
            </div>
          </div>

          <button
            type="button"
            disabled={
              selectedPassageIds.length === 0 ||
              selectedTypes.length === 0 ||
              totalQuestions === 0
            }
            onClick={() => {
              alert("다음 단계에서 AI 문제 생성 기능을 연결합니다.");
            }}
            className="mt-6 w-full rounded-2xl bg-sky-600 px-6 py-4 text-lg font-black text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            선택한 유형으로 변형문제 만들기
          </button>
        </section>
      </div>
    </main>
  );
}