"use client";

import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type ComicDialogue = {
  speaker: string;
  text: string;
};

type ComicPanel = {
  cut: string;
  scene: string;
  characters: string;
  dialogue: ComicDialogue[];
};

type HighComicPlan = {
  id: string;
  englishTitle: string;
  koreanSubtitle: string;
  blockSummary: string;
  sourceRange: string;
  keyWords: string[];
  panels: ComicPanel[];
};

type HighComicResult = {
  overallTitle: string;
  overallSummary: string;
  blockCount: number;
  plans: HighComicPlan[];
};

export default function HighTestPage() {
  const [schoolName, setSchoolName] = useState("향일고");
  const [gradeName, setGradeName] = useState("고2");
  const [lessonName, setLessonName] = useState("Lesson 1");

  const [fileName, setFileName] = useState("");
  const [pdfText, setPdfText] = useState("");

  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);

  const [result, setResult] =
    useState<HighComicResult | null>(null);

  const [errorMessage, setErrorMessage] = useState("");

  const [generatedImages, setGeneratedImages] =
    useState<Record<string, string>>({});

  const [generatingId, setGeneratingId] =
    useState<string>("");

  const readPdf = async (file: File) => {
    try {
      setLoadingPdf(true);
      setErrorMessage("");
      setResult(null);
      setPdfText("");
      setGeneratedImages({});

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

${pageText}
`;
      }

      if (!fullText.trim()) {
        throw new Error(
          "PDF에서 텍스트를 찾지 못했습니다."
        );
      }

      setPdfText(fullText.trim());
    } catch (error: any) {
      console.error("HIGH TEST PDF ERROR:", error);

      setErrorMessage(
        error?.message ||
          "PDF를 읽는 중 오류가 발생했습니다."
      );
    } finally {
      setLoadingPdf(false);
    }
  };

  const createPlans = async () => {
    if (!pdfText) {
      alert("먼저 PDF를 업로드해줘.");
      return;
    }

    try {
      setLoadingPlan(true);
      setErrorMessage("");
      setResult(null);
      setGeneratedImages({});

      const response = await fetch(
        "/api/high-comic-plan",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            schoolName,
            gradeName,
            lessonName,
            sourceText: pdfText,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.error ||
            "고등 써밋네컷 설계안 생성에 실패했습니다."
        );
      }

      setResult(data);
    } catch (error: any) {
      console.error("HIGH TEST PLAN ERROR:", error);

      setErrorMessage(
        error?.message ||
          "고등 써밋네컷 설계안 생성 중 오류가 발생했습니다."
      );
    } finally {
      setLoadingPlan(false);
    }
  };

  const generateImage = async (
    plan: HighComicPlan
  ) => {
    if (generatingId) {
      return;
    }

    try {
      setGeneratingId(plan.id);
      setErrorMessage("");

      const response = await fetch(
        "/api/generate-high-comic",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            plan,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.error ||
            "고등 써밋네컷 이미지 생성에 실패했습니다."
        );
      }

      if (!data?.image) {
        throw new Error(
          "생성된 이미지가 없습니다."
        );
      }

      setGeneratedImages((prev) => ({
        ...prev,
        [plan.id]: data.image,
      }));
    } catch (error: any) {
      console.error(
        "HIGH IMAGE GENERATION ERROR:",
        error
      );

      setErrorMessage(
        error?.message ||
          "이미지 생성 중 오류가 발생했습니다."
      );
    } finally {
      setGeneratingId("");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-6xl">
        <div>
          <p className="text-sm font-bold text-purple-600">
            HIGH SCHOOL TEST
          </p>

          <h1 className="mt-2 text-4xl font-black text-slate-900">
            고등 써밋네컷 테스트
          </h1>

          <p className="mt-3 text-slate-600">
            PDF → 의미 블록 분할 → 4컷 설계안 →
            원하는 블록만 이미지로 생성
          </p>
        </div>

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-slate-900">
            기본 정보
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-bold text-slate-700">
                학교
              </label>

              <input
                value={schoolName}
                onChange={(e) =>
                  setSchoolName(e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                학년
              </label>

              <input
                value={gradeName}
                onChange={(e) =>
                  setGradeName(e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Lesson
              </label>

              <input
                value={lessonName}
                onChange={(e) =>
                  setLessonName(e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-slate-900">
            1. 고등 본문 PDF 업로드
          </h2>

          <label className="mt-5 inline-block cursor-pointer rounded-xl bg-slate-900 px-6 py-3 font-bold text-white">
            PDF 선택

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

                setFileName(file.name);
                readPdf(file);
              }}
            />
          </label>

          {fileName && (
            <div className="mt-5 rounded-xl bg-slate-100 p-4">
              <p className="text-xs text-slate-500">
                선택된 파일
              </p>

              <p className="mt-1 font-bold text-slate-900">
                {fileName}
              </p>
            </div>
          )}

          {loadingPdf && (
            <div className="mt-5 rounded-xl bg-blue-50 p-4 font-bold text-blue-700">
              PDF 읽는 중...
            </div>
          )}

          {!loadingPdf && pdfText && (
            <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-emerald-700">
              <p className="font-bold">
                PDF 텍스트 추출 완료
              </p>

              <p className="mt-1 text-sm">
                약{" "}
                {pdfText.length.toLocaleString()}자
              </p>
            </div>
          )}
        </section>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {pdfText && (
          <section className="mt-6 rounded-3xl bg-purple-50 p-6 ring-1 ring-purple-200">
            <p className="text-sm font-bold text-purple-600">
              STEP 2
            </p>

            <h2 className="mt-1 text-2xl font-black text-slate-900">
              써밋네컷 설계안 생성
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              여기까지는 텍스트 설계안 생성이야.
            </p>

            <button
              type="button"
              onClick={createPlans}
              disabled={loadingPlan}
              className="mt-5 w-full rounded-xl bg-purple-600 px-6 py-4 text-lg font-black text-white disabled:opacity-50"
            >
              {loadingPlan
                ? "고등 설계안 생성 중..."
                : "고등 써밋네컷 설계안 만들기"}
            </button>
          </section>
        )}

        {result && (
          <section className="mt-10">
            <div className="rounded-3xl bg-slate-900 p-6 text-white">
              <p className="text-sm font-bold text-purple-300">
                RESULT
              </p>

              <h2 className="mt-1 text-3xl font-black">
                {result.overallTitle}
              </h2>

              <p className="mt-3 leading-7 text-slate-300">
                {result.overallSummary}
              </p>

              <div className="mt-5 inline-flex rounded-full bg-white/10 px-4 py-2 font-bold">
                총{" "}
                {result.blockCount ||
                  result.plans.length}
                개 써밋네컷
              </div>
            </div>

            <div className="mt-8 space-y-10">
              {result.plans.map(
                (plan, planIndex) => (
                  <article
                    key={
                      plan.id || planIndex
                    }
                    className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200"
                  >
                    <div className="bg-slate-900 p-6 text-white">
                      <p className="text-sm font-bold text-purple-300">
                        BLOCK {planIndex + 1}
                      </p>

                      <h3 className="mt-2 text-3xl font-black">
                        {plan.englishTitle}
                      </h3>

                      <p className="mt-2 text-xl font-bold text-slate-200">
                        {plan.koreanSubtitle}
                      </p>
                    </div>

                    <div className="p-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-5">
                          <p className="text-xs font-bold text-slate-500">
                            SOURCE RANGE
                          </p>

                          <p className="mt-2 font-bold text-slate-800">
                            {plan.sourceRange}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-5">
                          <p className="text-xs font-bold text-slate-500">
                            BLOCK SUMMARY
                          </p>

                          <p className="mt-2 leading-6 text-slate-700">
                            {plan.blockSummary}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5">
                        <p className="text-sm font-black text-slate-800">
                          핵심 어휘
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {plan.keyWords?.map(
                            (
                              word,
                              wordIndex
                            ) => (
                              <span
                                key={`${word}-${wordIndex}`}
                                className="rounded-full bg-purple-100 px-4 py-2 text-sm font-bold text-purple-700"
                              >
                                {word}
                              </span>
                            )
                          )}
                        </div>
                      </div>

                      <div className="mt-8 grid gap-5 md:grid-cols-2">
                        {plan.panels.map(
                          (
                            panel,
                            panelIndex
                          ) => (
                            <div
                              key={panelIndex}
                              className="rounded-2xl border border-slate-200 p-5"
                            >
                              <h4 className="text-xl font-black text-slate-900">
                                {panel.cut}
                              </h4>

                              <div className="mt-4">
                                <p className="text-xs font-bold text-blue-600">
                                  장면
                                </p>

                                <p className="mt-1 leading-6 text-slate-700">
                                  {panel.scene}
                                </p>
                              </div>

                              <div className="mt-4">
                                <p className="text-xs font-bold text-emerald-600">
                                  등장인물
                                </p>

                                <p className="mt-1 leading-6 text-slate-700">
                                  {
                                    panel.characters
                                  }
                                </p>
                              </div>

                              <div className="mt-5 space-y-3">
                                {panel.dialogue?.map(
                                  (
                                    dialogue,
                                    dialogueIndex
                                  ) => (
                                    <div
                                      key={
                                        dialogueIndex
                                      }
                                      className="rounded-xl bg-slate-50 p-4"
                                    >
                                      <p className="text-xs font-black text-purple-600">
                                        {
                                          dialogue.speaker
                                        }
                                      </p>

                                      <p className="mt-1 text-lg font-bold leading-7 text-slate-900">
                                        {
                                          dialogue.text
                                        }
                                      </p>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>

                      <div className="mt-8 border-t border-slate-200 pt-6">
                        <button
                          type="button"
                          onClick={() =>
                            generateImage(plan)
                          }
                          disabled={
                            Boolean(
                              generatingId
                            )
                          }
                          className="w-full rounded-2xl bg-pink-600 px-6 py-4 text-lg font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {generatingId ===
                          plan.id
                            ? "고등 써밋네컷 이미지 생성 중..."
                            : generatedImages[
                                  plan.id
                                ]
                              ? "이 설계안 이미지 다시 생성"
                              : "이 설계안으로 이미지 생성"}
                        </button>

                        <p className="mt-3 text-center text-xs font-semibold text-slate-500">
                          ⚠️ 이 버튼을 누를 때마다
                          이미지 1장 생성 비용이
                          발생해.
                        </p>
                      </div>

                      {generatedImages[
                        plan.id
                      ] && (
                        <div className="mt-6 overflow-hidden rounded-3xl bg-slate-100 p-3">
                          <img
                            src={
                              generatedImages[
                                plan.id
                              ]
                            }
                            alt={`${plan.englishTitle} 써밋네컷`}
                            className="w-full rounded-2xl"
                          />
                        </div>
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}