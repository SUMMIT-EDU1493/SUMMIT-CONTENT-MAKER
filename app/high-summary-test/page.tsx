"use client";

import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { jsPDF } from "jspdf";
import HomeButton from "../components/HomeButton";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type SummaryPage = {
  id: string;
  englishTitle: string;
  koreanTitle: string;
  oneLineSummary: string;
  keyPoints: string[];
  keyWords: string[];
  sourceRange: string;
  visualType:
    | "FLOW"
    | "COMPARE"
    | "CAUSE_EFFECT"
    | "TIMELINE"
    | "CONCEPT"
    | "PERSON_STORY"
    | "PROCESS";
  visualIdea: string;
};

type SummaryResult = {
  overallTitle: string;
  overallSummary: string;
  pageCount: number;
  pages: SummaryPage[];
};

type WorkItem = {
  id: string;
  title: string;
  image: string;
};

export default function HighSummaryTestPage() {
  const [schoolName, setSchoolName] =
    useState("");

  const [gradeName, setGradeName] =
    useState("");

  const [lessonName, setLessonName] =
    useState("");

  const [sourceText, setSourceText] =
    useState("");

  const [result, setResult] =
    useState<SummaryResult | null>(null);

  const [loadingPdf, setLoadingPdf] =
    useState(false);

  const [makingPlan, setMakingPlan] =
    useState(false);

  const [
    generatedImages,
    setGeneratedImages,
  ] = useState<
    Record<string, string>
  >({});

  const [
    generatingId,
    setGeneratingId,
  ] = useState<string | null>(
    null
  );

  const [
    generatingAll,
    setGeneratingAll,
  ] = useState(false);

  const [
    workItems,
    setWorkItems,
  ] = useState<WorkItem[]>([]);

  const [
    makingFinalPdf,
    setMakingFinalPdf,
  ] = useState(false);

  // -----------------------------
  // 이미지 로드
  // -----------------------------

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
              `이미지를 불러오지 못했어: ${src}`
            )
          );

        image.src = src;
      }
    );

  // -----------------------------
  // PDF 본문 추출
  // -----------------------------

  const extractPdfText = async (
    file: File
  ) => {
    setLoadingPdf(true);

    try {
      const buffer =
        await file.arrayBuffer();

      const pdf =
        await pdfjsLib.getDocument({
          data: buffer,
        }).promise;

      const pages: string[] = [];

      for (
        let pageNumber = 1;
        pageNumber <=
        pdf.numPages;
        pageNumber++
      ) {
        const page =
          await pdf.getPage(
            pageNumber
          );

        const content =
          await page.getTextContent();

        const text =
          content.items
            .map((item: any) =>
              "str" in item
                ? item.str
                : ""
            )
            .join(" ");

        pages.push(
          `[PAGE ${pageNumber}]\n${text}`
        );
      }

      setSourceText(
        pages.join("\n\n")
      );

      setResult(null);
      setGeneratedImages({});
      setWorkItems([]);
    } catch (error) {
      console.error(
        "PDF EXTRACTION ERROR:",
        error
      );

      alert(
        "PDF 본문을 읽는 중 오류가 생겼어."
      );
    } finally {
      setLoadingPdf(false);
    }
  };

  // -----------------------------
  // 요약집 계획
  // -----------------------------

  const makeSummaryPlan =
    async () => {
      if (!sourceText.trim()) {
        alert(
          "먼저 PDF 파일을 업로드하거나 본문을 입력해 주세요."
        );
        return;
      }

      setMakingPlan(true);
      setGeneratedImages({});
      setWorkItems([]);

      try {
        const response =
          await fetch(
            "/api/high-summary-plan",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                schoolName,
                gradeName,
                lessonName,
                sourceText,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "요약집 계획 생성 실패"
          );
        }

        setResult(data);
      } catch (error: any) {
        console.error(
          "SUMMARY PLAN ERROR:",
          error
        );

        alert(
          error?.message ||
            "요약집 계획 생성 중 오류가 생겼어."
        );
      } finally {
        setMakingPlan(false);
      }
    };

  // -----------------------------
  // 개별 이미지 생성
  // -----------------------------

  const generateImage = async (
    page: SummaryPage
  ) => {
    if (
      generatedImages[
        page.id
      ]
    ) {
      return generatedImages[
        page.id
      ];
    }

    setGeneratingId(
      page.id
    );

    try {
      const response =
        await fetch(
          "/api/test-high-summary-image",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              page,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "이미지 생성 실패"
        );
      }

      if (!data?.image) {
        throw new Error(
          "생성된 이미지가 없어."
        );
      }

      setGeneratedImages(
        (prev) => ({
          ...prev,
          [page.id]:
            data.image,
        })
      );

      return data.image as string;
    } catch (error: any) {
      console.error(
        "SUMMARY IMAGE ERROR:",
        error
      );

      alert(
        error?.message ||
          "요약집 이미지 생성 중 오류가 생겼어."
      );

      throw error;
    } finally {
      setGeneratingId(null);
    }
  };

  // -----------------------------
  // 전체 이미지 생성
  // -----------------------------

  const generateAllImages =
    async () => {
      if (!result) {
        return;
      }

      const remaining =
        result.pages.filter(
          (page) =>
            !generatedImages[
              page.id
            ]
        );

      if (
        remaining.length === 0
      ) {
        alert(
          "이미 모든 요약 이미지가 만들어졌어."
        );
        return;
      }

      setGeneratingAll(true);

      try {
        for (
          const page of remaining
        ) {
          await generateImage(
            page
          );
        }

        alert(
          "전체 요약 이미지 생성 완료!"
        );
      } catch {
        // 개별 함수가 오류 표시
      } finally {
        setGeneratingAll(false);
        setGeneratingId(null);
      }
    };

  // -----------------------------
  // 작업함 개별 추가
  // -----------------------------

  const addToWorkbox = (
    page: SummaryPage
  ) => {
    const image =
      generatedImages[
        page.id
      ];

    if (!image) {
      alert(
        "먼저 이미지를 만들어줘."
      );
      return;
    }

    setWorkItems(
      (prev) => {
        if (
          prev.some(
            (item) =>
              item.id ===
              page.id
          )
        ) {
          return prev;
        }

        return [
          ...prev,
          {
            id: page.id,
            title:
              page.englishTitle,
            image,
          },
        ];
      }
    );
  };

  // -----------------------------
  // 작업함 전체 추가
  // -----------------------------

  const addAllToWorkbox =
    () => {
      if (!result) {
        return;
      }

      const available =
        result.pages
          .filter(
            (page) =>
              Boolean(
                generatedImages[
                  page.id
                ]
              )
          )
          .map(
            (page) => ({
              id: page.id,
              title:
                page.englishTitle,
              image:
                generatedImages[
                  page.id
                ],
            })
          );

      if (
        available.length === 0
      ) {
        alert(
          "먼저 이미지를 만들어줘."
        );
        return;
      }

      setWorkItems(
        (prev) => {
          const ids =
            new Set(
              prev.map(
                (item) =>
                  item.id
              )
            );

          const additional =
            available.filter(
              (item) =>
                !ids.has(
                  item.id
                )
            );

          return [
            ...prev,
            ...additional,
          ];
        }
      );
    };

  const removeWorkItem = (
    id: string
  ) => {
    setWorkItems(
      (prev) =>
        prev.filter(
          (item) =>
            item.id !== id
        )
    );
  };

  const fetchSummaryPageImage = async (
    url: string
  ) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolName,
        gradeName,
        lessonName,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "페이지 이미지 생성 실패"
      );
    }

    if (!data?.image) {
      throw new Error(
        "생성된 페이지 이미지가 없어."
      );
    }

    return data.image as string;
  };

  // -----------------------------
  // 앞표지
  // -----------------------------

  const createFrontCover =
    async () => {
      return await fetchSummaryPageImage(
        "/api/high-summary-cover"
      );
    };

  // -----------------------------
  // 마지막장
  // -----------------------------

  const createBackCover =
    async () => {
      return await fetchSummaryPageImage(
        "/api/high-summary-back"
      );
    };

  // -----------------------------
  // PDF에 이미지 맞춰 넣기
  // -----------------------------

  const addImagePageToPdf = (
    pdf: jsPDF,
    image: string
  ) => {
    const pageWidth =
      pdf.internal.pageSize.getWidth();

    const pageHeight =
      pdf.internal.pageSize.getHeight();

    pdf.addImage(
      image,
      "PNG",
      0,
      0,
      pageWidth,
      pageHeight
    );
  };

  // -----------------------------
  // 최종 PDF
  // -----------------------------

  const makeFinalPdf =
    async () => {
      if (
        workItems.length === 0
      ) {
        alert(
          "먼저 이미지를 작업함에 추가해 주세요."
        );
        return;
      }

      try {
        setMakingFinalPdf(
          true
        );

        const cover =
          await createFrontCover();

        const back =
          await createBackCover();

        const pdf =
          new jsPDF({
            orientation:
              "landscape",
            unit: "mm",
            format: "a4",
            compress: true,
          });

        addImagePageToPdf(
          pdf,
          cover
        );

        for (
          let i = 0;
          i <
          workItems.length;
          i++
        ) {
          pdf.addPage(
            "a4",
            "landscape"
          );

          addImagePageToPdf(
            pdf,
            workItems[i]
              .image
          );
        }

        pdf.addPage(
          "a4",
          "landscape"
        );

        addImagePageToPdf(
          pdf,
          back
        );

        const fileName =
          [
            schoolName.trim(),
            gradeName.trim(),
            lessonName.trim(),
            "요약집",
          ]
            .filter(
              Boolean
            )
            .join("-");

        pdf.save(
          `${fileName}.pdf`
        );
      } catch (
        error
      ) {
        console.error(
          "SUMMARY FINAL PDF ERROR:",
          error
        );

        alert(
          "최종 요약집 PDF를 만드는 중 오류가 생겼어."
        );
      } finally {
        setMakingFinalPdf(
          false
        );
      }
    };

  const generatedCount =
    result
      ? result.pages.filter(
          (page) =>
            Boolean(
              generatedImages[
                page.id
              ]
            )
        ).length
      : 0;

  return (
    <main className="min-h-screen bg-[#f5f4ef] px-6 py-10">
      <div className="mx-auto max-w-6xl">

        
      <div className="mb-6 flex flex-wrap gap-3">
        <HomeButton />

        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = "/";
            }
          }}
          className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
        >
          ← 컨텐츠 선택으로
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight text-slate-900">
          고등 요약집
        </h1>

        <p className="mt-3 text-base font-medium leading-7 text-slate-600">
          긴 영어 본문을 핵심 의미 단위로 분석해 한눈에 들어오는 VISUAL 요약자료로 제작합니다.
        </p>

        <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
          PDF 업로드
          <span>→</span>
          의미 블록 분석
          <span>→</span>
          핵심 요약
          <span>→</span>
          VISUAL 요약집
        </div>
      </div>

