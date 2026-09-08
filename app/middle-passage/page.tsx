"use client";

import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import HomeButton from "../components/HomeButton";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

type Passage = {
  id: string;
  title: string;
  content: string;
};

function makeId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export default function MiddlePassagePage() {
  const [schoolName, setSchoolName] =
    useState("");

  const [gradeName, setGradeName] =
    useState("");

  const [lessonName, setLessonName] =
    useState("");

  const [fileName, setFileName] =
    useState("");

  const [pdfText, setPdfText] =
    useState("");

  const [passages, setPassages] =
    useState<Passage[]>([]);

  const [loadingPdf, setLoadingPdf] =
    useState(false);

  const [loadingAi, setLoadingAi] =
    useState(false);

  const [statusText, setStatusText] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const readPdf = async (
    file: File
  ) => {
    try {
      setLoadingPdf(true);
      setLoadingAi(false);

      setErrorMessage("");
      setStatusText(
        "PDF를 읽는 중..."
      );

      setPdfText("");
      setPassages([]);
      setFileName(file.name);

      const arrayBuffer =
        await file.arrayBuffer();

      const loadingTask =
        pdfjsLib.getDocument({
          data: new Uint8Array(
            arrayBuffer
          ),
        });

      const pdf =
        await loadingTask.promise;

      let fullText = "";

      for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
      ) {
        setStatusText(
          `${pageNumber}/${pdf.numPages} 페이지 읽는 중...`
        );

        const page =
          await pdf.getPage(
            pageNumber
          );

        const content =
          await page.getTextContent();

        const pageText =
          content.items
            .map((item: any) => {
              if ("str" in item) {
                return String(
                  item.str ?? ""
                );
              }

              return "";
            })
            .join(" ");

        fullText += `

--- ${pageNumber}페이지 ---

${pageText}
`;
      }

      const text =
        fullText.trim();

      if (!text) {
        throw new Error(
          "PDF에서 텍스트를 읽지 못했습니다. 스캔 PDF일 수 있습니다."
        );
      }

      setPdfText(text);

      setStatusText(
        `PDF ${pdf.numPages}페이지 읽기 완료`
      );
    } catch (error: any) {
      console.error(error);

      setErrorMessage(
        error?.message ||
          "PDF를 읽는 중 오류가 발생했습니다."
      );

      setStatusText("");
    } finally {
      setLoadingPdf(false);
    }
  };

  const analyzePassages =
    async () => {
      if (!pdfText) {
        alert(
          "먼저 PDF를 선택해 주세요."
        );

        return;
      }

      try {
        setLoadingAi(true);
        setErrorMessage("");
        setPassages([]);

        setStatusText(
          "교재에서 영어 본문을 찾는 중..."
        );

        const response =
          await fetch(
            "/api/middle-passage-analyze",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                text: pdfText,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              data?.error ||
              "본문 분석에 실패했습니다."
          );
        }

        const foundPassages =
          Array.isArray(
            data?.passages
          )
            ? data.passages
            : [];

        if (
          foundPassages.length === 0
        ) {
          throw new Error(
            "본문을 찾지 못했습니다."
          );
        }

        const nextPassages: Passage[] =
          foundPassages.map(
            (
              passage: any
            ) => ({
              id: makeId(),

              title:
                String(
                  passage?.title ||
                    "본문"
                ).trim(),

              content:
                String(
                  passage?.content ||
                    ""
                ).trim(),
            })
          );

        setPassages(
          nextPassages
        );

        setStatusText(
          `본문 ${nextPassages.length}개 찾기 완료`
        );
      } catch (error: any) {
        console.error(error);

        setErrorMessage(
          error?.message ||
            "본문을 찾는 중 오류가 발생했습니다."
        );

        setStatusText("");
      } finally {
        setLoadingAi(false);
      }
    };

  const deletePassage = (
    id: string
  ) => {
    setPassages((prev) =>
      prev.filter(
        (passage) =>
          passage.id !== id
      )
    );
  };

  const updateTitle = (
    id: string,
    value: string
  ) => {
    setPassages((prev) =>
      prev.map((passage) =>
        passage.id === id
          ? {
              ...passage,
              title: value,
            }
          : passage
      )
    );
  };

  const updateContent = (
    id: string,
    value: string
  ) => {
    setPassages((prev) =>
      prev.map((passage) =>
        passage.id === id
          ? {
              ...passage,
              content: value,
            }
          : passage
      )
    );
  };

  return (
    <main className="min-h-screen bg-[#f7f4ea] px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <HomeButton />
        </div>

        <header className="rounded-[30px] bg-white px-7 py-7 shadow-sm ring-1 ring-slate-200 md:px-9">
          <p className="text-sm font-black tracking-[0.18em] text-emerald-700">
            MIDDLE SCHOOL ENGLISH LAB
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
            중등 영어 본문 써밋네컷
          </h1>

          <p className="mt-3 text-slate-600">
            교재에서 본문을 찾아
            흐름이 한눈에 보이는
            써밋네컷으로 제작합니다.
          </p>
        </header>

        <section className="mt-7 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <p className="text-xs font-black tracking-[0.18em] text-emerald-700">
            LESSON INFORMATION
          </p>

          <h2 className="mt-1 text-2xl font-black text-slate-950">
            기본 정보
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-bold text-slate-700">
                학교
              </label>

              <input
                value={schoolName}
                onChange={(e) =>
                  setSchoolName(
                    e.target.value
                  )
                }
                placeholder="예: 향남중"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                학년
              </label>

              <input
                value={gradeName}
                onChange={(e) =>
                  setGradeName(
                    e.target.value
                  )
                }
                placeholder="예: 중2"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Lesson
              </label>

              <input
                value={lessonName}
                onChange={(e) =>
                  setLessonName(
                    e.target.value
                  )
                }
                placeholder="예: Lesson 5"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-emerald-700">
                STEP 1
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-950">
                교재 PDF 업로드
              </h2>
            </div>
          </div>

          <label className="mt-6 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 px-6 py-10 text-center transition hover:border-emerald-400 hover:bg-emerald-50">
            <div>
              <p className="text-lg font-black text-slate-900">
                PDF 파일 선택
              </p>

              <p className="mt-2 text-sm text-slate-500">
                교과서 또는 부교재 PDF
              </p>

              {fileName && (
                <p className="mt-4 font-bold text-emerald-700">
                  {fileName}
                </p>
              )}
            </div>

            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file =
                  e.target.files?.[0];

                if (!file) {
                  return;
                }

                readPdf(file);

                e.target.value = "";
              }}
            />
          </label>

          {pdfText &&
            !loadingPdf && (
              <button
                type="button"
                onClick={
                  analyzePassages
                }
                disabled={
                  loadingAi
                }
                className="mt-5 w-full rounded-2xl bg-slate-950 px-6 py-4 text-lg font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingAi
                  ? "본문 찾는 중..."
                  : "영어 본문 찾기"}
              </button>
            )}
        </section>

        {statusText && (
          <div className="mt-5 rounded-2xl bg-emerald-50 px-5 py-4 font-bold text-emerald-800 ring-1 ring-emerald-100">
            {statusText}
          </div>
        )}

        {errorMessage && (
          <div className="mt-5 rounded-2xl bg-red-50 px-5 py-4 font-bold text-red-700 ring-1 ring-red-100">
            {errorMessage}
          </div>
        )}

        {passages.length >
          0 && (
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-emerald-700">
                  STEP 2
                </p>

                <h2 className="mt-1 text-3xl font-black text-slate-950">
                  발견된 본문
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  본문을 확인하고
                  필요 없는 것은 삭제해
                  주세요.
                </p>
              </div>

              <div className="rounded-full bg-slate-950 px-5 py-2 text-sm font-black text-white">
                {passages.length}개
              </div>
            </div>

            <div className="mt-6 grid gap-6">
              {passages.map(
                (
                  passage,
                  index
                ) => (
                  <article
                    key={
                      passage.id
                    }
                    className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-800">
                          {index + 1}
                        </span>

                        <p className="font-black text-slate-900">
                          본문{" "}
                          {index + 1}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          deletePassage(
                            passage.id
                          )
                        }
                        className="rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-600 transition hover:bg-red-100"
                      >
                        삭제
                      </button>
                    </div>

                    <input
                      value={
                        passage.title
                      }
                      onChange={(e) =>
                        updateTitle(
                          passage.id,
                          e.target.value
                        )
                      }
                      className="mt-5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xl font-black text-slate-900 outline-none focus:border-emerald-400"
                    />

                    <textarea
                      value={
                        passage.content
                      }
                      onChange={(e) =>
                        updateContent(
                          passage.id,
                          e.target.value
                        )
                      }
                      rows={14}
                      className="mt-4 w-full resize-y rounded-2xl border border-slate-200 bg-white px-5 py-5 text-[15px] leading-7 text-slate-800 outline-none focus:border-emerald-400"
                    />
                  </article>
                )
              )}
            </div>

            <div className="mt-7 rounded-[28px] bg-slate-950 p-7 text-white">
              <p className="text-xs font-black tracking-[0.18em] text-emerald-300">
                NEXT STEP
              </p>

              <h3 className="mt-2 text-2xl font-black">
                본문 확인 후
                써밋네컷 설계
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                다음 단계에서 각
                본문의 흐름을 나눠
                네컷 구성과 장면을
                자동 설계합니다.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}