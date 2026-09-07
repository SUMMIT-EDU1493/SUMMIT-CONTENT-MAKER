"use client";

import { useState } from "react";
import HomeButton from "../components/HomeButton";

type Passage = {
  id: string;
  title: string;
  source: string;
};

type SummaryResult = {
  passageId: string;
  title: string;
  oneLine: string;
  flow: {
    label: string;
    content: string;
  }[];
  concepts: {
    name: string;
    description: string;
  }[];
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
        body: JSON.stringify({ sourceText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "국어 지문을 분리하지 못했습니다."
        );
      }

      const next: Passage[] = Array.isArray(data?.passages)
        ? data.passages
        : [];

      setPassages(next);

      // 처음 두 지문 기본 선택
      setSelectedIds(
        next.slice(0, 2).map((passage) => passage.id)
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

  const makeSummary = async () => {
    const selected = passages.filter((passage) =>
      selectedIds.includes(passage.id)
    );

    if (selected.length === 0) {
      alert("요약할 지문을 선택해 주세요.");
      return;
    }

    try {
      setGenerating(true);

      const response = await fetch("/api/korean-summary-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          passages: selected,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "요약.ZIP 생성 중 오류가 발생했습니다."
        );
      }

      setResults(
        Array.isArray(data?.summaries)
          ? data.summaries
          : []
      );
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
        <div className="flex items-center justify-between gap-4">
          <HomeButton />

          <div className="rounded-full bg-violet-100 px-4 py-2 text-xs font-black tracking-[0.16em] text-violet-700">
            KOR SUMMARY LAB
          </div>
        </div>

        <section className="mt-8">
          <p className="text-sm font-black tracking-[0.18em] text-violet-600">
            SUMMIT VISUAL LAB
          </p>

          <h1 className="mt-2 text-4xl font-black text-slate-900 md:text-5xl">
            국어 요약.ZIP
          </h1>

          <p className="mt-4 text-base font-medium leading-7 text-slate-500">
            긴 비문학 지문을 글의 흐름, 핵심 개념, 비교 관계,
            시험 포인트 중심으로 압축합니다.
          </p>
        </section>

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-slate-900">
            1. PDF 업로드
          </h2>

          <label className="mt-5 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50 px-6 py-10 text-center">
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
              <p className="text-lg font-black text-violet-700">
                {extracting
                  ? "지문 분석 중..."
                  : "국어 PDF 선택"}
              </p>

              {fileName && (
                <p className="mt-2 text-sm font-medium text-slate-500">
                  {fileName}
                </p>
              )}
            </div>
          </label>
        </section>

        {passages.length > 0 && (
          <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  2. 요약할 지문 선택
                </h2>

                <p className="mt-2 text-sm font-medium text-slate-500">
                  이번 테스트에서는 두 개 지문을 선택해 보세요.
                </p>
              </div>

              <span className="rounded-full bg-violet-50 px-4 py-2 text-sm font-black text-violet-700">
                {selectedIds.length}개 선택
              </span>
            </div>

            <div className="mt-5 grid gap-4">
              {passages.map((passage) => {
                const selected = selectedIds.includes(passage.id);

                return (
                  <button
                    key={passage.id}
                    type="button"
                    onClick={() => togglePassage(passage.id)}
                    className={`rounded-2xl border p-5 text-left ${
                      selected
                        ? "border-violet-400 bg-violet-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex gap-3">
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          selected
                            ? "bg-violet-600 text-white"
                            : "border border-slate-300"
                        }`}
                      >
                        {selected ? "✓" : ""}
                      </div>

                      <div>
                        <h3 className="font-black text-slate-900">
                          {passage.title}
                        </h3>

                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
                          {passage.source}
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
              disabled={generating || selectedIds.length === 0}
              className="mt-6 w-full rounded-2xl bg-violet-600 px-6 py-4 text-lg font-black text-white disabled:opacity-40"
            >
              {generating
                ? "요약.ZIP 만드는 중..."
                : "선택 지문으로 요약.ZIP 만들기"}
            </button>
          </section>
        )}

        {results.length > 0 && (
          <section className="mt-8 grid gap-8">
            {results.map((result, index) => (
              <article
                key={`${result.passageId}-${index}`}
                className="rounded-[32px] bg-white p-7 shadow-sm ring-1 ring-slate-200"
              >
                <p className="text-xs font-black tracking-[0.15em] text-violet-600">
                  SUMMARY.ZIP {String(index + 1).padStart(2, "0")}
                </p>

                <h2 className="mt-2 text-3xl font-black text-slate-900">
                  {result.title}
                </h2>

                <div className="mt-5 rounded-2xl bg-violet-50 p-5">
                  <p className="text-xs font-black text-violet-600">
                    핵심 한 줄
                  </p>

                  <p className="mt-2 text-lg font-black leading-8 text-slate-900">
                    {result.oneLine}
                  </p>
                </div>

                <div className="mt-7">
                  <h3 className="text-lg font-black text-slate-900">
                    글의 흐름
                  </h3>

                  <div className="mt-4 grid gap-3">
                    {result.flow.map((item, i) => (
                      <div
                        key={i}
                        className="rounded-2xl bg-slate-50 p-4"
                      >
                        <p className="font-black text-violet-700">
                          {i + 1}. {item.label}
                        </p>

                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {item.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {result.concepts.length > 0 && (
                  <div className="mt-7">
                    <h3 className="text-lg font-black text-slate-900">
                      핵심 개념
                    </h3>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {result.concepts.map((concept, i) => (
                        <div
                          key={i}
                          className="rounded-2xl border border-slate-200 p-4"
                        >
                          <p className="font-black text-slate-900">
                            {concept.name}
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {concept.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.comparisonRows.length > 0 && (
                  <div className="mt-7 overflow-x-auto">
                    <h3 className="text-lg font-black text-slate-900">
                      {result.comparisonTitle || "핵심 비교"}
                    </h3>

                    <table className="mt-4 w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          {result.comparisonHeaders.map((header) => (
                            <th
                              key={header}
                              className="border border-violet-200 bg-violet-50 p-3 font-black"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {result.comparisonRows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="border border-slate-200 p-3 leading-6"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-7">
                  <h3 className="text-lg font-black text-slate-900">
                    시험 POINT
                  </h3>

                  <div className="mt-4 grid gap-2">
                    {result.testPoints.map((point, i) => (
                      <div
                        key={i}
                        className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold leading-6"
                      >
                        {point}
                      </div>
                    ))}
                  </div>
                </div>

                {result.caution && (
                  <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5">
                    <p className="text-xs font-black text-rose-600">
                      헷갈리기 쉬운 포인트
                    </p>

                    <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
                      {result.caution}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}