<section className="mb-8 rounded-3xl bg-white p-6 shadow-sm">
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                학교명
              </span>

              <input
                value={schoolName}
                onChange={(e) => {
                  setSchoolName(e.target.value);
                }}
                placeholder="예) 써밋고"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 placeholder:text-slate-400"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                학년
              </span>

              <input
                value={gradeName}
                onChange={(e) => {
                  setGradeName(e.target.value);
                }}
                placeholder="예) 고 2"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 placeholder:text-slate-400"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                Lesson
              </span>

              <input
                value={lessonName}
                onChange={(e) => {
                  setLessonName(e.target.value);
                }}
                placeholder="예) Lesson 1"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 placeholder:text-slate-400"
              />
            </label>
          </div>

          <div className="mt-6">
            <div className="mb-3 text-sm font-bold">
              PDF 업로드
            </div>

            <label className="inline-flex cursor-pointer rounded-2xl bg-emerald-600 px-5 py-3 font-black text-white shadow-sm hover:bg-emerald-700">
              PDF 업로드

              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file =
                    e.target.files?.[0];

                  if (file) {
                    extractPdfText(
                      file
                    );
                  }
                }}
              />
            </label>

            {loadingPdf && (
              <div className="mt-3 text-sm font-bold text-emerald-600">
                PDF 읽는 중...
              </div>
            )}
          </div>

          <div className="mt-6">
            <div className="mb-2 text-sm font-bold">
              추출된 본문
            </div>

            <textarea
              value={sourceText}
              onChange={(e) =>
                setSourceText(
                  e.target.value
                )
              }
              rows={12}
              className="w-full rounded-2xl border bg-gray-50 p-4 text-sm leading-7"
            />
          </div>

          <button
            onClick={
              makeSummaryPlan
            }
            disabled={
              makingPlan ||
              !sourceText.trim()
            }
            className="mt-6 w-full rounded-2xl bg-black px-6 py-4 font-black text-white disabled:opacity-40"
          >
            {makingPlan
              ? "요약집 계획 만드는 중..."
              : "요약집 계획 만들기"}
          </button>

        </section>

        {result && (
          <section className="mt-10">

            <div className="rounded-3xl bg-white p-6 shadow-sm">

              <div className="text-sm font-black text-emerald-600">
                전체 요약
              </div>

              <h2 className="mt-2 text-2xl font-black">
                {
                  result.overallTitle
                }
              </h2>

              <p className="mt-3 leading-7 text-gray-700">
                {
                  result.overallSummary
                }
              </p>

              <div className="mt-4 text-sm font-bold text-gray-500">
                이미지 생성:{" "}
                {generatedCount}/
                {
                  result.pages
                    .length
                }
              </div>

              <button
                onClick={
                  generateAllImages
                }
                disabled={
                  generatingAll ||
                  generatingId !==
                    null
                }
                className="mt-5 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white disabled:opacity-40"
              >
                {generatingAll
                  ? `전체 이미지 생성 중... ${generatedCount}/${result.pages.length}`
                  : "전체 이미지 만들기"}
              </button>

            </div>

            <div className="mt-6 space-y-6">

              {result.pages.map(
                (
                  page,
                  index
                ) => {
                  const image =
                    generatedImages[
                      page.id
                    ];

                  return (
                    <article
                      key={
                        page.id
                      }
                      className="rounded-3xl bg-white p-6 shadow-sm"
                    >

                      <div className="text-xs font-black text-emerald-600">
                        PAGE{" "}
                        {index + 1}
                      </div>

                      <h3 className="mt-1 text-xl font-black">
                        {
                          page.englishTitle
                        }
                      </h3>

                      <div className="mt-1 font-bold text-gray-700">
                        {
                          page.koreanTitle
                        }
                      </div>

                      <div className="mt-5 rounded-2xl bg-yellow-50 p-4 font-black">
                        {
                          page.oneLineSummary
                        }
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {page.keyWords.map(
                          (
                            word,
                            i
                          ) => (
                            <span
                              key={
                                i
                              }
                              className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-bold"
                            >
                              {
                                word
                              }
                            </span>
                          )
                        )}
                      </div>

                      <button
                        onClick={() =>
                          generateImage(
                            page
                          )
                        }
                        disabled={
                          Boolean(
                            image
                          ) ||
                          generatingAll ||
                          generatingId ===
                            page.id
                        }
                        className="mt-5 w-full rounded-2xl bg-black px-5 py-4 font-black text-white disabled:opacity-40"
                      >
                        {image
                          ? "이미지 생성 완료"
                          : generatingId ===
                              page.id
                            ? "이미지 만드는 중..."
                            : "이미지 만들기"}
                      </button>

                      {image && (
                        <>
                          <div className="mt-5 overflow-hidden rounded-3xl border p-3">
                            <img
                              src={
                                image
                              }
                              alt=""
                              className="w-full rounded-2xl"
                            />
                          </div>

                          <button
                            onClick={() =>
                              addToWorkbox(
                                page
                              )
                            }
                            className="mt-3 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white"
                          >
                            작업함에 추가
                          </button>
                        </>
                      )}

                    </article>
                  );
                }
              )}

            </div>

            <button
              onClick={addAllToWorkbox}
              disabled={generatedCount === 0}
              className="mt-6 w-full rounded-2xl border-2 border-black bg-white px-5 py-4 font-black transition hover:bg-gray-50 disabled:opacity-40"
            >
              이미지 확인 완료 → 전체 작업함 추가
            </button>

            <div className="mt-10 rounded-3xl bg-white p-6 shadow-sm">

              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">
                  작업함
                </h2>

                <div className="text-sm font-bold text-gray-500">
                  {
                    workItems.length
                  }
                  장
                </div>
              </div>

              {workItems.length ===
              0 ? (
                <div className="mt-5 rounded-2xl bg-gray-50 p-6 text-center text-sm text-gray-500">
                  아직 작업함이 비어 있어.
                </div>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2">

                  {workItems.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={
                          item.id
                        }
                        className="rounded-2xl border p-3"
                      >
                        <div className="mb-2 text-sm font-black">
                          {index +
                            1}
                          .{" "}
                          {
                            item.title
                          }
                        </div>

                        <img
                          src={
                            item.image
                          }
                          alt=""
                          className="w-full rounded-xl"
                        />

                        <button
                          onClick={() =>
                            removeWorkItem(
                              item.id
                            )
                          }
                          className="mt-2 w-full rounded-xl bg-red-50 px-4 py-2 text-sm font-black text-red-600"
                        >
                          작업함에서 삭제
                        </button>
                      </div>
                    )
                  )}

                </div>
              )}

              <button
                onClick={
                  makeFinalPdf
                }
                disabled={
                  makingFinalPdf ||
                  workItems.length ===
                    0
                }
                className="mt-6 w-full rounded-2xl bg-black px-6 py-5 text-lg font-black text-white disabled:opacity-40"
              >
                {makingFinalPdf
                  ? "최종 요약집 PDF 만드는 중..."
                  : "앞표지 + 본문 + 마지막장 PDF 만들기"}
              </button>

            </div>

          </section>
        )}

      </div>
    </main>
  );
}