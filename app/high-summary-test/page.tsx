"use client";

import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

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

export default function HighSummaryTestPage() {
  const [schoolName, setSchoolName] =
    useState("향일고");

  const [gradeName, setGradeName] =
    useState("고2");

  const [lessonName, setLessonName] =
    useState("Lesson 2");

  const [sourceText, setSourceText] =
    useState("");

  const [result, setResult] =
    useState<SummaryResult | null>(null);

  const [loadingPdf, setLoadingPdf] =
    useState(false);

  const [makingPlan, setMakingPlan] =
    useState(false);

  const [generatedImages, setGeneratedImages] =
    useState<Record<string, string>>({});

  const [generatingId, setGeneratingId] =
    useState<string | null>(null);

  const [generatingAll, setGeneratingAll] =
    useState(false);

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
        pageNumber <= pdf.numPages;
        pageNumber++
      ) {
        const page =
          await pdf.getPage(pageNumber);

        const content =
          await page.getTextContent();

        const text = content.items
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

  const makeSummaryPlan = async () => {
    if (!sourceText.trim()) {
      alert(
        "먼저 PDF를 올리거나 본문을 입력해줘."
      );
      return;
    }

    setMakingPlan(true);
    setGeneratedImages({});

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

  const generateImage = async (
    page: SummaryPage
  ) => {
    if (generatedImages[page.id]) {
      return generatedImages[page.id];
    }

    setGeneratingId(page.id);

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
          [page.id]: data.image,
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

  const generateAllImages = async () => {
    if (!result) {
      return;
    }

    const remaining =
      result.pages.filter(
        (page) =>
          !generatedImages[page.id]
      );

    if (remaining.length === 0) {
      alert(
        "이미 모든 요약 이미지가 만들어졌어."
      );
      return;
    }

    setGeneratingAll(true);

    try {
      for (const page of remaining) {
        await generateImage(page);
      }

      alert(
        "전체 요약 이미지 생성 완료!"
      );
    } catch {
      // 개별 함수에서 이미 알림 처리
    } finally {
      setGeneratingAll(false);
      setGeneratingId(null);
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

        <div className="mb-8">
          <div className="text-sm font-bold text-emerald-600">
            SUMMIT CONTENT MAKER
          </div>

          <h1 className="mt-2 text-3xl font-black">
            고등 요약집 테스트
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            PDF → 본문 추출 → 요약집 계획 → 이미지 생성
          </p>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-sm">

          <div className="grid gap-4 md:grid-cols-3">

            <label className="block">
              <span className="mb-2 block text-sm font-bold">
                학교
              </span>

              <input
                value={schoolName}
                onChange={(e) =>
                  setSchoolName(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border px-4 py-3"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold">
                학년
              </span>

              <input
                value={gradeName}
                onChange={(e) =>
                  setGradeName(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border px-4 py-3"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold">
                Lesson
              </span>

              <input
                value={lessonName}
                onChange={(e) =>
                  setLessonName(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border px-4 py-3"
              />
            </label>

          </div>

          <div className="mt-6">

            <div className="mb-3 text-sm font-bold">
              PDF 업로드
            </div>

            <label className="inline-flex cursor-pointer items-center rounded-2xl bg-emerald-600 px-5 py-3 font-black text-white shadow-sm transition hover:bg-emerald-700">
              PDF 업로드

              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file =
                    e.target.files?.[0];

                  if (file) {
                    extractPdfText(file);
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
              rows={14}
              className="w-full rounded-2xl border bg-gray-50 p-4 text-sm leading-7"
              placeholder="PDF 본문이 여기에 들어와."
            />

          </div>

          <button
            onClick={makeSummaryPlan}
            disabled={
              makingPlan ||
              !sourceText.trim()
            }
            className="mt-6 w-full rounded-2xl bg-black px-6 py-4 font-black text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {makingPlan
              ? "요약집 계획 만드는 중..."
              : "요약집 계획 만들기"}
          </button>

        </section>

        {result && (
          <section className="mt-10">

            <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">

              <div className="text-sm font-bold text-emerald-600">
                전체 요약
              </div>

              <h2 className="mt-2 text-2xl font-black">
                {result.overallTitle}
              </h2>

              <p className="mt-3 leading-7 text-gray-700">
                {result.overallSummary}
              </p>

              <div className="mt-3 text-sm font-bold text-gray-500">
                예상 본문 페이지:{" "}
                {result.pages.length}장
              </div>

              <div className="mt-1 text-sm font-bold text-gray-500">
                생성 완료:{" "}
                {generatedCount} /{" "}
                {result.pages.length}
              </div>

              <button
                onClick={
                  generateAllImages
                }
                disabled={
                  generatingAll ||
                  generatingId !== null
                }
                className="mt-5 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generatingAll
                  ? `전체 이미지 생성 중... ${generatedCount}/${result.pages.length}`
                  : "전체 이미지 만들기"}
              </button>

            </div>

            <div className="space-y-6">

              {result.pages.map(
                (page, index) => {
                  const image =
                    generatedImages[
                      page.id
                    ];

                  const isGenerating =
                    generatingId ===
                    page.id;

                  return (
                    <article
                      key={page.id}
                      className="rounded-3xl bg-white p-6 shadow-sm"
                    >

                      <div className="flex flex-wrap items-center justify-between gap-3">

                        <div>
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
                        </div>

                        <span className="rounded-full bg-yellow-200 px-4 py-2 text-xs font-black">
                          {
                            page.visualType
                          }
                        </span>

                      </div>

                      <div className="mt-5 rounded-2xl bg-yellow-50 p-4">

                        <div className="text-xs font-bold text-gray-500">
                          한 줄 핵심
                        </div>

                        <div className="mt-1 font-black">
                          {
                            page.oneLineSummary
                          }
                        </div>

                      </div>

                      <div className="mt-5 grid gap-5 md:grid-cols-2">

                        <div>
                          <div className="mb-2 font-black">
                            핵심 내용
                          </div>

                          <ul className="space-y-2">
                            {page.keyPoints.map(
                              (
                                point,
                                pointIndex
                              ) => (
                                <li
                                  key={
                                    pointIndex
                                  }
                                  className="rounded-xl bg-gray-50 px-4 py-3 text-sm"
                                >
                                  • {point}
                                </li>
                              )
                            )}
                          </ul>
                        </div>

                        <div>
                          <div className="mb-2 font-black">
                            핵심 어휘
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {page.keyWords.map(
                              (
                                word,
                                wordIndex
                              ) => (
                                <span
                                  key={
                                    wordIndex
                                  }
                                  className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800"
                                >
                                  {word}
                                </span>
                              )
                            )}
                          </div>
                        </div>

                      </div>

                      <div className="mt-5 rounded-2xl border border-dashed p-4">

                        <div className="text-xs font-bold text-gray-500">
                          시각화 아이디어
                        </div>

                        <div className="mt-1 text-sm leading-6">
                          {
                            page.visualIdea
                          }
                        </div>

                      </div>

                      <div className="mt-4 text-xs text-gray-400">
                        원문 범위:{" "}
                        {
                          page.sourceRange
                        }
                      </div>

                      <div className="mt-6 border-t pt-6">

                        <button
                          onClick={() =>
                            generateImage(
                              page
                            )
                          }
                          disabled={
                            Boolean(image) ||
                            isGenerating ||
                            generatingAll
                          }
                          className="w-full rounded-2xl bg-black px-5 py-4 font-black text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {image
                            ? "이미지 생성 완료"
                            : isGenerating
                              ? "이미지 만드는 중..."
                              : "이미지 만들기"}
                        </button>

                        {image && (
                          <div className="mt-6 overflow-hidden rounded-3xl border bg-[#f5f4ef] p-3">
                            <img
                              src={image}
                              alt={`${page.englishTitle} 요약 이미지`}
                              className="w-full rounded-2xl"
                            />
                          </div>
                        )}

                      </div>

                    </article>
                  );
                }
              )}

            </div>

          </section>
        )}

      </div>
    </main>
  );
}