"use client";

import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { jsPDF } from "jspdf";
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

type WorkItem = {
  id: string;
  title: string;
  summary: string;
  image: string;
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

  const [plans, setPlans] =
    useState<PassagePlan[]>([]);

  const [workItems, setWorkItems] =
    useState<WorkItem[]>([]);

  const [loadingPdf, setLoadingPdf] =
    useState(false);

  const [loadingAi, setLoadingAi] =
    useState(false);

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
    loadingBackCover,
    setLoadingBackCover,
  ] = useState(false);

  const [backCoverImage, setBackCoverImage] =
    useState("");

  const [backCoverText, setBackCoverText] =
    useState("");

  const [makingPdf, setMakingPdf] =
    useState(false);

  const [
    imageProgress,
    setImageProgress,
  ] = useState("");

  const [statusText, setStatusText] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    addedPlanId,
    setAddedPlanId,
  ] = useState("");

  const [
    allAddedFeedback,
    setAllAddedFeedback,
  ] = useState(false);

  const goToContentSelection = () => {
    if (
      document.referrer &&
      document.referrer.startsWith(
        window.location.origin
      )
    ) {
      window.history.back();
      return;
    }

    window.location.href = "/";
  };

  const resetBackCover = () => {
    setBackCoverImage("");
    setBackCoverText("");
  };

  const readPdf = async (file: File) => {
    try {
      setLoadingPdf(true);
      setErrorMessage("");
      setPdfText("");
      setPassages([]);
      setPlans([]);
      setWorkItems([]);
      resetBackCover();
      setFileName(file.name);

      setStatusText(
        "PDF를 읽는 중..."
      );

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
        setPlans([]);
        setWorkItems([]);
        resetBackCover();

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
            (passage: any) => ({
              id: makeId(),

              title: String(
                passage?.title ||
                  "본문"
              ).trim(),

              content: String(
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

  const requestPlan = async (
    passage: Passage
  ) => {
    const response =
      await fetch(
        "/api/middle-passage-plan",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            title: passage.title,
            content: passage.content,
          }),
        }
      );

    const data =
      await response.json();

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
      setCreatingPlanId(
        passage.id
      );

      setErrorMessage("");
      resetBackCover();

      setStatusText(
        `"${passage.title}" 설계 중...`
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

          title: String(
            data?.title ||
              passage.title
          ),

          summary: String(
            data?.summary || ""
          ),

          panels: Array.isArray(
            data?.panels
          )
            ? data.panels
            : [],

          image: "",

          loadingImage:
            false,
        };

      setPlans((prev) => [
        ...prev.filter(
          (plan) =>
            plan.passageId !==
            passage.id
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
            behavior:
              "smooth",

            block:
              "start",
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

  const makeAllPlans =
    async () => {
      if (
        passages.length === 0
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

        setErrorMessage("");
        setPlans([]);
        setWorkItems([]);
        resetBackCover();

        const newPlans: PassagePlan[] =
          [];

        for (
          let index = 0;
          index <
          passages.length;
          index++
        ) {
          const passage =
            passages[index];

          setStatusText(
            `${index + 1}/${passages.length} · ${passage.title}`
          );

          const data =
            await requestPlan(
              passage
            );

          newPlans.push({
            id: makeId(),

            passageId:
              passage.id,

            title: String(
              data?.title ||
                passage.title
            ),

            summary: String(
              data?.summary ||
                ""
            ),

            panels: Array.isArray(
              data?.panels
            )
              ? data.panels
              : [],

            image: "",

            loadingImage:
              false,
          });

          setPlans([
            ...newPlans,
          ]);
        }

        setStatusText(
          "전체 설계 완료"
        );
      } catch (error: any) {
        console.error(error);

        setErrorMessage(
          error?.message ||
            "전체 설계 중 오류가 발생했습니다."
        );
      } finally {
        setCreatingAllPlans(
          false
        );
      }
    };

  const requestImage = async (
    plan: PassagePlan
  ): Promise<string> => {
    const response =
      await fetch(
        "/api/generate-comic",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            title: plan.title,
            summary:
              plan.summary,
            panels:
              plan.panels,
          }),
        }
      );

    const data =
      await response.json();

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
    const plan =
      plans.find(
        (item) =>
          item.id === planId
      );

    if (!plan) {
      return;
    }

    try {
      setErrorMessage("");
      resetBackCover();

      setPlans((prev) =>
        prev.map((item) =>
          item.id === planId
            ? {
                ...item,
                loadingImage:
                  true,
                image: "",
              }
            : item
        )
      );

      const image =
        await requestImage(plan);

      setPlans((prev) =>
        prev.map((item) =>
          item.id === planId
            ? {
                ...item,
                loadingImage:
                  false,
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
          (plan) =>
            !plan.image
        );

      if (
        plans.length === 0
      ) {
        alert(
          "먼저 설계안을 만들어 주세요."
        );

        return;
      }

      if (
        targets.length === 0
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

        setErrorMessage("");
        resetBackCover();

        for (
          let index = 0;
          index <
          targets.length;
          index++
        ) {
          const target =
            targets[index];

          setImageProgress(
            `${index + 1}/${targets.length} · ${target.title}`
          );

          setPlans((prev) =>
            prev.map((item) =>
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

          setPlans((prev) =>
            prev.map((item) =>
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
            loadingImage:
              false,
          }))
        );
      } finally {
        setLoadingAllImages(
          false
        );
      }
    };

  const generateBackCover =
    async () => {
      if (
        plans.length === 0
      ) {
        alert(
          "먼저 써밋네컷 설계안을 만들어 주세요."
        );

        return;
      }

      if (
        generatedImageCount === 0
      ) {
        alert(
          "먼저 써밋네컷 이미지를 생성해 주세요."
        );

        return;
      }

      try {
        setLoadingBackCover(
          true
        );

        setErrorMessage("");

        const response =
          await fetch(
            "/api/generate-cheer-page",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                plans: plans.map(
                  (plan) => ({
                    title:
                      plan.title,

                    summary:
                      plan.summary,

                    panels:
                      plan.panels,
                  })
                ),
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              data?.error ||
              "뒷표지 생성에 실패했습니다."
          );
        }

        if (!data?.image) {
          throw new Error(
            "뒷표지 이미지가 없습니다."
          );
        }

        setBackCoverImage(
          data.image
        );

        setBackCoverText(
          data.cheerText || ""
        );
      } catch (error: any) {
        console.error(error);

        setErrorMessage(
          error?.message ||
            "뒷표지 생성 중 오류가 발생했습니다."
        );
      } finally {
        setLoadingBackCover(
          false
        );
      }
    };

  const updateSummary = (
    planId: string,
    value: string
  ) => {
    resetBackCover();

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
    resetBackCover();

    setPlans((prev) =>
      prev.map((plan) => {
        if (
          plan.id !== planId
        ) {
          return plan;
        }

        const panels = [
          ...plan.panels,
        ];

        panels[
          panelIndex
        ] = {
          ...panels[
            panelIndex
          ],
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
    resetBackCover();

    setPlans((prev) =>
      prev.map((plan) => {
        if (
          plan.id !== planId
        ) {
          return plan;
        }

        const panels = [
          ...plan.panels,
        ];

        panels[
          panelIndex
        ] = {
          ...panels[
            panelIndex
          ],
          characters:
            value,
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
    field:
      | "speaker"
      | "text",
    value: string
  ) => {
    resetBackCover();

    setPlans((prev) =>
      prev.map((plan) => {
        if (
          plan.id !== planId
        ) {
          return plan;
        }

        const panels = [
          ...plan.panels,
        ];

        const dialogue = [
          ...panels[
            panelIndex
          ].dialogue,
        ];

        dialogue[
          dialogueIndex
        ] = {
          ...dialogue[
            dialogueIndex
          ],
          [field]:
            value,
        };

        panels[
          panelIndex
        ] = {
          ...panels[
            panelIndex
          ],
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
    resetBackCover();

    setPlans((prev) =>
      prev.map((plan) => {
        if (
          plan.id !== planId
        ) {
          return plan;
        }

        const panels = [
          ...plan.panels,
        ];

        panels[
          panelIndex
        ] = {
          ...panels[
            panelIndex
          ],

          dialogue: [
            ...panels[
              panelIndex
            ].dialogue,

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
    resetBackCover();

    setPlans((prev) =>
      prev.map((plan) => {
        if (
          plan.id !== planId
        ) {
          return plan;
        }

        const panels = [
          ...plan.panels,
        ];

        panels[
          panelIndex
        ] = {
          ...panels[
            panelIndex
          ],

          dialogue:
            panels[
              panelIndex
            ].dialogue.filter(
              (_, index) =>
                index !==
                dialogueIndex
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
          passage.id !==
          passageId
      )
    );

    setPlans((prev) =>
      prev.filter(
        (plan) =>
          plan.passageId !==
          passageId
      )
    );

    resetBackCover();
  };

  const isPlanInWorkBox = (
    plan: PassagePlan
  ) => {
    if (!plan.image) {
      return false;
    }

    return workItems.some(
      (item) =>
        item.image ===
        plan.image
    );
  };

  const addToWorkBox = (
    planId: string
  ) => {
    const plan =
      plans.find(
        (item) =>
          item.id === planId
      );

    if (
      !plan ||
      !plan.image
    ) {
      return;
    }

    if (
      isPlanInWorkBox(plan)
    ) {
      setAddedPlanId(
        planId
      );

      setTimeout(() => {
        setAddedPlanId("");
      }, 900);

      return;
    }

    setWorkItems((prev) => [
      ...prev,

      {
        id: makeId(),

        title:
          plan.title,

        summary:
          plan.summary,

        image:
          plan.image,
      },
    ]);

    setAddedPlanId(
      planId
    );

    setTimeout(() => {
      setAddedPlanId("");
    }, 1200);
  };

  const addAllImagesToWorkBox =
    () => {
      const imagePlans =
        plans.filter(
          (plan) =>
            Boolean(
              plan.image
            )
        );

      const newItems =
        imagePlans
          .filter(
            (plan) =>
              !workItems.some(
                (item) =>
                  item.image ===
                  plan.image
              )
          )
          .map(
            (
              plan
            ): WorkItem => ({
              id: makeId(),

              title:
                plan.title,

              summary:
                plan.summary,

              image:
                plan.image,
            })
          );

      if (
        newItems.length === 0
      ) {
        setAllAddedFeedback(
          true
        );

        setTimeout(() => {
          setAllAddedFeedback(
            false
          );
        }, 1200);

        return;
      }

      setWorkItems((prev) => [
        ...prev,
        ...newItems,
      ]);

      setAllAddedFeedback(
        true
      );

      setTimeout(() => {
        setAllAddedFeedback(
          false
        );
      }, 1500);
    };

  const removeWorkItem = (
    id: string
  ) => {
    setWorkItems((prev) =>
      prev.filter(
        (item) =>
          item.id !== id
      )
    );
  };

  const moveWorkItem = (
    index: number,
    direction:
      | "up"
      | "down"
  ) => {
    const newItems = [
      ...workItems,
    ];

    const targetIndex =
      direction === "up"
        ? index - 1
        : index + 1;

    if (
      targetIndex < 0 ||
      targetIndex >=
        newItems.length
    ) {
      return;
    }

    const temp =
      newItems[index];

    newItems[index] =
      newItems[
        targetIndex
      ];

    newItems[
      targetIndex
    ] = temp;

    setWorkItems(
      newItems
    );
  };

  const loadImage = (
    src: string
  ): Promise<HTMLImageElement> => {
    return new Promise(
      (resolve, reject) => {
        const img =
          new Image();

        img.onload = () =>
          resolve(img);

        img.onerror = () =>
          reject(
            new Error(
              "이미지를 불러오지 못했습니다."
            )
          );

        img.src = src;
      }
    );
  };

  const createCoverImage =
    async (): Promise<string> => {
      if (
        document.fonts?.ready
      ) {
        await document.fonts.ready;
      }

      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width = 1600;
      canvas.height = 1131;

      const ctx =
        canvas.getContext(
          "2d"
        );

      if (!ctx) {
        throw new Error(
          "표지 캔버스를 만들 수 없습니다."
        );
      }

      const bgColor =
        "#f8f7f3";

      const black =
        "#111111";

      const gray =
        "#505050";

      const white =
        "#ffffff";

      ctx.fillStyle =
        bgColor;

      ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      const filmX = 150;
      const filmY = 330;
      const filmWidth =
        1300;
      const filmHeight =
        390;

      const topLine = [
        schoolName.trim(),

        gradeName.trim()
          ? `${gradeName.trim()}학년`
          : "",
      ]
        .filter(Boolean)
        .join("  ·  ");

      ctx.textAlign =
        "left";

      ctx.textBaseline =
        "middle";

      ctx.fillStyle =
        black;

      ctx.font =
        '700 36px "Noto Sans KR", "Malgun Gothic", sans-serif';

      ctx.fillText(
        topLine ||
          "SUMMIT EDU",
        filmX,
        145
      );

      ctx.fillStyle =
        gray;

      ctx.font =
        '700 42px "Noto Sans KR", "Malgun Gothic", sans-serif';

      ctx.fillText(
        `${
          lessonName.trim() ||
          "Lesson"
        }  ·  본문`,
        filmX,
        205
      );

      ctx.fillStyle =
        black;

      ctx.beginPath();

      ctx.roundRect(
        filmX,
        filmY,
        filmWidth,
        filmHeight,
        26
      );

      ctx.fill();

      const holeWidth =
        52;

      const holeHeight =
        24;

      const holeGap =
        30;

      ctx.fillStyle =
        bgColor;

      for (
        let x =
          filmX + 35;
        x <
        filmX +
          filmWidth -
          holeWidth -
          20;
        x +=
        holeWidth +
        holeGap
      ) {
        ctx.beginPath();

        ctx.roundRect(
          x,
          filmY + 22,
          holeWidth,
          holeHeight,
          8
        );

        ctx.fill();

        ctx.beginPath();

        ctx.roundRect(
          x,
          filmY +
            filmHeight -
            holeHeight -
            22,
          holeWidth,
          holeHeight,
          8
        );

        ctx.fill();
      }

      const letters = [
        "써",
        "밋",
        "네",
        "컷",
      ];

      const innerMarginX =
        48;

      const frameGap =
        20;

      const frameTop =
        filmY + 72;

      const frameHeight =
        filmHeight - 144;

      const totalInnerWidth =
        filmWidth -
        innerMarginX * 2;

      const frameWidth =
        (totalInnerWidth -
          frameGap * 3) /
        4;

      letters.forEach(
        (
          letter,
          index
        ) => {
          const x =
            filmX +
            innerMarginX +
            index *
              (frameWidth +
                frameGap);

          ctx.fillStyle =
            white;

          ctx.fillRect(
            x,
            frameTop,
            frameWidth,
            frameHeight
          );

          ctx.strokeStyle =
            white;

          ctx.lineWidth =
            7;

          ctx.strokeRect(
            x,
            frameTop,
            frameWidth,
            frameHeight
          );

          ctx.fillStyle =
            black;

          ctx.strokeStyle =
            black;

          ctx.lineWidth =
            2;

          ctx.font =
            '900 138px "Noto Sans KR", "Malgun Gothic", sans-serif';

          ctx.textAlign =
            "center";

          ctx.textBaseline =
            "middle";

          const centerX =
            x +
            frameWidth /
              2;

          const centerY =
            frameTop +
            frameHeight /
              2 +
            3;

          ctx.strokeText(
            letter,
            centerX,
            centerY
          );

          ctx.fillText(
            letter,
            centerX,
            centerY
          );
        }
      );

      try {
        const logo =
          await loadImage(
            "/summit-logo.png"
          );

        const maxLogoWidth =
          430;

        const maxLogoHeight =
          170;

        const ratio =
          Math.min(
            maxLogoWidth /
              logo.naturalWidth,

            maxLogoHeight /
              logo.naturalHeight
          );

        const logoWidth =
          logo.naturalWidth *
          ratio;

        const logoHeight =
          logo.naturalHeight *
          ratio;

        ctx.drawImage(
          logo,

          canvas.width /
              2 -
            logoWidth / 2,

          860,

          logoWidth,

          logoHeight
        );
      } catch (error) {
        console.error(
          "COVER LOGO ERROR:",
          error
        );

        ctx.fillStyle =
          black;

        ctx.textAlign =
          "center";

        ctx.font =
          '800 42px "Noto Sans KR", "Malgun Gothic", sans-serif';

        ctx.fillText(
          "SUMMIT EDU",
          canvas.width / 2,
          950
        );
      }

      return canvas.toDataURL(
        "image/png",
        1
      );
    };

  const addImagePageToPdf = (
    pdf: jsPDF,
    image: string
  ) => {
    const pageWidth =
      pdf.internal.pageSize.getWidth();

    const pageHeight =
      pdf.internal.pageSize.getHeight();

    const margin = 10;

    const availableWidth =
      pageWidth -
      margin * 2;

    const availableHeight =
      pageHeight -
      margin * 2;

    const imageProps =
      pdf.getImageProperties(
        image
      );

    const imageRatio =
      imageProps.width /
      imageProps.height;

    let imageWidth =
      availableWidth;

    let imageHeight =
      imageWidth /
      imageRatio;

    if (
      imageHeight >
      availableHeight
    ) {
      imageHeight =
        availableHeight;

      imageWidth =
        imageHeight *
        imageRatio;
    }

    const x =
      (pageWidth -
        imageWidth) /
      2;

    const y =
      (pageHeight -
        imageHeight) /
      2;

    pdf.addImage(
      image,
      "PNG",
      x,
      y,
      imageWidth,
      imageHeight,
      undefined,
      "FAST"
    );
  };

  const downloadLessonPdf =
    async () => {
      if (
        workItems.length === 0
      ) {
        alert(
          "먼저 PDF 작업함에 써밋네컷 이미지를 추가해 주세요."
        );

        return;
      }

      if (
        !backCoverImage
      ) {
        alert(
          "먼저 뒷표지를 생성해 주세요."
        );

        return;
      }

      try {
        setMakingPdf(true);

        const coverImage =
          await createCoverImage();

        const pdf =
          new jsPDF({
            orientation:
              "landscape",

            unit: "mm",

            format: "a4",

            compress:
              true,
          });

        const pageWidth =
          pdf.internal.pageSize.getWidth();

        const pageHeight =
          pdf.internal.pageSize.getHeight();

        pdf.addImage(
          coverImage,
          "PNG",
          0,
          0,
          pageWidth,
          pageHeight,
          undefined,
          "FAST"
        );

        for (
          let index = 0;
          index <
          workItems.length;
          index++
        ) {
          const item =
            workItems[index];

          pdf.addPage(
            "a4",
            "landscape"
          );

          addImagePageToPdf(
            pdf,
            item.image
          );
        }

        pdf.addPage(
          "a4",
          "landscape"
        );

        addImagePageToPdf(
          pdf,
          backCoverImage
        );

        const baseName =
          [
            schoolName.trim(),

            gradeName.trim()
              ? `${gradeName.trim()}학년`
              : "",

            lessonName.trim(),
          ]
            .filter(Boolean)
            .join("-") ||
          "summit-middle";

        pdf.save(
          `${baseName}-본문-써밋네컷.pdf`
        );
      } catch (error) {
        console.error(
          "PDF ERROR:",
          error
        );

        alert(
          "PDF를 만드는 중 오류가 발생했습니다."
        );
      } finally {
        setMakingPdf(false);
      }
    };

  const generatedImageCount =
    plans.filter((plan) =>
      Boolean(plan.image)
    ).length;

  const totalPdfPages =
    2 + workItems.length;

  return (
    <main className="min-h-screen bg-[#f7f4ea] px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap gap-3">
          <HomeButton />

          <button
            type="button"
            onClick={
              goToContentSelection
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-600 shadow-sm transition hover:border-emerald-400 hover:text-emerald-700 active:scale-95"
          >
            ← 컨텐츠 선택
          </button>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-5">
          <header className="flex-1 rounded-[30px] bg-white px-7 py-7 shadow-sm ring-1 ring-slate-200 md:px-9">
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

          <div className="min-w-[150px] rounded-2xl bg-purple-100 px-5 py-4 text-center ring-1 ring-purple-200">
            <p className="text-xs font-bold text-purple-600">
              PDF 작업함
            </p>

            <p className="mt-1 text-3xl font-black text-purple-900">
              {workItems.length}
            </p>

            <p className="text-xs text-purple-600">
              장 저장됨
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <p className="text-sm font-bold text-purple-600">
            COVER INFORMATION
          </p>

          <h2 className="mt-1 text-2xl font-black">
            표지 정보
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            입력한 정보는 PDF 첫 장 표지와 파일명에 반영됩니다.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-bold text-slate-700">
                학교
              </label>

              <input
                value={
                  schoolName
                }
                onChange={(e) =>
                  setSchoolName(
                    e.target.value
                  )
                }
                placeholder="예: 써밋중"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
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
                onChange={(e) =>
                  setGradeName(
                    e.target.value
                  )
                }
                placeholder="예: 2"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
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
                onChange={(e) =>
                  setLessonName(
                    e.target.value
                  )
                }
                placeholder="예: Lesson 3"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>
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

        {passages.length >
          0 && (
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
                onClick={
                  makeAllPlans
                }
                disabled={
                  creatingAllPlans ||
                  Boolean(
                    creatingPlanId
                  )
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
                (
                  passage,
                  index
                ) => (
                  <div
                    key={
                      passage.id
                    }
                    className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-black">
                        본문{" "}
                        {index +
                          1}{" "}
                        ·{" "}
                        {
                          passage.title
                        }
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
                      value={
                        passage.content
                      }
                      onChange={(e) =>
                        setPassages(
                          (prev) =>
                            prev.map(
                              (
                                item
                              ) =>
                                item.id ===
                                passage.id
                                  ? {
                                      ...item,

                                      content:
                                        e
                                          .target
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
                        makePlan(
                          passage
                        )
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
                현재{" "}
                {plans.length}개
                설계안 · 이미지{" "}
                {
                  generatedImageCount
                }
                개 생성됨
              </p>
            </div>

            <div className="space-y-10">
              {plans.map(
                (
                  plan,
                  planIndex
                ) => (
                  <div
                    id={`plan-${plan.passageId}`}
                    key={
                      plan.id
                    }
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="bg-slate-900 p-6 text-white">
                      <p className="text-sm font-bold text-purple-300">
                        설계안{" "}
                        {planIndex +
                          1}
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
                        value={
                          plan.summary
                        }
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
                        {
                          plan.summary
                            .length
                        }
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
                                {
                                  panel.cut
                                }
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
                                      <label className="text-xs font-black text-purple-700">
                                        화자
                                      </label>

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
                                            e.target.value
                                          )
                                        }
                                        placeholder="화자"
                                        className="mt-1 w-full rounded-lg border border-purple-200 px-3 py-2 font-bold"
                                      />

                                      <label className="mt-3 block text-xs font-black text-purple-700">
                                        대사
                                      </label>

                                      <textarea
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
                                            e.target.value
                                          )
                                        }
                                        placeholder="대사"
                                        rows={4}
                                        className="mt-1 min-h-[110px] w-full resize-y rounded-lg border border-purple-200 px-3 py-3 leading-6"
                                      />

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
                          generateImage(
                            plan.id
                          )
                        }
                        disabled={
                          plan.loadingImage ||
                          loadingAllImages
                        }
                        className="mt-6 w-full rounded-xl bg-purple-600 px-6 py-4 text-lg font-black text-white transition active:scale-[0.99] disabled:opacity-50"
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
                            alt="써밋네컷"
                            className="w-full rounded-xl"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              addToWorkBox(
                                plan.id
                              )
                            }
                            disabled={
                              isPlanInWorkBox(
                                plan
                              )
                            }
                            className={`mt-4 w-full rounded-xl px-5 py-4 font-black transition-all duration-150 active:scale-[0.97] ${
                              isPlanInWorkBox(
                                plan
                              )
                                ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                                : addedPlanId ===
                                  plan.id
                                ? "scale-[0.98] bg-emerald-600 text-white"
                                : "bg-slate-900 text-white hover:bg-purple-700"
                            }`}
                          >
                            {isPlanInWorkBox(
                              plan
                            )
                              ? "PDF 작업함에 담김 ✓"
                              : addedPlanId ===
                                plan.id
                              ? "담기 완료 ✓"
                              : "PDF 작업함에 담기"}
                          </button>
                        </div>
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
                설계안 확인이 모두 끝났나요?
              </h3>

              <button
                type="button"
                onClick={
                  generateAllImages
                }
                disabled={
                  loadingAllImages
                }
                className="mt-5 w-full rounded-xl bg-purple-500 px-6 py-4 text-lg font-black text-white transition active:scale-[0.99] disabled:opacity-50"
              >
                {loadingAllImages
                  ? `전체 이미지 생성 중 · ${imageProgress}`
                  : `확인한 설계안 전체 이미지 생성 · ${
                      plans.length -
                      generatedImageCount
                    }개 남음`}
              </button>

              {generatedImageCount >
                0 && (
                <button
                  type="button"
                  onClick={
                    addAllImagesToWorkBox
                  }
                  className={`mt-3 w-full rounded-xl px-6 py-4 text-lg font-black transition-all active:scale-[0.97] ${
                    allAddedFeedback
                      ? "bg-emerald-500 text-white"
                      : "bg-white text-slate-900"
                  }`}
                >
                  {allAddedFeedback
                    ? "전체 작업함 담기 완료 ✓"
                    : `생성된 이미지 전체 PDF 작업함에 담기 · ${generatedImageCount}장`}
                </button>
              )}
            </div>

            <section className="mt-10 rounded-3xl bg-amber-50 p-6 ring-1 ring-amber-200">
              <p className="text-sm font-bold text-amber-600">
                BACK COVER
              </p>

              <h3 className="mt-1 text-2xl font-black text-slate-900">
                뒷표지
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                이 Lesson에 등장한 캐릭터들을 활용해 마지막 뒷표지를 만듭니다.
              </p>

              <p className="mt-1 text-xs text-slate-500">
                뒷표지 생성은 AI 이미지 1장을 사용합니다.
              </p>

              <button
                type="button"
                onClick={
                  generateBackCover
                }
                disabled={
                  loadingBackCover ||
                  generatedImageCount ===
                    0
                }
                className="mt-5 w-full rounded-xl bg-amber-500 px-6 py-4 text-lg font-black text-white transition active:scale-[0.99] disabled:opacity-50"
              >
                {loadingBackCover
                  ? "뒷표지 생성 중..."
                  : backCoverImage
                  ? "뒷표지 다시 생성"
                  : "뒷표지 생성"}
              </button>

              {backCoverImage && (
                <div className="mt-6">
                  {backCoverText && (
                    <p className="mb-3 text-center text-sm font-bold text-slate-500">
                      사용된 응원 문구 ·{" "}
                      {
                        backCoverText
                      }
                    </p>
                  )}

                  <img
                    src={
                      backCoverImage
                    }
                    alt="써밋네컷 뒷표지"
                    className="w-full rounded-2xl"
                  />
                </div>
              )}
            </section>
          </section>
        )}

        <section className="mt-12 rounded-3xl bg-slate-900 p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-sm font-bold text-purple-300">
                LESSON WORKBOX
              </p>

              <h2 className="mt-1 text-3xl font-black">
                PDF 작업함
              </h2>

              <p className="mt-2 text-sm text-slate-300">
                원하는 이미지를 확인하고 순서를 정한 뒤 PDF로 저장합니다.
              </p>
            </div>

            <p className="text-3xl font-black">
              {workItems.length}
            </p>
          </div>

          {workItems.length ===
          0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-slate-600 p-8 text-center text-slate-400">
              아직 추가된 이미지가 없습니다.
            </p>
          ) : (
            <>
              <div className="mt-6 space-y-5">
                {workItems.map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      key={
                        item.id
                      }
                      className="rounded-2xl bg-white p-5 text-slate-900"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <h3 className="text-xl font-black">
                          페이지{" "}
                          {index +
                            1}{" "}
                          ·{" "}
                          {
                            item.summary
                          }
                        </h3>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              moveWorkItem(
                                index,
                                "up"
                              )
                            }
                            disabled={
                              index ===
                              0
                            }
                            className="rounded-lg bg-slate-100 px-3 py-2 font-black transition active:scale-90 disabled:opacity-30"
                          >
                            ↑
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              moveWorkItem(
                                index,
                                "down"
                              )
                            }
                            disabled={
                              index ===
                              workItems.length -
                                1
                            }
                            className="rounded-lg bg-slate-100 px-3 py-2 font-black transition active:scale-90 disabled:opacity-30"
                          >
                            ↓
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              removeWorkItem(
                                item.id
                              )
                            }
                            className="rounded-lg bg-red-50 px-3 py-2 font-bold text-red-600 transition active:scale-90"
                          >
                            삭제
                          </button>
                        </div>
                      </div>

                      <img
                        src={
                          item.image
                        }
                        alt="써밋네컷"
                        className="mt-4 w-full rounded-xl"
                      />
                    </div>
                  )
                )}
              </div>

              <div className="mt-8 rounded-2xl bg-purple-500/20 p-6">
                <p className="text-sm font-bold text-purple-200">
                  FINAL STEP
                </p>

                <h3 className="mt-1 text-2xl font-black">
                  최종 PDF 만들기
                </h3>

                <p className="mt-2 text-sm text-slate-300">
                  앞표지 1장 + 써밋네컷{" "}
                  {
                    workItems.length
                  }
                  장 + 뒷표지 1장
                </p>

                {!backCoverImage && (
                  <p className="mt-3 rounded-xl bg-amber-400/10 p-3 text-sm font-bold text-amber-300">
                    최종 PDF를 만들려면 먼저 뒷표지를 생성해 주세요.
                  </p>
                )}

                <button
                  type="button"
                  onClick={
                    downloadLessonPdf
                  }
                  disabled={
                    makingPdf ||
                    !backCoverImage
                  }
                  className="mt-5 w-full rounded-xl bg-purple-500 px-6 py-4 text-lg font-black text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {makingPdf
                    ? "PDF 만드는 중..."
                    : `PDF 다운로드 · 총 ${totalPdfPages}페이지`}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}