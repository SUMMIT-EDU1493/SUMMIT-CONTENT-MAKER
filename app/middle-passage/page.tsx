"use client";

import {
  useState,
} from "react";

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

type Panel = {
  cut: string;
  sourceText: string;
  scene: string;
  caption: string;
};

type PassagePlan = {
  id: string;
  passageId: string;
  title: string;
  summary: string;
  panels: Panel[];
  image: string;
  loadingImage: boolean;
};

function makeId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export default function MiddlePassagePage() {
  const [
    schoolName,
    setSchoolName,
  ] = useState("");

  const [
    gradeName,
    setGradeName,
  ] = useState("");

  const [
    lessonName,
    setLessonName,
  ] = useState("");

  const [
    fileName,
    setFileName,
  ] = useState("");

  const [
    pdfText,
    setPdfText,
  ] = useState("");

  const [
    passages,
    setPassages,
  ] = useState<
    Passage[]
  >([]);

  const [
    plans,
    setPlans,
  ] = useState<
    PassagePlan[]
  >([]);

  const [
    loadingPdf,
    setLoadingPdf,
  ] = useState(false);

  const [
    loadingAi,
    setLoadingAi,
  ] = useState(false);

  const [
    creatingPlanId,
    setCreatingPlanId,
  ] = useState("");

  const [
    creatingAllPlans,
    setCreatingAllPlans,
  ] = useState(false);

  const [
    loadingAllImages,
    setLoadingAllImages,
  ] = useState(false);

  const [
    imageProgress,
    setImageProgress,
  ] = useState("");

  const [
    statusText,
    setStatusText,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const readPdf =
    async (
      file: File
    ) => {
      try {
        setLoadingPdf(
          true
        );

        setLoadingAi(
          false
        );

        setCreatingPlanId(
          ""
        );

        setCreatingAllPlans(
          false
        );

        setLoadingAllImages(
          false
        );

        setErrorMessage(
          ""
        );

        setStatusText(
          "PDF를 읽는 중..."
        );

        setPdfText(
          ""
        );

        setPassages(
          []
        );

        setPlans(
          []
        );

        setFileName(
          file.name
        );

        const arrayBuffer =
          await file.arrayBuffer();

        const loadingTask =
          pdfjsLib.getDocument({
            data:
              new Uint8Array(
                arrayBuffer
              ),
          });

        const pdf =
          await loadingTask.promise;

        let fullText =
          "";

        for (
          let pageNumber =
            1;
          pageNumber <=
          pdf.numPages;
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
              .map(
                (
                  item: any
                ) => {
                  if (
                    "str" in
                    item
                  ) {
                    return String(
                      item.str ??
                        ""
                    );
                  }

                  return "";
                }
              )
              .join(
                " "
              );

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

        setPdfText(
          text
        );

        setStatusText(
          `PDF ${pdf.numPages}페이지 읽기 완료`
        );
      } catch (
        error: any
      ) {
        console.error(
          error
        );

        setErrorMessage(
          error?.message ||
            "PDF를 읽는 중 오류가 발생했습니다."
        );

        setStatusText(
          ""
        );
      } finally {
        setLoadingPdf(
          false
        );
      }
    };

  const analyzePassages =
    async () => {
      if (
        !pdfText
      ) {
        alert(
          "먼저 PDF를 선택해 주세요."
        );

        return;
      }

      try {
        setLoadingAi(
          true
        );

        setErrorMessage(
          ""
        );

        setPassages(
          []
        );

        setPlans(
          []
        );

        setStatusText(
          "교재에서 영어 본문을 찾는 중..."
        );

        const response =
          await fetch(
            "/api/middle-passage-analyze",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    text:
                      pdfText,
                  }
                ),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok
        ) {
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
          foundPassages.length ===
          0
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
      } catch (
        error: any
      ) {
        console.error(
          error
        );

        setErrorMessage(
          error?.message ||
            "본문을 찾는 중 오류가 발생했습니다."
        );

        setStatusText(
          ""
        );
      } finally {
        setLoadingAi(
          false
        );
      }
    };

  const requestPlan =
    async (
      passage: Passage
    ) => {
      const response =
        await fetch(
          "/api/middle-passage-plan",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  title:
                    passage.title,

                  content:
                    passage.content,
                }
              ),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data?.detail ||
            data?.error ||
            "써밋네컷 설계에 실패했습니다."
        );
      }

      return data;
    };

  const makePlan =
    async (
      passage: Passage
    ) => {
      try {
        setCreatingPlanId(
          passage.id
        );

        setErrorMessage(
          ""
        );

        setStatusText(
          `"${passage.title}" 4컷 설계 중...`
        );

        const data =
          await requestPlan(
            passage
          );

        const newPlan: PassagePlan =
          {
            id: makeId(),

            passageId:
              passage.id,

            title:
              String(
                data?.title ||
                  passage.title
              ),

            summary:
              String(
                data?.summary ||
                  ""
              ),

            panels:
              Array.isArray(
                data?.panels
              )
                ? data.panels
                : [],

            image:
              "",

            loadingImage:
              false,
          };

        setPlans(
          (
            prev
          ) => {
            const remaining =
              prev.filter(
                (
                  plan
                ) =>
                  plan.passageId !==
                  passage.id
              );

            return [
              ...remaining,
              newPlan,
            ];
          }
        );

        setStatusText(
          `"${passage.title}" 4컷 설계 완료`
        );

        setTimeout(
          () => {
            document
              .getElementById(
                `plan-${passage.id}`
              )
              ?.scrollIntoView(
                {
                  behavior:
                    "smooth",

                  block:
                    "start",
                }
              );
          },
          150
        );
      } catch (
        error: any
      ) {
        console.error(
          error
        );

        setErrorMessage(
          error?.message ||
            "써밋네컷 설계 중 오류가 발생했습니다."
        );

        setStatusText(
          ""
        );
      } finally {
        setCreatingPlanId(
          ""
        );
      }
    };

  const makeAllPlans =
    async () => {
      if (
        passages.length ===
        0
      ) {
        alert(
          "먼저 본문을 찾아 주세요."
        );

        return;
      }

      try {
        setCreatingAllPlans(
          true
        );

        setCreatingPlanId(
          ""
        );

        setErrorMessage(
          ""
        );

        setPlans(
          []
        );

        const newPlans: PassagePlan[] =
          [];

        for (
          let index =
            0;
          index <
          passages.length;
          index++
        ) {
          const passage =
            passages[
              index
            ];

          setStatusText(
            `${index + 1}/${
              passages.length
            } · "${passage.title}" 4컷 설계 중...`
          );

          const data =
            await requestPlan(
              passage
            );

          newPlans.push(
            {
              id: makeId(),

              passageId:
                passage.id,

              title:
                String(
                  data?.title ||
                    passage.title
                ),

              summary:
                String(
                  data?.summary ||
                    ""
                ),

              panels:
                Array.isArray(
                  data?.panels
                )
                  ? data.panels
                  : [],

              image:
                "",

              loadingImage:
                false,
            }
          );

          setPlans([
            ...newPlans,
          ]);
        }

        setStatusText(
          `전체 본문 ${newPlans.length}개 4컷 설계 완료`
        );

        setTimeout(
          () => {
            document
              .getElementById(
                "plans"
              )
              ?.scrollIntoView(
                {
                  behavior:
                    "smooth",

                  block:
                    "start",
                }
              );
          },
          150
        );
      } catch (
        error: any
      ) {
        console.error(
          error
        );

        setErrorMessage(
          error?.message ||
            "전체 써밋네컷 설계 중 오류가 발생했습니다."
        );

        setStatusText(
          ""
        );
      } finally {
        setCreatingAllPlans(
          false
        );
      }
    };

  const requestImage =
    async (
      plan: PassagePlan
    ): Promise<string> => {
      const response =
        await fetch(
          "/api/middle-passage-generate",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  title:
                    plan.title,

                  summary:
                    plan.summary,

                  panels:
                    plan.panels,
                }
              ),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data?.detail ||
            data?.error ||
            "이미지 생성에 실패했습니다."
        );
      }

      if (
        !data?.image
      ) {
        throw new Error(
          "생성된 이미지가 없습니다."
        );
      }

      return data.image;
    };

  const generateImage =
    async (
      planId: string
    ) => {
      const plan =
        plans.find(
          (
            item
          ) =>
            item.id ===
            planId
        );

      if (!plan) {
        return;
      }

      try {
        setErrorMessage(
          ""
        );

        setPlans(
          (
            prev
          ) =>
            prev.map(
              (
                item
              ) =>
                item.id ===
                planId
                  ? {
                      ...item,

                      loadingImage:
                        true,

                      image:
                        "",
                    }
                  : item
            )
        );

        const image =
          await requestImage(
            plan
          );

        setPlans(
          (
            prev
          ) =>
            prev.map(
              (
                item
              ) =>
                item.id ===
                planId
                  ? {
                      ...item,

                      loadingImage:
                        false,

                      image,
                    }
                  : item
            )
        );
      } catch (
        error: any
      ) {
        setPlans(
          (
            prev
          ) =>
            prev.map(
              (
                item
              ) =>
                item.id ===
                planId
                  ? {
                      ...item,

                      loadingImage:
                        false,
                    }
                  : item
            )
        );

        setErrorMessage(
          error?.message ||
            "이미지 생성 중 오류가 발생했습니다."
        );
      }
    };

  const generateAllImages =
    async () => {
      const targets =
        plans.filter(
          (
            plan
          ) =>
            !plan.image
        );

      if (
        plans.length ===
        0
      ) {
        alert(
          "먼저 설계안을 만들어 주세요."
        );

        return;
      }

      if (
        targets.length ===
        0
      ) {
        alert(
          "모든 설계안의 이미지가 이미 생성되어 있습니다."
        );

        return;
      }

      try {
        setLoadingAllImages(
          true
        );

        setErrorMessage(
          ""
        );

        for (
          let index =
            0;
          index <
          targets.length;
          index++
        ) {
          const target =
            targets[
              index
            ];

          setImageProgress(
            `${index + 1}/${targets.length} · ${target.title}`
          );

          setPlans(
            (
              prev
            ) =>
              prev.map(
                (
                  item
                ) =>
                  item.id ===
                  target.id
                    ? {
                        ...item,

                        loadingImage:
                          true,
                      }
                    : item
              )
          );

          const image =
            await requestImage(
              target
            );

          setPlans(
            (
              prev
            ) =>
              prev.map(
                (
                  item
                ) =>
                  item.id ===
                  target.id
                    ? {
                        ...item,

                        loadingImage:
                          false,

                        image,
                      }
                    : item
              )
          );
        }

        setImageProgress(
          "전체 이미지 생성 완료!"
        );
      } catch (
        error: any
      ) {
        setErrorMessage(
          error?.message ||
            "전체 이미지 생성 중 오류가 발생했습니다."
        );

        setPlans(
          (
            prev
          ) =>
            prev.map(
              (
                item
              ) => ({
                ...item,

                loadingImage:
                  false,
              })
            )
        );
      } finally {
        setLoadingAllImages(
          false
        );

        setTimeout(
          () => {
            setImageProgress(
              ""
            );
          },
          2000
        );
      }
    };

  const deletePassage =
    (
      id: string
    ) => {
      setPassages(
        (
          prev
        ) =>
          prev.filter(
            (
              passage
            ) =>
              passage.id !==
              id
          )
      );

      setPlans(
        (
          prev
        ) =>
          prev.filter(
            (
              plan
            ) =>
              plan.passageId !==
              id
          )
      );
    };

  const updateTitle =
    (
      id: string,
      value: string
    ) => {
      setPassages(
        (
          prev
        ) =>
          prev.map(
            (
              passage
            ) =>
              passage.id ===
              id
                ? {
                    ...passage,
                    title:
                      value,
                  }
                : passage
          )
      );
    };

  const updateContent =
    (
      id: string,
      value: string
    ) => {
      setPassages(
        (
          prev
        ) =>
          prev.map(
            (
              passage
            ) =>
              passage.id ===
              id
                ? {
                    ...passage,
                    content:
                      value,
                  }
                : passage
          )
      );
    };

  const updatePlanSummary =
    (
      planId: string,
      value: string
    ) => {
      setPlans(
        (
          prev
        ) =>
          prev.map(
            (
              plan
            ) =>
              plan.id ===
              planId
                ? {
                    ...plan,

                    summary:
                      value,

                    image:
                      "",
                  }
                : plan
          )
      );
    };

  const updatePanel =
    (
      planId: string,
      panelIndex: number,
      field:
        | "sourceText"
        | "scene"
        | "caption",
      value: string
    ) => {
      setPlans(
        (
          prev
        ) =>
          prev.map(
            (
              plan
            ) => {
              if (
                plan.id !==
                planId
              ) {
                return plan;
              }

              const panels =
                [
                  ...plan.panels,
                ];

              panels[
                panelIndex
              ] = {
                ...panels[
                  panelIndex
                ],

                [field]:
                  value,
              };

              return {
                ...plan,
                panels,
                image:
                  "",
              };
            }
          )
      );
    };

  const generatedImageCount =
    plans.filter(
      (
        plan
      ) =>
        Boolean(
          plan.image
        )
    ).length;

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
            교재의 본문을 찾아 흐름이 한눈에 보이는 써밋네컷으로 제작합니다.
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
                value={
                  schoolName
                }
                onChange={(
                  e
                ) =>
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
                value={
                  gradeName
                }
                onChange={(
                  e
                ) =>
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
                value={
                  lessonName
                }
                onChange={(
                  e
                ) =>
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
          <p className="text-xs font-black tracking-[0.18em] text-emerald-700">
            STEP 1
          </p>

          <h2 className="mt-1 text-2xl font-black text-slate-950">
            교재 PDF 업로드
          </h2>

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
                  {
                    fileName
                  }
                </p>
              )}
            </div>

            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(
                e
              ) => {
                const file =
                  e.target.files?.[0];

                if (
                  !file
                ) {
                  return;
                }

                readPdf(
                  file
                );

                e.target.value =
                  "";
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
            {
              statusText
            }
          </div>
        )}

        {errorMessage && (
          <div className="mt-5 rounded-2xl bg-red-50 px-5 py-4 font-bold text-red-700 ring-1 ring-red-100">
            {
              errorMessage
            }
          </div>
        )}

        {passages.length >
          0 && (
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-emerald-700">
                  STEP 2
                </p>

                <h2 className="mt-1 text-3xl font-black text-slate-950">
                  발견된 본문
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  본문을 확인하고 필요 없는 것은 삭제해 주세요.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  makeAllPlans
                }
                disabled={
                  creatingAllPlans ||
                  Boolean(
                    creatingPlanId
                  )
                }
                className="rounded-2xl bg-emerald-700 px-6 py-3 font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-40"
              >
                {creatingAllPlans
                  ? "전체 설계 중..."
                  : "남은 본문 전체 4컷 설계"}
              </button>
            </div>

            <div className="mt-6 grid gap-6">
              {passages.map(
                (
                  passage,
                  index
                ) => {
                  const hasPlan =
                    plans.some(
                      (
                        plan
                      ) =>
                        plan.passageId ===
                        passage.id
                    );

                  return (
                    <article
                      key={
                        passage.id
                      }
                      className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-800">
                            {index +
                              1}
                          </span>

                          <p className="font-black text-slate-900">
                            본문{" "}
                            {index +
                              1}
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
                        onChange={(
                          e
                        ) =>
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
                        onChange={(
                          e
                        ) =>
                          updateContent(
                            passage.id,
                            e.target.value
                          )
                        }
                        rows={
                          12
                        }
                        className="mt-4 w-full resize-y rounded-2xl border border-slate-200 bg-white px-5 py-5 text-[15px] leading-7 text-slate-800 outline-none focus:border-emerald-400"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          makePlan(
                            passage
                          )
                        }
                        disabled={
                          creatingAllPlans ||
                          Boolean(
                            creatingPlanId
                          )
                        }
                        className={`mt-5 w-full rounded-2xl px-6 py-4 text-lg font-black text-white transition disabled:opacity-40 ${
                          hasPlan
                            ? "bg-slate-600 hover:bg-slate-700"
                            : "bg-slate-950 hover:bg-emerald-700"
                        }`}
                      >
                        {creatingPlanId ===
                        passage.id
                          ? "4컷 설계 중..."
                          : hasPlan
                          ? "4컷 설계 다시 만들기"
                          : "이 본문 4컷 설계"}
                      </button>
                    </article>
                  );
                }
              )}
            </div>
          </section>
        )}

        {plans.length >
          0 && (
          <section
            id="plans"
            className="mt-10"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-emerald-700">
                  STEP 3
                </p>

                <h2 className="mt-1 text-3xl font-black text-slate-950">
                  써밋네컷 설계안
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  장면을 확인한 뒤 이미지를 생성해 주세요.
                </p>
              </div>

              <div className="rounded-full bg-slate-950 px-5 py-2 text-sm font-black text-white">
                이미지{" "}
                {
                  generatedImageCount
                }
                /
                {
                  plans.length
                }
              </div>
            </div>

            <div className="mt-6 grid gap-8">
              {plans.map(
                (
                  plan,
                  planIndex
                ) => (
                  <article
                    key={
                      plan.id
                    }
                    id={`plan-${plan.passageId}`}
                    className="scroll-mt-6 rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8"
                  >
                    <h3 className="text-3xl font-black text-slate-950">
                      {
                        plan.title
                      }
                    </h3>

                    <div className="mt-5 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
                      <p className="text-xs font-black tracking-widest text-emerald-700">
                        전체 핵심
                      </p>

                      <textarea
                        value={
                          plan.summary
                        }
                        onChange={(
                          e
                        ) =>
                          updatePlanSummary(
                            plan.id,
                            e.target.value
                          )
                        }
                        rows={
                          3
                        }
                        className="mt-3 w-full resize-y rounded-xl border border-emerald-200 bg-white px-4 py-3 font-bold leading-6 text-slate-800 outline-none"
                      />
                    </div>

                    <div className="mt-6 grid gap-5 md:grid-cols-2">
                      {plan.panels.map(
                        (
                          panel,
                          panelIndex
                        ) => (
                          <div
                            key={`${plan.id}-${panelIndex}`}
                            className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
                          >
                            <div className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
                              {
                                panel.cut
                              }
                            </div>

                            <div className="mt-5">
                              <label className="text-xs font-black tracking-wider text-slate-500">
                                ORIGINAL TEXT
                              </label>

                              <textarea
                                value={
                                  panel.sourceText
                                }
                                onChange={(
                                  e
                                ) =>
                                  updatePanel(
                                    plan.id,
                                    panelIndex,
                                    "sourceText",
                                    e.target.value
                                  )
                                }
                                rows={
                                  7
                                }
                                className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-emerald-400"
                              />
                            </div>

                            <div className="mt-4">
                              <label className="text-xs font-black tracking-wider text-emerald-700">
                                SCENE
                              </label>

                              <textarea
                                value={
                                  panel.scene
                                }
                                onChange={(
                                  e
                                ) =>
                                  updatePanel(
                                    plan.id,
                                    panelIndex,
                                    "scene",
                                    e.target.value
                                  )
                                }
                                rows={
                                  5
                                }
                                className="mt-2 w-full resize-y rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-emerald-400"
                              />
                            </div>

                            <div className="mt-4">
                              <label className="text-xs font-black tracking-wider text-amber-700">
                                CAPTION
                              </label>

                              <textarea
                                value={
                                  panel.caption
                                }
                                onChange={(
                                  e
                                ) =>
                                  updatePanel(
                                    plan.id,
                                    panelIndex,
                                    "caption",
                                    e.target.value
                                  )
                                }
                                rows={
                                  3
                                }
                                className="mt-2 w-full resize-y rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-bold leading-6 text-slate-800 outline-none focus:border-amber-400"
                              />
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        generateImage(
                          plan.id
                        )
                      }
                      disabled={
                        plan.loadingImage ||
                        loadingAllImages
                      }
                      className="mt-6 w-full rounded-2xl bg-violet-600 px-6 py-4 text-lg font-black text-white transition hover:bg-violet-700 disabled:opacity-40"
                    >
                      {plan.loadingImage
                        ? "이미지 생성 중..."
                        : plan.image
                        ? "이 이미지 다시 생성"
                        : `설계안 ${
                            planIndex +
                            1
                          } 이미지 생성`}
                    </button>

                    {plan.image && (
                      <div className="mt-6">
                        <img
                          src={
                            plan.image
                          }
                          alt="중등 본문 써밋네컷"
                          className="w-full rounded-2xl border border-slate-200 bg-white"
                        />
                      </div>
                    )}
                  </article>
                )
              )}
            </div>

            <div className="mt-8 rounded-[30px] bg-slate-950 p-7 text-white">
              <p className="text-xs font-black tracking-[0.18em] text-emerald-300">
                ALL COMIC PLANS CHECKED
              </p>

              <h3 className="mt-2 text-2xl font-black">
                설계안 확인 다 했어?
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                확인이 끝난 설계안을 위에서부터 순서대로 한 장씩 생성합니다.
              </p>

              <button
                type="button"
                onClick={
                  generateAllImages
                }
                disabled={
                  loadingAllImages
                }
                className="mt-5 w-full rounded-2xl bg-violet-500 px-6 py-4 text-lg font-black text-white disabled:opacity-40"
              >
                {loadingAllImages
                  ? `전체 이미지 생성 중 · ${imageProgress}`
                  : `확인한 설계안 전체 이미지 생성 · ${
                      plans.length -
                      generatedImageCount
                    }개 남음`}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}