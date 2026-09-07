"use client";

import { useState } from "react";
import HomeButton from "../components/HomeButton";

type Passage = {
  id: string;
  title: string;
  source: string;
};

type SummaryFlow = {
  label: string;
  content: string;
};

type SummaryConcept = {
  name: string;
  description: string;
};

type SummaryResult = {
  passageId: string;
  title: string;
  oneLine: string;

  visualPrompt?: string;
  visualImage?: string;

  flow: SummaryFlow[];
  concepts: SummaryConcept[];

  comparisonTitle: string;
  comparisonHeaders: string[];
  comparisonRows: string[][];

  testPoints: string[];
  caution: string;
};

export default function KoreanSummaryPage() {
  const [fileName, setFileName] = useState("");
  const [extracting, setExtracting] = useState(false);

  const [passages, setPassages] = useState<Passage[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<SummaryResult[]>([]);

  const extractPdf = async (file: File) => {
    try {
      setExtracting(true);
      setFileName(file.name);
      setPassages([]);
      setSelectedIds([]);
      setResults([]);

      const pdfjs = await import("pdfjs-dist");

      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

      const buffer = await file.arrayBuffer();

      const pdf = await pdfjs.getDocument({
        data: buffer,
      }).promise;

      let sourceText = "";

      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();

        const pageText = content.items
          .map((item: any) => item.str || "")
          .join(" ");

        sourceText += `\n\n[PAGE ${pageNo}]\n${pageText}`;
      }

      const response = await fetch("/api/korean-summary-passages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "국어 지문을 분리하지 못했습니다."
        );
      }

      const nextPassages: Passage[] = Array.isArray(data?.passages)
        ? data.passages
        : [];

      setPassages(nextPassages);

      setSelectedIds(
        nextPassages.slice(0, 2).map((item) => item.id)
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "PDF 분석 중 오류가 발생했습니다.";

      alert(message);
    } finally {
      setExtracting(false);
    }
  };

  const togglePassage = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const selectAllPassages = () => {
    setSelectedIds(passages.map((item) => item.id));
  };

  const clearAllPassages = () => {
    setSelectedIds([]);
  };

  const makeSummary = async () => {
    const selectedPassages = passages.filter((passage) =>
      selectedIds.includes(passage.id)
    );

    if (selectedPassages.length === 0) {
      alert("요약할 지문을 선택해 주세요.");
      return;
    }

    try {
      setGenerating(true);
      setResults([]);

      const response = await fetch("/api/korean-summary-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          passages: selectedPassages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "요약.ZIP 생성 중 오류가 발생했습니다."
        );
      }

      const summaries: SummaryResult[] = Array.isArray(data?.summaries)
        ? data.summaries
        : [];

      // 먼저 텍스트 요약 결과부터 보여줌
      setResults(summaries);

      // 각 지문별 일러스트를 동시에 생성
      const withImages = await Promise.all(
        summaries.map(async (summary) => {
          if (!summary.visualPrompt) {
            return summary;
          }

          try {
            const imageResponse = await fetch(
              "/api/korean-summary-visual",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
               body: JSON.stringify({
  title: summary.title,
  oneLine: summary.oneLine,
  visualPrompt: summary.visualPrompt,
  flow: summary.flow,
  concepts: summary.concepts,
  comparisonTitle: summary.comparisonTitle,
  comparisonHeaders: summary.comparisonHeaders,
  comparisonRows: summary.comparisonRows,
  testPoints: summary.testPoints,
  caution: summary.caution,
}),
              }
            );

            const imageData = await imageResponse.json();

            if (!imageResponse.ok || !imageData?.imageUrl) {
              return summary;
            }

            return {
              ...summary,
              visualImage: imageData.imageUrl,
            };
          } catch (error) {
            console.error(
              "Summary illustration error:",
              error
            );

            return summary;
          }
        })
      );

      setResults(withImages);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "요약.ZIP 생성 중 오류가 발생했습니다.";

      alert(message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <HomeButton />

            <button
              type="button"
              onClick={() => {
                window.location.href = "/korean-test-maker";
              }}
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              ← 국어 메뉴로
            </button>
          </div>

          <div className="rounded-full bg-violet-100 px-4 py-2 text-xs font-black tracking-[0.16em] text-violet-700">
            KOR SUMMARY LAB
          </div>
        </div>

        <section className="mt-8 rounded-[32px] bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black tracking-[0.18em] text-violet-600">
            SUMMIT VISUAL LAB
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            국어 요약.ZIP
          </h1>

          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-500">
            긴 국어 지문을 비주얼 학습자료로 정리합니다.
            글의 흐름, 핵심 개념, 비교 구조, 시험 포인트와 함께
            핵심 내용을 한눈에 볼 수 있는 일러스트를 생성합니다.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700">
              글의 흐름
            </span>

            <span className="rounded-full bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700">
              핵심 개념
            </span>

            <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
              비교 정리
            </span>

            <span className="rounded-full bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700">
              시험 POINT
            </span>

            <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
              비주얼 요약
            </span>
          </div>
        </section>

        <section className="mt-8 rounded-[32px] bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black tracking-[0.16em] text-violet-600">
                STEP 01
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-900">
                PDF 업로드
              </h2>
            </div>

            {fileName && (
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
                {fileName}
              </div>
            )}
          </div>

          <label className="mt-6 flex cursor-pointer items-center justify-center rounded-[28px] border-2 border-dashed border-violet-200 bg-violet-50 px-6 py-12 text-center transition hover:bg-violet-100">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];

                if (file) {
                  extractPdf(file);
                }
              }}
            />

            <div>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-sm">
                📄
              </div>

              <p className="mt-4 text-xl font-black text-violet-700">
                {extracting
                  ? "지문 분석 중..."
                  : "국어 PDF 업로드"}
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                PDF에서 비문학 지문을 자동 분리합니다.
              </p>
            </div>
          </label>
        </section>

        {passages.length > 0 && (
          <section className="mt-8 rounded-[32px] bg-white p-7 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black tracking-[0.16em] text-violet-600">
                  STEP 02
                </p>

                <h2 className="mt-1 text-2xl font-black text-slate-900">
                  요약할 지문 선택
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllPassages}
                  className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-black text-violet-700"
                >
                  전체 선택
                </button>

                <button
                  type="button"
                  onClick={clearAllPassages}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600"
                >
                  전체 해제
                </button>

                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                  {selectedIds.length}개 선택
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {passages.map((passage, index) => {
                const selected = selectedIds.includes(
                  passage.id
                );

                return (
                  <button
                    key={passage.id}
                    type="button"
                    onClick={() =>
                      togglePassage(passage.id)
                    }
                    className={`rounded-[24px] border p-5 text-left transition ${
                      selected
                        ? "border-violet-400 bg-violet-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-violet-200"
                    }`}
                  >
                    <div className="flex gap-4">
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                          selected
                            ? "bg-violet-600 text-white"
                            : "border border-slate-300 bg-white text-slate-400"
                        }`}
                      >
                        {selected ? "✓" : index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-black text-slate-900">
                          {passage.title}
                        </h3>

                        <p className="mt-3 text-sm leading-7 text-slate-500">
                          {passage.source.length > 340
                            ? `${passage.source.slice(
                                0,
                                340
                              )}...`
                            : passage.source}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={makeSummary}
              disabled={
                generating ||
                selectedIds.length === 0
              }
              className="mt-7 w-full rounded-[22px] bg-violet-600 px-6 py-4 text-lg font-black text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-40"
            >
              {generating
                ? "요약 + 일러스트 생성 중..."
                : "선택 지문으로 비주얼 요약.ZIP 만들기"}
            </button>
          </section>
        )}

        {results.length > 0 && (
          <section className="mt-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black tracking-[0.16em] text-violet-600">
                  STEP 03
                </p>

                <h2 className="mt-1 text-3xl font-black text-slate-900">
                  비주얼 요약.ZIP 결과
                </h2>
              </div>

              <div className="rounded-full bg-violet-100 px-4 py-2 text-sm font-black text-violet-700">
                총 {results.length}개 생성
              </div>
            </div>

            <div className="grid gap-8">
              {results.map((result, index) => {
                const hasComparison =
                  (result.comparisonHeaders?.length ||
                    0) > 0 &&
                  (result.comparisonRows?.length ||
                    0) > 0;

                return (
                  <article
                    key={`${result.passageId}-${index}`}
                    className="overflow-hidden rounded-[36px] bg-white shadow-sm ring-1 ring-slate-200"
                  >
                    <div className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 px-7 py-6 text-white">
                      <p className="text-xs font-black tracking-[0.18em] text-white/80">
                        SUMMARY.ZIP{" "}
                        {String(index + 1).padStart(
                          2,
                          "0"
                        )}
                      </p>

                      <h3 className="mt-2 text-3xl font-black leading-tight md:text-4xl">
                        {result.title}
                      </h3>

                      <p className="mt-4 rounded-[22px] bg-white/15 px-5 py-4 text-base font-bold leading-7 text-white">
                        {result.oneLine}
                      </p>
                    </div>

                    {result.visualPrompt && (
                      <section className="bg-slate-50 px-7 py-7">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-black tracking-[0.16em] text-emerald-600">
                              VISUAL SUMMARY
                            </p>

                            <h4 className="mt-1 text-xl font-black text-slate-900">
                              그림으로 한눈에 이해하기
                            </h4>
                          </div>

                          {!result.visualImage && (
                            <div className="rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-sm">
                              일러스트 생성 중...
                            </div>
                          )}
                        </div>

                        {result.visualImage ? (
                          <div className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200">
                            <img
                              src={
                                result.visualImage
                              }
                              alt={`${result.title} 비주얼 요약`}
                              className="w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex aspect-[3/2] items-center justify-center rounded-[28px] bg-white ring-1 ring-slate-200">
                            <div className="text-center">
                              <div className="text-4xl">
                                🎨
                              </div>

                              <p className="mt-3 text-sm font-bold text-slate-500">
                                핵심 내용을 그림으로
                                만드는 중입니다.
                              </p>
                            </div>
                          </div>
                        )}
                      </section>
                    )}

                    <div className="p-7">
                      <section>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black tracking-[0.16em] text-violet-700">
                            FLOW
                          </span>

                          <h4 className="text-xl font-black text-slate-900">
                            글의 흐름
                          </h4>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          {(result.flow ||
                            []).map(
                            (item, flowIndex) => (
                              <div
                                key={flowIndex}
                                className="rounded-[24px] bg-slate-50 p-5"
                              >
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-lg font-black text-white">
                                  {flowIndex + 1}
                                </div>

                                <p className="mt-4 text-base font-black text-violet-700">
                                  {item.label}
                                </p>

                                <p className="mt-2 text-sm leading-7 text-slate-600">
                                  {item.content}
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      </section>

                      {(result.concepts || [])
                        .length > 0 && (
                        <section className="mt-9">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black tracking-[0.16em] text-sky-700">
                              CONCEPT
                            </span>

                            <h4 className="text-xl font-black text-slate-900">
                              핵심 개념
                            </h4>
                          </div>

                          <div className="mt-5 grid gap-4 md:grid-cols-2">
                            {(
                              result.concepts || []
                            ).map(
                              (
                                concept,
                                conceptIndex
                              ) => (
                                <div
                                  key={
                                    conceptIndex
                                  }
                                  className="rounded-[24px] border border-sky-100 bg-sky-50 p-5"
                                >
                                  <p className="text-lg font-black text-slate-900">
                                    {
                                      concept.name
                                    }
                                  </p>

                                  <p className="mt-3 text-sm leading-7 text-slate-600">
                                    {
                                      concept.description
                                    }
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        </section>
                      )}

                      {hasComparison && (
                        <section className="mt-9">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black tracking-[0.16em] text-amber-700">
                              COMPARE
                            </span>

                            <h4 className="text-xl font-black text-slate-900">
                              {result.comparisonTitle ||
                                "핵심 비교"}
                            </h4>
                          </div>

                          <div className="mt-5 overflow-x-auto rounded-[24px] border border-amber-100">
                            <table className="w-full border-collapse text-sm">
                              <thead>
                                <tr>
                                  {(
                                    result.comparisonHeaders ||
                                    []
                                  ).map(
                                    (header) => (
                                      <th
                                        key={
                                          header
                                        }
                                        className="border-b border-amber-100 bg-amber-50 px-4 py-3 text-left font-black text-slate-900"
                                      >
                                        {
                                          header
                                        }
                                      </th>
                                    )
                                  )}
                                </tr>
                              </thead>

                              <tbody>
                                {(
                                  result.comparisonRows ||
                                  []
                                ).map(
                                  (
                                    row,
                                    rowIndex
                                  ) => (
                                    <tr
                                      key={
                                        rowIndex
                                      }
                                    >
                                      {row.map(
                                        (
                                          cell,
                                          cellIndex
                                        ) => (
                                          <td
                                            key={
                                              cellIndex
                                            }
                                            className="border-b border-slate-100 px-4 py-3 leading-7 text-slate-600"
                                          >
                                            {
                                              cell
                                            }
                                          </td>
                                        )
                                      )}
                                    </tr>
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}

                      {(result.testPoints || [])
                        .length > 0 && (
                        <section className="mt-9">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black tracking-[0.16em] text-rose-700">
                              TEST POINT
                            </span>

                            <h4 className="text-xl font-black text-slate-900">
                              시험 POINT
                            </h4>
                          </div>

                          <div className="mt-5 grid gap-3">
                            {(
                              result.testPoints || []
                            ).map(
                              (
                                point,
                                pointIndex
                              ) => (
                                <div
                                  key={
                                    pointIndex
                                  }
                                  className="flex gap-3 rounded-[20px] bg-rose-50 px-4 py-4"
                                >
                                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-600 text-sm font-black text-white">
                                    {
                                      pointIndex +
                                      1
                                    }
                                  </div>

                                  <p className="text-sm font-bold leading-7 text-slate-700">
                                    {point}
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        </section>
                      )}

                      {result.caution && (
                        <section className="mt-9">
                          <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
                            <p className="text-xs font-black tracking-[0.16em] text-slate-500">
                              CAUTION
                            </p>

                            <h4 className="mt-2 text-lg font-black text-slate-900">
                              헷갈리기 쉬운 포인트
                            </h4>

                            <p className="mt-3 text-sm leading-7 text-slate-600">
                              {result.caution}
                            </p>
                          </div>
                        </section>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}