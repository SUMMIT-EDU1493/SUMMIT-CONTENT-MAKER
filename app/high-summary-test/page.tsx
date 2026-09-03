"use client";

import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { jsPDF } from "jspdf";

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
          "먼저 PDF를 올리거나 본문을 입력해줘."
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

  // -----------------------------
  // 앞표지
  // -----------------------------

  const createFrontCover =
    async () => {
      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width = 1536;
      canvas.height = 1024;

      const ctx =
        canvas.getContext(
          "2d"
        );

      if (!ctx) {
        throw new Error(
          "앞표지 생성 실패"
        );
      }

      // 배경
      ctx.fillStyle =
        "#F7F3E8";

      ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      // 얇은 모눈
      ctx.strokeStyle =
        "rgba(60,60,60,0.07)";

      ctx.lineWidth = 1;

      for (
        let x = 0;
        x <=
        canvas.width;
        x += 48
      ) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(
          x,
          canvas.height
        );
        ctx.stroke();
      }

      for (
        let y = 0;
        y <=
        canvas.height;
        y += 48
      ) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(
          canvas.width,
          y
        );
        ctx.stroke();
      }

      // 학교/학년
      ctx.fillStyle =
        "#111111";

      ctx.textAlign =
        "left";

      ctx.font =
        '700 38px "Noto Sans KR", "Malgun Gothic", sans-serif';

      ctx.fillText(
        [
          schoolName.trim(),
          gradeName.trim(),
        ]
          .filter(Boolean)
          .join(" "),
        150,
        145
      );

      ctx.font =
        '800 44px "Noto Sans KR", "Malgun Gothic", sans-serif';

      ctx.fillText(
        lessonName.trim() ||
          "Lesson",
        150,
        210
      );

      // 폴더 그림
      const folderX = 330;
      const folderY = 300;
      const folderW = 880;
      const folderH = 430;

      ctx.fillStyle =
        "#E7C96A";

      ctx.beginPath();

      ctx.roundRect(
        folderX,
        folderY,
        folderW,
        folderH,
        35
      );

      ctx.fill();

      // 폴더 탭
      ctx.fillStyle =
        "#DAB94F";

      ctx.beginPath();

      ctx.roundRect(
        folderX + 65,
        folderY - 70,
        330,
        110,
        28
      );

      ctx.fill();

      // 포인트 형광펜
      ctx.fillStyle =
        "#FFF176";

      ctx.fillRect(
        folderX + 230,
        folderY + 180,
        430,
        72
      );

      // 요약.ZIP
      ctx.fillStyle =
        "#111111";

      ctx.textAlign =
        "center";

      ctx.font =
        '900 118px "Noto Sans KR", "Malgun Gothic", sans-serif';

      ctx.fillText(
        "요약.ZIP",
        canvas.width / 2,
        folderY + 265
      );

      ctx.font =
        '700 31px "Noto Sans KR", "Malgun Gothic", sans-serif';

      ctx.fillText(
        "시험 직전, 한눈에 끝내는 핵심 정리",
        canvas.width / 2,
        folderY + 345
      );

      // 두들
      ctx.strokeStyle =
        "#111111";

      ctx.lineWidth = 6;

      // 별
      const star = (
        cx: number,
        cy: number,
        r: number
      ) => {
        ctx.beginPath();

        for (
          let i = 0;
          i < 10;
          i++
        ) {
          const angle =
            -Math.PI / 2 +
            (Math.PI *
              i) /
              5;

          const rr =
            i % 2 === 0
              ? r
              : r * 0.42;

          const x =
            cx +
            Math.cos(
              angle
            ) *
              rr;

          const y =
            cy +
            Math.sin(
              angle
            ) *
              rr;

          if (i === 0) {
            ctx.moveTo(
              x,
              y
            );
          } else {
            ctx.lineTo(
              x,
              y
            );
          }
        }

        ctx.closePath();
        ctx.stroke();
      };

      star(
        220,
        360,
        34
      );

      star(
        1320,
        320,
        42
      );

      // 화살표
      ctx.beginPath();

      ctx.moveTo(
        175,
        560
      );

      ctx.bezierCurveTo(
        210,
        515,
        245,
        520,
        275,
        555
      );

      ctx.stroke();

      ctx.beginPath();

      ctx.moveTo(
        266,
        535
      );

      ctx.lineTo(
        278,
        556
      );

      ctx.lineTo(
        252,
        556
      );

      ctx.stroke();

      // 공식 로고
      try {
        const logo =
          await loadImage(
            "/summit-logo-trimmed.png"
          );

        const maxWidth =
          270;

        const ratio =
          maxWidth /
          logo.naturalWidth;

        const width =
          logo.naturalWidth *
          ratio;

        const height =
          logo.naturalHeight *
          ratio;

        ctx.drawImage(
          logo,
          canvas.width / 2 -
            width / 2,
          835,
          width,
          height
        );
      } catch (
        error
      ) {
        console.error(
          "SUMMARY COVER LOGO ERROR:",
          error
        );
      }

      return canvas.toDataURL(
        "image/png",
        1
      );
    };

  // -----------------------------
  // 마지막장
  // -----------------------------

  const createBackCover =
    async () => {
      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width = 1536;
      canvas.height = 1024;

      const ctx =
        canvas.getContext(
          "2d"
        );

      if (!ctx) {
        throw new Error(
          "마지막장 생성 실패"
        );
      }

      ctx.fillStyle =
        "#F7F3E8";

      ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      // 은은한 종이 선
      ctx.strokeStyle =
        "rgba(0,0,0,0.06)";

      ctx.lineWidth = 1;

      for (
        let y = 80;
        y < 950;
        y += 52
      ) {
        ctx.beginPath();

        ctx.moveTo(
          110,
          y
        );

        ctx.lineTo(
          1425,
          y
        );

        ctx.stroke();
      }

      // 큰 A+
      ctx.strokeStyle =
        "#D61F2C";

      ctx.fillStyle =
        "#D61F2C";

      ctx.lineWidth = 9;

      ctx.font =
        '900 240px Arial, sans-serif';

      ctx.textAlign =
        "center";

      ctx.fillText(
        "A+",
        600,
        420
      );

      ctx.beginPath();

      ctx.arc(
        600,
        340,
        255,
        0,
        Math.PI * 2
      );

      ctx.stroke();

      // 포스트잇
      ctx.save();

      ctx.translate(
        1010,
        520
      );

      ctx.rotate(
        -0.055
      );

      ctx.fillStyle =
        "#FFE77A";

      ctx.shadowColor =
        "rgba(0,0,0,0.15)";

      ctx.shadowBlur =
        20;

      ctx.fillRect(
        -285,
        -185,
        570,
        370
      );

      ctx.shadowBlur = 0;

      ctx.fillStyle =
        "#111111";

      ctx.textAlign =
        "left";

      ctx.font =
        '800 37px "Noto Sans KR", "Malgun Gothic", sans-serif';

      const lines = [
        `${schoolName.trim()} ${gradeName.trim()},`,
        `${lessonName.trim()} 핵심정리 완료!`,
        "",
        "시험 직전 한 번 더 보고,",
        "흐름까지 완벽하게 잡자.",
        "",
        "써밋에듀가 응원할게!",
      ];

      let lineY = -115;

      for (
        const line of lines
      ) {
        ctx.fillText(
          line,
          -230,
          lineY
        );

        lineY += 56;
      }

      ctx.restore();

      // 두들
      ctx.strokeStyle =
        "#111111";

      ctx.lineWidth = 5;

      ctx.beginPath();

      ctx.moveTo(
        175,
        745
      );

      ctx.lineTo(
        150,
        705
      );

      ctx.moveTo(
        205,
        730
      );

      ctx.lineTo(
        200,
        680
      );

      ctx.moveTo(
        235,
        750
      );

      ctx.lineTo(
        260,
        710
      );

      ctx.stroke();

      // 로고
      try {
        const logo =
          await loadImage(
            "/summit-logo-trimmed.png"
          );

        const maxWidth =
          300;

        const ratio =
          maxWidth /
          logo.naturalWidth;

        const width =
          logo.naturalWidth *
          ratio;

        const height =
          logo.naturalHeight *
          ratio;

        ctx.drawImage(
          logo,
          canvas.width / 2 -
            width / 2,
          840,
          width,
          height
        );
      } catch (
        error
      ) {
        console.error(
          "SUMMARY BACK LOGO ERROR:",
          error
        );
      }

      return canvas.toDataURL(
        "image/png",
        1
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
          "먼저 이미지를 작업함에 추가해줘."
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

        <div className="mb-8">
          <div className="text-sm font-bold text-emerald-600">
            SUMMIT CONTENT MAKER
          </div>

          <h1 className="mt-2 text-3xl font-black">
            고등 요약집 테스트
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            PDF → 요약계획 → 이미지 → 작업함 → 최종 PDF
          </p>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-sm">

          <div className="grid gap-4 md:grid-cols-3">

            <label>
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

            <label>
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

            <label>
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

              <button
                onClick={
                  addAllToWorkbox
                }
                className="mt-3 w-full rounded-2xl border-2 border-black bg-white px-5 py-4 font-black"
              >
                생성된 이미지 전체 작업함 추가
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