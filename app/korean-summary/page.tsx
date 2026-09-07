"use client";

import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { jsPDF } from "jspdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

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
  const [pdfText, setPdfText] = useState("");

  const [passages, setPassages] = useState<Passage[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [results, setResults] = useState<SummaryResult[]>([]);

  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingPassages, setLoadingPassages] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [makingPdf, setMakingPdf] = useState(false);

  const [statusText, setStatusText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  /*
  ==================================================
  PDF 읽기
  ==================================================
  */

  const readPdf = async (file: File) => {
    try {
      setLoadingPdf(true);
      setErrorMessage("");
      setStatusText("PDF를 읽는 중...");

      setPdfText("");
      setPassages([]);
      setSelectedIds([]);
      setResults([]);

      setFileName(file.name);

      const arrayBuffer = await file.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
      });

      const pdf = await loadingTask.promise;

      let fullText = "";

      for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
      ) {
        setStatusText(
          `${pageNumber}/${pdf.numPages} 페이지 읽는 중...`
        );

        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const pageText = content.items
          .map((item: any) => {
            if ("str" in item) {
              return item.str;
            }

            return "";
          })
          .join(" ");

        fullText += `

--- ${pageNumber}페이지 ---

${pageText}`;
      }

      const cleanedText = fullText.trim();

      if (!cleanedText) {
        throw new Error(
          "PDF에서 텍스트를 읽지 못했습니다."
        );
      }

      setPdfText(cleanedText);

      setStatusText("비문학 지문을 찾는 중...");

      await extractPassages(cleanedText);
    } catch (error: any) {
      console.error(
        "PDF READ ERROR:",
        error
      );

      setErrorMessage(
        error?.message ||
          "PDF를 읽는 중 오류가 발생했습니다."
      );
    } finally {
      setLoadingPdf(false);
    }
  };

  /*
  ==================================================
  지문 분리
  중요:
  API에는 pdfText 이름으로 보낸다.
  ==================================================
  */

  const extractPassages = async (
    text: string
  ) => {
    try {
      setLoadingPassages(true);
      setErrorMessage("");

      if (!text.trim()) {
        throw new Error(
          "분석할 텍스트가 없습니다."
        );
      }

      const response = await fetch(
        "/api/korean-summary-passages",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            pdfText: text,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.error ||
            "국어 지문 분리에 실패했습니다."
        );
      }

      const foundPassages: Passage[] =
        Array.isArray(data?.passages)
          ? data.passages
          : [];

      setPassages(foundPassages);

      /*
      처음 두 지문 자동 선택
      */

      setSelectedIds(
        foundPassages
          .slice(0, 2)
          .map(
            (passage) =>
              passage.id
          )
      );

      if (foundPassages.length === 0) {
        setErrorMessage(
          "비문학 지문을 찾지 못했습니다."
        );

        setStatusText("");
      } else {
        setStatusText(
          `${foundPassages.length}개 지문을 찾았습니다.`
        );
      }
    } catch (error: any) {
      console.error(
        "PASSAGE ERROR:",
        error
      );

      setErrorMessage(
        error?.message ||
          "지문을 찾는 중 오류가 발생했습니다."
      );
    } finally {
      setLoadingPassages(false);
    }
  };

  /*
  ==================================================
  파일 선택
  ==================================================
  */

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (
      file.type !== "application/pdf" &&
      !file.name
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      alert(
        "PDF 파일을 선택해줘."
      );

      return;
    }

    await readPdf(file);
  };

  /*
  ==================================================
  지문 선택
  ==================================================
  */

  const togglePassage = (
    id: string
  ) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter(
          (item) =>
            item !== id
        );
      }

      if (prev.length >= 2) {
        alert(
          "이번에는 지문 2개까지만 선택할 수 있어."
        );

        return prev;
      }

      return [...prev, id];
    });
  };

  /*
  ==================================================
  비주얼 이미지 생성
  ==================================================
  */

  const requestVisualImage = async (
    summary: SummaryResult
  ): Promise<string> => {
    const response = await fetch(
      "/api/korean-summary-visual",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          title:
            summary.title,

          oneLine:
            summary.oneLine,

          visualPrompt:
            summary.visualPrompt,

          flow:
            summary.flow,

          concepts:
            summary.concepts,

          comparisonTitle:
            summary.comparisonTitle,

          comparisonHeaders:
            summary.comparisonHeaders,

          comparisonRows:
            summary.comparisonRows,

          testPoints:
            summary.testPoints,

          caution:
            summary.caution,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.detail ||
          data?.error ||
          "비주얼 요약 이미지 생성에 실패했습니다."
      );
    }

    if (!data?.imageUrl) {
      throw new Error(
        "생성된 비주얼 이미지가 없습니다."
      );
    }

    return data.imageUrl;
  };

  /*
  ==================================================
  요약 생성
  ==================================================
  */

  const makeSummary = async () => {
    const selectedPassages =
      passages.filter(
        (passage) =>
          selectedIds.includes(
            passage.id
          )
      );

    if (
      selectedPassages.length === 0
    ) {
      alert(
        "먼저 지문을 선택해줘."
      );

      return;
    }

    try {
      setLoadingSummary(true);
      setErrorMessage("");
      setResults([]);

      setStatusText(
        "국어 요약.ZIP 내용을 만드는 중..."
      );

      /*
      1. 텍스트 요약
      */

      const response = await fetch(
        "/api/korean-summary-generate",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            passages:
              selectedPassages,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.error ||
            "국어 요약 생성에 실패했습니다."
        );
      }

      const summaries: SummaryResult[] =
        Array.isArray(data?.summaries)
          ? data.summaries
          : [];

      if (summaries.length === 0) {
        throw new Error(
          "생성된 요약 결과가 없습니다."
        );
      }

      setResults(summaries);

      /*
      2. 비주얼 생성
      */

      const completed: SummaryResult[] = [];

      for (
        let index = 0;
        index < summaries.length;
        index++
      ) {
        const summary =
          summaries[index];

        setStatusText(
          `${index + 1}/${summaries.length} 비주얼 요약 생성 중...`
        );

        try {
          const image =
            await requestVisualImage(
              summary
            );

          completed.push({
            ...summary,
            visualImage: image,
          });
        } catch (imageError) {
          console.error(
            "VISUAL IMAGE ERROR:",
            imageError
          );

          completed.push({
            ...summary,
          });
        }

        setResults([
          ...completed,
          ...summaries.slice(
            completed.length
          ),
        ]);
      }

      setResults(completed);

      setStatusText(
        `${completed.length}개 지문 비주얼 요약 완료!`
      );
    } catch (error: any) {
      console.error(
        "SUMMARY ERROR:",
        error
      );

      setErrorMessage(
        error?.message ||
          "국어 요약.ZIP 생성 중 오류가 발생했습니다."
      );
    } finally {
      setLoadingSummary(false);
    }
  };

  /*
  ==================================================
  이미지 로딩
  ==================================================
  */

  const loadImage = (
    src: string
  ) =>
    new Promise<HTMLImageElement>(
      (resolve, reject) => {
        const image =
          new Image();

        image.onload = () =>
          resolve(image);

        image.onerror = () =>
          reject(
            new Error(
              "PDF에 넣을 이미지를 불러오지 못했습니다."
            )
          );

        image.src = src;
      }
    );

  /*
  ==================================================
  PDF 다운로드
  ==================================================
  */

  const downloadSummaryPdf =
    async () => {
      const imageResults =
        results.filter(
          (item) =>
            typeof item.visualImage ===
              "string" &&
            item.visualImage.startsWith(
              "data:image"
            )
        );

      if (
        imageResults.length === 0
      ) {
        alert(
          "먼저 비주얼 요약을 생성해줘."
        );

        return;
      }

      if (
        imageResults.length <
        selectedIds.length
      ) {
        alert(
          "아직 모든 비주얼 요약 이미지가 완성되지 않았어."
        );

        return;
      }

      try {
        setMakingPdf(true);
        setErrorMessage("");

        setStatusText(
          "PDF 만드는 중..."
        );

        const pdf =
          new jsPDF({
            orientation:
              "landscape",

            unit: "mm",

            format: "a4",

            compress: true,
          });

        const pageWidth =
          pdf.internal.pageSize.getWidth();

        const pageHeight =
          pdf.internal.pageSize.getHeight();

        const margin = 4;

        const availableWidth =
          pageWidth -
          margin * 2;

        const availableHeight =
          pageHeight -
          margin * 2;

        for (
          let index = 0;
          index <
          imageResults.length;
          index++
        ) {
          const item =
            imageResults[index];

          if (index > 0) {
            pdf.addPage(
              "a4",
              "landscape"
            );
          }

          const imageData =
            item.visualImage as string;

          const image =
            await loadImage(
              imageData
            );

          const imageRatio =
            image.width /
            image.height;

          const pageRatio =
            availableWidth /
            availableHeight;

          let drawWidth =
            availableWidth;

          let drawHeight =
            availableHeight;

          if (
            imageRatio >
            pageRatio
          ) {
            drawWidth =
              availableWidth;

            drawHeight =
              availableWidth /
              imageRatio;
          } else {
            drawHeight =
              availableHeight;

            drawWidth =
              availableHeight *
              imageRatio;
          }

          const x =
            (pageWidth -
              drawWidth) /
            2;

          const y =
            (pageHeight -
              drawHeight) /
            2;

          pdf.setFillColor(
            255,
            255,
            255
          );

          pdf.rect(
            0,
            0,
            pageWidth,
            pageHeight,
            "F"
          );

          pdf.addImage(
            imageData,
            "PNG",
            x,
            y,
            drawWidth,
            drawHeight,
            undefined,
            "FAST"
          );
        }

        const safeName =
          fileName
            .replace(
              /\.pdf$/i,
              ""
            )
            .replace(
              /[\\/:*?"<>|]/g,
              "_"
            ) ||
          "국어";

        pdf.save(
          `${safeName}_국어요약ZIP.pdf`
        );

        setStatusText(
          `${imageResults.length}페이지 PDF 다운로드 완료!`
        );
      } catch (error: any) {
        console.error(
          "PDF ERROR:",
          error
        );

        setErrorMessage(
          error?.message ||
            "PDF 생성 중 오류가 발생했습니다."
        );
      } finally {
        setMakingPdf(false);
      }
    };

  const completedImageCount =
    results.filter(
      (item) =>
        Boolean(
          item.visualImage
        )
    ).length;

  /*
  ==================================================
  화면
  ==================================================
  */

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black tracking-widest text-emerald-600">
              SUMMIT VISUAL LAB
            </p>

            <h1 className="mt-2 text-4xl font-black text-slate-900">
              국어 요약.ZIP
            </h1>

            <p className="mt-3 text-slate-600">
              고등 국어 비문학 지문을
              한눈에 보는 비주얼
              요약집으로 만들어줘.
            </p>
          </div>

          {results.length > 0 && (
            <button
              type="button"
              onClick={
                downloadSummaryPdf
              }
              disabled={
                makingPdf ||
                loadingSummary ||
                completedImageCount ===
                  0
              }
              className="rounded-2xl bg-slate-900 px-7 py-4 text-base font-black text-white shadow-lg transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {makingPdf
                ? "PDF 만드는 중..."
                : `PDF 다운로드 · ${completedImageCount}페이지`}
            </button>
          )}
        </div>

        {/* STEP 1 */}

        <section className="mt-8 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black text-blue-600">
            STEP 1
          </p>

          <h2 className="mt-2 text-2xl font-black text-slate-900">
            시험 PDF 올리기
          </h2>

          <label className="mt-5 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-blue-400 hover:bg-blue-50">
            <div>
              <p className="text-lg font-black text-slate-800">
                PDF 파일 선택
              </p>

              <p className="mt-2 text-sm text-slate-500">
                시험지를 올리면
                비문학 지문을 자동으로
                찾습니다.
              </p>

              {fileName && (
                <p className="mt-4 font-bold text-blue-600">
                  {fileName}
                </p>
              )}
            </div>

            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={
                handleFileChange
              }
            />
          </label>

          {(loadingPdf ||
            loadingPassages) && (
            <div className="mt-5 rounded-2xl bg-blue-50 px-5 py-4 font-bold text-blue-700">
              {statusText}
            </div>
          )}
        </section>

        {/* STEP 2 */}

        {passages.length > 0 && (
          <section className="mt-8 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-black text-purple-600">
                  STEP 2
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-900">
                  요약할 지문 선택
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  이번에는 최대
                  2개까지 선택.
                </p>
              </div>

              <div className="rounded-full bg-purple-100 px-5 py-2 text-sm font-black text-purple-700">
                {selectedIds.length}
                /2 선택
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {passages.map(
                (
                  passage,
                  index
                ) => {
                  const selected =
                    selectedIds.includes(
                      passage.id
                    );

                  return (
                    <button
                      key={
                        passage.id
                      }
                      type="button"
                      onClick={() =>
                        togglePassage(
                          passage.id
                        )
                      }
                      className={`rounded-3xl p-6 text-left transition ${
                        selected
                          ? "bg-slate-900 text-white shadow-lg ring-4 ring-purple-200"
                          : "bg-slate-50 text-slate-900 ring-1 ring-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p
                            className={`text-xs font-black ${
                              selected
                                ? "text-purple-300"
                                : "text-purple-600"
                            }`}
                          >
                            지문{" "}
                            {index + 1}
                          </p>

                          <h3 className="mt-2 text-xl font-black">
                            {
                              passage.title
                            }
                          </h3>
                        </div>

                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                            selected
                              ? "bg-purple-400 text-white"
                              : "bg-white text-slate-400 ring-1 ring-slate-200"
                          }`}
                        >
                          {selected
                            ? "✓"
                            : ""}
                        </div>
                      </div>

                      <p
                        className={`mt-4 line-clamp-4 text-sm leading-6 ${
                          selected
                            ? "text-slate-300"
                            : "text-slate-500"
                        }`}
                      >
                        {
                          passage.source
                        }
                      </p>
                    </button>
                  );
                }
              )}
            </div>

            <button
              type="button"
              onClick={makeSummary}
              disabled={
                loadingSummary ||
                selectedIds.length ===
                  0
              }
              className="mt-7 w-full rounded-2xl bg-emerald-600 px-7 py-5 text-lg font-black text-white shadow-lg transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loadingSummary
                ? statusText ||
                  "요약.ZIP 만드는 중..."
                : `${selectedIds.length}개 지문 요약.ZIP 만들기`}
            </button>
          </section>
        )}

        {/* ERROR */}

        {errorMessage && (
          <div className="mt-8 rounded-2xl bg-red-50 p-5 font-bold text-red-700 ring-1 ring-red-200">
            {errorMessage}
          </div>
        )}

        {/* RESULT */}

        {results.length > 0 && (
          <section className="mt-10">

            <div className="flex flex-wrap items-center justify-between gap-5">
              <div>
                <p className="text-sm font-black text-emerald-600">
                  VISUAL SUMMARY
                </p>

                <h2 className="mt-2 text-3xl font-black text-slate-900">
                  국어 요약.ZIP 결과
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  downloadSummaryPdf
                }
                disabled={
                  makingPdf ||
                  loadingSummary ||
                  completedImageCount ===
                    0
                }
                className="rounded-2xl bg-slate-900 px-7 py-4 font-black text-white shadow-lg transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {makingPdf
                  ? "PDF 만드는 중..."
                  : `PDF 다운로드 · ${completedImageCount}페이지`}
              </button>
            </div>

            {loadingSummary && (
              <div className="mt-5 rounded-2xl bg-amber-50 px-5 py-4 font-bold text-amber-700">
                {statusText}
              </div>
            )}

            <div className="mt-7 space-y-10">
              {results.map(
                (
                  result,
                  index
                ) => (
                  <article
                    key={`${result.passageId}-${index}`}
                    className="overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-slate-200"
                  >
                    <div className="border-b border-slate-100 px-7 py-6">
                      <p className="text-xs font-black tracking-widest text-emerald-600">
                        VISUAL SUMMARY{" "}
                        {index + 1}
                      </p>

                      <h3 className="mt-2 text-2xl font-black text-slate-900">
                        {result.title}
                      </h3>

                      <p className="mt-2 text-sm text-slate-500">
                        {result.oneLine}
                      </p>
                    </div>

                    {result.visualImage ? (
                      <div className="bg-slate-100 p-4 md:p-7">
                        <img
                          src={
                            result.visualImage
                          }
                          alt={
                            result.title
                          }
                          className="mx-auto w-full rounded-2xl shadow-sm"
                        />
                      </div>
                    ) : loadingSummary ? (
                      <div className="flex min-h-[360px] items-center justify-center bg-slate-50">
                        <p className="font-black text-slate-600">
                          비주얼 요약
                          생성 중...
                        </p>
                      </div>
                    ) : (
                      <div className="flex min-h-[220px] items-center justify-center bg-red-50">
                        <p className="font-bold text-red-600">
                          이미지 생성에
                          실패했습니다.
                        </p>
                      </div>
                    )}
                  </article>
                )
              )}
            </div>

            <div className="mt-10 rounded-3xl bg-slate-900 p-7 text-white">
              <div className="flex flex-wrap items-center justify-between gap-5">
                <div>
                  <p className="text-sm font-black text-emerald-300">
                    PDF EXPORT
                  </p>

                  <h3 className="mt-2 text-2xl font-black">
                    두 지문을 한
                    PDF로 저장
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={
                    downloadSummaryPdf
                  }
                  disabled={
                    makingPdf ||
                    loadingSummary ||
                    completedImageCount ===
                      0
                  }
                  className="rounded-2xl bg-emerald-500 px-8 py-5 text-lg font-black text-white transition hover:bg-emerald-400 disabled:bg-slate-600"
                >
                  {makingPdf
                    ? "PDF 만드는 중..."
                    : `${completedImageCount}페이지 PDF 다운로드`}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}