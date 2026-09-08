"use client";

import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import HomeButton from "../components/HomeButton";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type Passage = {
  id: string;
  title: string;
  content: string;
};

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

type PassagePlan = {
  id: string;
  passageId: string;
  title: string;
  summary: string;
  panels: ComicPanel[];
  image: string;
  loadingImage: boolean;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function MiddlePassagePage() {
  const [schoolName, setSchoolName] = useState("");
  const [gradeName, setGradeName] = useState("");
  const [lessonName, setLessonName] = useState("");
  const [fileName, setFileName] = useState("");
  const [pdfText, setPdfText] = useState("");
  const [passages, setPassages] = useState<Passage[]>([]);
  const [plans, setPlans] = useState<PassagePlan[]>([]);

  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [creatingPlanId, setCreatingPlanId] = useState("");
  const [creatingAllPlans, setCreatingAllPlans] = useState(false);
  const [loadingAllImages, setLoadingAllImages] = useState(false);

  const [imageProgress, setImageProgress] = useState("");
  const [statusText, setStatusText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const readPdf = async (file: File) => {
    try {
      setLoadingPdf(true);
      setErrorMessage("");
      setPdfText("");
      setPassages([]);
      setPlans([]);
      setFileName(file.name);
      setStatusText("PDF를 읽는 중...");

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
              return String(item.str ?? "");
            }

            return "";
          })
          .join(" ");

        fullText += `

--- ${pageNumber}페이지 ---

${pageText}
`;
      }

      const text = fullText.trim();

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

  const analyzePassages = async () => {
    if (!pdfText) {
      alert("먼저 PDF를 선택해 주세요.");
      return;
    }

    try {
      setLoadingAi(true);
      setErrorMessage("");
      setPassages([]);
      setPlans([]);

      setStatusText(
        "교재에서 영어 본문을 찾는 중..."
      );

      const response = await fetch(
        "/api/middle-passage-analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: pdfText,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.error ||
            "본문 분석에 실패했습니다."
        );
      }

      const foundPassages = Array.isArray(
        data?.passages
      )
        ? data.passages
        : [];

      if (foundPassages.length === 0) {
        throw new Error(
          "본문을 찾지 못했습니다."
        );
      }

      const nextPassages: Passage[] =
        foundPassages.map((passage: any) => ({
          id: makeId(),
          title: String(
            passage?.title || "본문"
          ).trim(),
          content: String(
            passage?.content || ""
          ).trim(),
        }));

      setPassages(nextPassages);

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

  const requestPlan = async (
    passage: Passage
  ) => {
    const response = await fetch(
      "/api/middle-passage-plan",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: passage.title,
          content: passage.content,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.detail ||
          data?.error ||
          "써밋네컷 설계에 실패했습니다."
      );
    }

    return data;
  };

  const makePlan = async (
    passage: Passage
  ) => {
    try {
      setCreatingPlanId(passage.id);
      setErrorMessage("");

      setStatusText(
        `"${passage.title}" 설계 중...`
      );

      const data = await requestPlan(passage);

      const newPlan: PassagePlan = {
        id: makeId(),
        passageId: passage.id,
        title: String(
          data?.title || passage.title
        ),
        summary: String(data?.summary || ""),
        panels: Array.isArray(data?.panels)
          ? data.panels
          : [],
        image: "",
        loadingImage: false,
      };

      setPlans((prev) => [
        ...prev.filter(
          (plan) =>
            plan.passageId !== passage.id
        ),
        newPlan,
      ]);

      setStatusText(
        `"${passage.title}" 설계 완료`
      );

      setTimeout(() => {
        document
          .getElementById(
            `plan-${passage.id}`
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 150);
    } catch (error: any) {
      console.error(error);

      setErrorMessage(
        error?.message ||
          "써밋네컷 설계 중 오류가 발생했습니다."
      );

      setStatusText("");
    } finally {
      setCreatingPlanId("");
    }
  };

  const makeAllPlans = async () => {
    if (passages.length === 0) {
      alert("먼저 본문을 찾아 주세요.");
      return;
    }

    try {
      setCreatingAllPlans(true);
      setErrorMessage("");
      setPlans([]);

      const newPlans: PassagePlan[] = [];

      for (
        let index = 0;
        index < passages.length;
        index++
      ) {
        const passage = passages[index];

        setStatusText(
          `${index + 1}/${passages.length} · ${passage.title}`
        );

        const data = await requestPlan(passage);

        newPlans.push({
          id: makeId(),
          passageId: passage.id,
          title: String(
            data?.title || passage.title
          ),
          summary: String(
            data?.summary || ""
          ),
          panels: Array.isArray(data?.panels)
            ? data.panels
            : [],
          image: "",
          loadingImage: false,
        });

        setPlans([...newPlans]);
      }

      setStatusText("전체 설계 완료");
    } catch (error: any) {
      console.error(error);

      setErrorMessage(
        error?.message ||
          "전체 설계 중 오류가 발생했습니다."
      );
    } finally {
      setCreatingAllPlans(false);
    }
  };

  const requestImage = async (
    plan: PassagePlan
  ): Promise<string> => {
    const response = await fetch(
      "/api/generate-comic",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: plan.title,
          summary: plan.summary,
          panels: plan.panels,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.detail ||
          data?.error ||
          "이미지 생성에 실패했습니다."
      );
    }

    if (!data?.image) {
      throw new Error(
        "생성된 이미지가 없습니다."
      );
    }

    return data.image;
  };

  const generateImage = async (
    planId: string
  ) => {
    const plan = plans.find(
      (item) => item.id === planId
    );

    if (!plan) {
      return;
    }

    try {
      setErrorMessage("");

      setPlans((prev) =>
        prev.map((item) =>
          item.id === planId
            ? {
                ...item,
                loadingImage: true,
                image: "",
              }
            : item
        )
      );

      const image = await requestImage(plan);

      setPlans((prev) =>
        prev.map((item) =>
          item.id === planId
            ? {
                ...item,
                loadingImage: false,
                image,
              }
            : item
        )
      );
    } catch (error: any) {
      console.error(error);

      setPlans((prev) =>
        prev.map((item) =>
          item.id === planId
            ? {
                ...item,
                loadingImage: false,
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

  const generateAllImages = async () => {
    const targets = plans.filter(
      (plan) => !plan.image
    );

    if (plans.length === 0) {
      alert("먼저 설계안을 만들어 주세요.");
      return;
    }

    if (targets.length === 0) {
      alert(
        "모든 설계안의 이미지가 이미 생성되어 있습니다."
      );
      return;
    }

    try {
      setLoadingAllImages(true);
      setErrorMessage("");

      for (
        let index = 0;
        index < targets.length;
        index++
      ) {
        const target = targets[index];

        setImageProgress(
          `${index + 1}/${targets.length} · ${target.title}`
        );

        setPlans((prev) =>
          prev.map((item) =>
            item.id === target.id
              ? {
                  ...item,
                  loadingImage: true,
                }
              : item
          )
        );

        const image =
          await requestImage(target);

        setPlans((prev) =>
          prev.map((item) =>
            item.id === target.id
              ? {
                  ...item,
                  loadingImage: false,
                  image,
                }
              : item
          )
        );
      }

      setImageProgress(
        "전체 이미지 생성 완료"
      );
    } catch (error: any) {
      console.error(error);

      setErrorMessage(
        error?.message ||
          "전체 이미지 생성 중 오류가 발생했습니다."
      );

      setPlans((prev) =>
        prev.map((item) => ({
          ...item,
          loadingImage: false,
        }))
      );
    } finally {
      setLoadingAllImages(false);
    }
  };

  const updateSummary = (
    planId: string,
    value: string
  ) => {
    setPlans((prev) =>
      prev.map((plan) =>
        plan.id === planId
          ? {
              ...plan,
              summary: value,
              image: "",
            }
          : plan
      )
    );
  };

  const updateScene = (
    planId: string,
    panelIndex: number,
    value: string
  ) => {
    setPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== planId) {
          return plan;
        }

        const panels = [...plan.panels];

        panels[panelIndex] = {
          ...panels[panelIndex],
          scene: value,
        };

        return {
          ...plan,
          panels,
          image: "",
        };
      })
    );
  };

  const updateCharacters = (
    planId: string,
    panelIndex: number,
    value: string
  ) => {
    setPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== planId) {
          return plan;
        }

        const panels = [...plan.panels];

        panels[panelIndex] = {
          ...panels[panelIndex],
          characters: value,
        };

        return {
          ...plan,
          panels,
          image: "",
        };
      })
    );
  };

  const updateDialogue = (
    planId: string,
    panelIndex: number,
    dialogueIndex: number,
    field: "speaker" | "text",
    value: string
  ) => {
    setPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== planId) {
          return plan;
        }

        const panels = [...plan.panels];

        const dialogue = [
          ...panels[panelIndex].dialogue,
        ];

        dialogue[dialogueIndex] = {
          ...dialogue[dialogueIndex],
          [field]: value,
        };

        panels[panelIndex] = {
          ...panels[panelIndex],
          dialogue,
        };

        return {
          ...plan,
          panels,
          image: "",
        };
      })
    );
  };

  const addDialogue = (
    planId: string,
    panelIndex: number
  ) => {
    setPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== planId) {
          return plan;
        }

        const panels = [...plan.panels];

        panels[panelIndex] = {
          ...panels[panelIndex],
          dialogue: [
            ...panels[panelIndex].dialogue,
            {
              speaker: "",
              text: "",
            },
          ],
        };

        return {
          ...plan,
          panels,
          image: "",
        };
      })
    );
  };

  const removeDialogue = (
    planId: string,
    panelIndex: number,
    dialogueIndex: number
  ) => {
    setPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== planId) {
          return plan;
        }

        const panels = [...plan.panels];

        panels[panelIndex] = {
          ...panels[panelIndex],
          dialogue: panels[
            panelIndex
          ].dialogue.filter(
            (_, index) =>
              index !== dialogueIndex
          ),
        };

        return {
          ...plan,
          panels,
          image: "",
        };
      })
    );
  };

  const deletePassage = (
    passageId: string
  ) => {
    setPassages((prev) =>
      prev.filter(
        (passage) =>
          passage.id !== passageId
      )
    );

    setPlans((prev) =>
      prev.filter(
        (plan) =>
          plan.passageId !== passageId
      )
    );
  };

  const generatedImageCount =
    plans.filter((plan) =>
      Boolean(plan.image)
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

          <h1 className="mt-2 text-4xl font-black text-slate-950 md:text-5xl">
            본문 써밋네컷
          </h1>

          <p className="mt-3 text-slate-600">
            영어 본문의 흐름을 네컷 학습만화로 만듭니다.
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
            <input
              value={schoolName}
              onChange={(e) =>
                setSchoolName(e.target.value)
              }
              placeholder="학교"
              className="rounded-xl border border-slate-300 px-4 py-3"
            />

            <input
              value={gradeName}
              onChange={(e) =>
                setGradeName(e.target.value)
              }
              placeholder="학년"
              className="rounded-xl border border-slate-300 px-4 py-3"
            />

            <input
              value={lessonName}
              onChange={(e) =>
                setLessonName(e.target.value)
              }
              placeholder="Lesson"
              className="rounded-xl border border-slate-300 px-4 py-3"
            />
          </div>
        </section>

        <section className="mt-6 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <p className="text-xs font-black tracking-[0.18em] text-emerald-700">
            STEP 1
          </p>

          <h2 className="mt-1 text-2xl font-black">
            교재 PDF
          </h2>

          <label className="mt-5 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
            <div>
              <p className="font-black">
                PDF 파일 선택
              </p>

              <p className="mt-2 text-sm text-slate-500">
                교과서 또는 부교재 PDF
              </p>

              {fileName && (
                <p className="mt-3 text-sm font-bold text-emerald-700">
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

                if (file) {
                  readPdf(file);
                }

                e.target.value = "";
              }}
            />
          </label>

          {pdfText && !loadingPdf && (
            <button
              type="button"
              onClick={analyzePassages}
              disabled={loadingAi}
              className="mt-5 w-full rounded-xl bg-slate-950 px-6 py-4 font-black text-white disabled:opacity-50"
            >
              {loadingAi
                ? "본문 찾는 중..."
                : "영어 본문 찾기"}
            </button>
          )}
        </section>

        {statusText && (
          <div className="mt-5 rounded-xl bg-emerald-50 p-4 font-bold text-emerald-800">
            {statusText}
          </div>
        )}

        {errorMessage && (
          <div className="mt-5 rounded-xl bg-red-50 p-4 font-bold text-red-700">
            {errorMessage}
          </div>
        )}

        {passages.length > 0 && (
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-emerald-700">
                  STEP 2
                </p>

                <h2 className="mt-1 text-3xl font-black">
                  발견된 본문
                </h2>
              </div>

              <button
                type="button"
                onClick={makeAllPlans}
                disabled={
                  creatingAllPlans ||
                  Boolean(creatingPlanId)
                }
                className="rounded-xl bg-emerald-700 px-5 py-3 font-black text-white disabled:opacity-50"
              >
                {creatingAllPlans
                  ? "전체 설계 중..."
                  : "전체 설계안 만들기"}
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {passages.map(
                (passage, index) => (
                  <div
                    key={passage.id}
                    className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-black">
                        본문 {index + 1} ·{" "}
                        {passage.title}
                      </h3>

                      <button
                        type="button"
                        onClick={() =>
                          deletePassage(
                            passage.id
                          )
                        }
                        className="rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-600"
                      >
                        삭제
                      </button>
                    </div>

                    <textarea
                      value={passage.content}
                      onChange={(e) =>
                        setPassages((prev) =>
                          prev.map((item) =>
                            item.id ===
                            passage.id
                              ? {
                                  ...item,
                                  content:
                                    e.target
                                      .value,
                                }
                              : item
                          )
                        )
                      }
                      rows={10}
                      className="mt-4 w-full rounded-xl border border-slate-300 p-4 leading-7"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        makePlan(passage)
                      }
                      disabled={
                        Boolean(
                          creatingPlanId
                        ) ||
                        creatingAllPlans
                      }
                      className="mt-4 w-full rounded-xl bg-slate-950 px-5 py-4 font-black text-white disabled:opacity-50"
                    >
                      {creatingPlanId ===
                      passage.id
                        ? "설계 중..."
                        : "써밋네컷 설계"}
                    </button>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {plans.length > 0 && (
          <section className="mt-10">
            <div className="mb-6">
              <p className="text-sm font-bold text-purple-600">
                SUMMIT FOUR-CUT EDITOR
              </p>

              <h2 className="mt-1 text-3xl font-black">
                써밋네컷 설계안
              </h2>

              <p className="mt-2 text-slate-600">
                현재 {plans.length}개 설계안 ·
                이미지 {generatedImageCount}개
                생성됨
              </p>
            </div>

            <div className="space-y-10">
              {plans.map(
                (plan, planIndex) => (
                  <div
                    id={`plan-${plan.passageId}`}
                    key={plan.id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="bg-slate-900 p-6 text-white">
                      <p className="text-sm font-bold text-purple-300">
                        설계안{" "}
                        {planIndex + 1}
                      </p>

                      <h3 className="mt-1 text-2xl font-black">
                        {plan.title}
                      </h3>
                    </div>

                    <div className="p-6">
                      <label className="text-sm font-bold">
                        만화 상단 한줄 제목
                      </label>

                      <input
                        value={plan.summary}
                        maxLength={22}
                        onChange={(e) =>
                          updateSummary(
                            plan.id,
                            e.target.value
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-xl font-bold"
                      />

                      <p className="mt-1 text-right text-xs text-slate-400">
                        {plan.summary.length}
                        /22
                      </p>

                      <div className="mt-6 grid gap-6 md:grid-cols-2">
                        {plan.panels.map(
                          (
                            panel,
                            panelIndex
                          ) => (
                            <div
                              key={
                                panelIndex
                              }
                              className="rounded-2xl border border-slate-200 p-5"
                            >
                              <h4 className="text-xl font-black">
                                {panel.cut}
                              </h4>

                              <label className="mt-4 block text-sm font-bold">
                                장면 설명
                              </label>

                              <textarea
                                value={
                                  panel.scene
                                }
                                onChange={(e) =>
                                  updateScene(
                                    plan.id,
                                    panelIndex,
                                    e.target.value
                                  )
                                }
                                rows={4}
                                className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                              />

                              <label className="mt-4 block text-sm font-bold">
                                등장인물
                              </label>

                              <textarea
                                value={
                                  panel.characters
                                }
                                onChange={(e) =>
                                  updateCharacters(
                                    plan.id,
                                    panelIndex,
                                    e.target.value
                                  )
                                }
                                rows={3}
                                className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                              />

                              <div className="mt-5 space-y-3">
                                {panel.dialogue.map(
                                  (
                                    dialogue,
                                    dialogueIndex
                                  ) => (
                                    <div
                                      key={
                                        dialogueIndex
                                      }
                                      className="rounded-xl bg-purple-50 p-4"
                                    >
                                      <div className="grid gap-2 md:grid-cols-[140px_1fr]">
                                        <input
                                          value={
                                            dialogue.speaker
                                          }
                                          onChange={(
                                            e
                                          ) =>
                                            updateDialogue(
                                              plan.id,
                                              panelIndex,
                                              dialogueIndex,
                                              "speaker",
                                              e.target
                                                .value
                                            )
                                          }
                                          placeholder="화자"
                                          className="rounded-lg border border-purple-200 px-3 py-2 font-bold"
                                        />

                                        <input
                                          value={
                                            dialogue.text
                                          }
                                          onChange={(
                                            e
                                          ) =>
                                            updateDialogue(
                                              plan.id,
                                              panelIndex,
                                              dialogueIndex,
                                              "text",
                                              e.target
                                                .value
                                            )
                                          }
                                          placeholder="대사"
                                          className="rounded-lg border border-purple-200 px-3 py-2"
                                        />
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeDialogue(
                                            plan.id,
                                            panelIndex,
                                            dialogueIndex
                                          )
                                        }
                                        className="mt-2 text-xs font-bold text-red-500"
                                      >
                                        대사 삭제
                                      </button>
                                    </div>
                                  )
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  addDialogue(
                                    plan.id,
                                    panelIndex
                                  )
                                }
                                className="mt-3 rounded-lg border border-purple-300 px-3 py-2 text-sm font-bold text-purple-700"
                              >
                                + 대사 추가
                              </button>
                            </div>
                          )
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          generateImage(plan.id)
                        }
                        disabled={
                          plan.loadingImage ||
                          loadingAllImages
                        }
                        className="mt-6 w-full rounded-xl bg-purple-600 px-6 py-4 text-lg font-black text-white disabled:opacity-50"
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
                        <img
                          src={plan.image}
                          alt="써밋네컷"
                          className="mt-6 w-full rounded-xl"
                        />
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="mt-10 rounded-3xl bg-slate-900 p-6 text-white">
              <p className="text-sm font-bold text-purple-300">
                ALL COMIC PLANS CHECKED
              </p>

              <h3 className="mt-1 text-2xl font-black">
                설계안 확인 다 했어?
              </h3>

              <button
                type="button"
                onClick={generateAllImages}
                disabled={loadingAllImages}
                className="mt-5 w-full rounded-xl bg-purple-500 px-6 py-4 text-lg font-black text-white disabled:opacity-50"
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