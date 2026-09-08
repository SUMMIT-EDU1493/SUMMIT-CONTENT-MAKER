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
  planId: string;
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

  const [frontCoverImage, setFrontCoverImage] =
    useState("");

  const [backCoverImage, setBackCoverImage] =
    useState("");

  const [backCoverText, setBackCoverText] =
    useState("");

  const [loadingPdf, setLoadingPdf] =
    useState(false);

  const [loadingAi, setLoadingAi] =
    useState(false);

  const [
    creatingAllPlans,
    setCreatingAllPlans,
  ] = useState(false);

  const [
    creatingPlanId,
    setCreatingPlanId,
  ] = useState("");

  const [
    loadingAllImages,
    setLoadingAllImages,
  ] = useState(false);

  const [
    loadingBackCover,
    setLoadingBackCover,
  ] = useState(false);

  const [makingPdf, setMakingPdf] =
    useState(false);

  const [statusText, setStatusText] =
    useState("");

  const [
    planProgressText,
    setPlanProgressText,
  ] = useState("");

  const [
    imageProgress,
    setImageProgress,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

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

  const resetFinalOutput = () => {
    setWorkItems([]);
    setFrontCoverImage("");
    setBackCoverImage("");
    setBackCoverText("");
  };

  const scrollTo = (
    id: string
  ) => {
    setTimeout(() => {
      document
        .getElementById(id)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 250);
  };

  const extractPdfText = async (
    file: File
  ) => {
    setLoadingPdf(true);
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
        `PDF 읽는 중 (${pageNumber}/${pdf.numPages})`
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
    setLoadingPdf(false);

    return text;
  };

  const requestPassages = async (
    text: string
  ): Promise<Passage[]> => {
    setLoadingAi(true);

    setStatusText(
      "영어 본문을 자동으로 추출하는 중..."
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
            text,
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
        "영어 본문을 찾지 못했습니다."
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

    setLoadingAi(false);

    return nextPassages;
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

  const buildAllPlans = async (
    targetPassages: Passage[]
  ) => {
    if (
      targetPassages.length === 0
    ) {
      throw new Error(
        "설계할 본문이 없습니다."
      );
    }

    setCreatingAllPlans(
      true
    );

    setPlans([]);
    resetFinalOutput();

    const nextPlans: PassagePlan[] =
      [];

    for (
      let index = 0;
      index <
      targetPassages.length;
      index++
    ) {
      const passage =
        targetPassages[index];

      const progress =
        `전체 설계 중 (${index + 1}/${targetPassages.length})`;

      setPlanProgressText(
        progress
      );

      setStatusText(
        `${progress} · ${passage.title}`
      );

      const data =
        await requestPlan(
          passage
        );

      nextPlans.push({
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
      });

      setPlans([
        ...nextPlans,
      ]);
    }

    setPlanProgressText(
      `전체 설계 완료 (${targetPassages.length}/${targetPassages.length})`
    );

    setStatusText(
      `본문 ${targetPassages.length}개 · 전체 설계 완료`
    );

    setCreatingAllPlans(
      false
    );

    scrollTo(
      "comic-plan-editor"
    );
  };

  const processUploadedPdf =
    async (file: File) => {
      try {
        setErrorMessage("");
        setFileName(file.name);
        setPdfText("");
        setPassages([]);
        setPlans([]);
        setPlanProgressText("");
        setImageProgress("");
        resetFinalOutput();

        const text =
          await extractPdfText(
            file
          );

        const found =
          await requestPassages(
            text
          );

        await buildAllPlans(
          found
        );
      } catch (error: any) {
        console.error(error);

        setErrorMessage(
          error?.message ||
            "교재를 처리하는 중 오류가 발생했습니다."
        );

        setStatusText("");
        setPlanProgressText("");

        setLoadingPdf(false);
        setLoadingAi(false);
        setCreatingAllPlans(
          false
        );
      }
    };

  const rebuildAllPlans =
    async () => {
      if (
        passages.length === 0
      ) {
        alert(
          "설계할 본문이 없습니다."
        );

        return;
      }

      try {
        setErrorMessage("");

        await buildAllPlans(
          passages
        );
      } catch (error: any) {
        console.error(error);

        setErrorMessage(
          error?.message ||
            "전체 설계 중 오류가 발생했습니다."
        );

        setCreatingAllPlans(
          false
        );
      }
    };

  const makePlan = async (
    passage: Passage
  ) => {
    try {
      setCreatingPlanId(
        passage.id
      );

      setErrorMessage("");
      resetFinalOutput();

      setStatusText(
        `"${passage.title}" 설계안을 다시 만드는 중...`
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
    } catch (error: any) {
      console.error(error);

      setErrorMessage(
        error?.message ||
          "써밋네컷 설계 중 오류가 발생했습니다."
      );
    } finally {
      setCreatingPlanId("");
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

  const requestBackCover =
    async (
      targetPlans: PassagePlan[]
    ) => {
      setLoadingBackCover(
        true
      );

      setStatusText(
        "마지막 뒷표지를 자동으로 만드는 중..."
      );

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
              plans:
                targetPlans.map(
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

      setLoadingBackCover(
        false
      );

      return data.image as string;
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

      resetFinalOutput();

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

  const generateAllImagesAndFinalize =
    async () => {
      if (
        plans.length === 0
      ) {
        alert(
          "먼저 설계안을 만들어 주세요."
        );

        return;
      }

      try {
        setLoadingAllImages(
          true
        );

        setErrorMessage("");
        setImageProgress("");

        setFrontCoverImage("");
        setBackCoverImage("");
        setBackCoverText("");
        setWorkItems([]);

        let latestPlans =
          plans.map(
            (plan) => ({
              ...plan,
            })
          );

        // 만화 이미지를 만드는 동안 표지도 동시에 준비합니다.
        // 만화 자체는 기존처럼 한 장씩 순차 생성합니다.
        const coverPromise =
          createCoverImage();

        const backCoverPromise =
          requestBackCover(
            latestPlans
          );

        for (
          let index = 0;
          index <
          latestPlans.length;
          index++
        ) {
          const current =
            latestPlans[index];

          const progress =
            `써밋네컷 이미지 생성 중 (${index + 1}/${latestPlans.length})`;

          setImageProgress(
            progress
          );

          setStatusText(
            `${progress} · ${current.title}`
          );

          if (!current.image) {
            setPlans((prev) =>
              prev.map(
                (item) =>
                  item.id ===
                  current.id
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
                current
              );

            latestPlans =
              latestPlans.map(
                (item) =>
                  item.id ===
                  current.id
                    ? {
                        ...item,

                        image,

                        loadingImage:
                          false,
                      }
                    : item
              );

            setPlans([
              ...latestPlans,
            ]);
          }
        }

        setStatusText(
          "표지와 PDF용 이미지를 마무리하는 중..."
        );

        const cover =
          await coverPromise;

        setFrontCoverImage(
          cover
        );

        await backCoverPromise;

        const nextWorkItems: WorkItem[] =
          await Promise.all(
            latestPlans
              .filter(
                (plan) =>
                  Boolean(
                    plan.image
                  )
              )
              .map(
                async (
                  plan
                ): Promise<WorkItem> => ({
                  id: makeId(),

                  planId:
                    plan.id,

                  title:
                    plan.title,

                  summary:
                    plan.summary,

                  // PDF 작업함에는 가벼운 JPEG 버전을 저장합니다.
                  image:
                    await optimizeImageForPdf(
                      plan.image
                    ),
                })
              )
          );

        setWorkItems(
          nextWorkItems
        );

        setImageProgress(
          "전체 이미지 생성 완료"
        );

        setStatusText(
          `앞표지 1장 + 써밋네컷 ${nextWorkItems.length}장 + 뒷표지 1장 생성 완료`
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

        setLoadingBackCover(
          false
        );
      }
    };

  const updateSummary = (
    planId: string,
    value: string
  ) => {
    resetFinalOutput();

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
    resetFinalOutput();

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
    resetFinalOutput();

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
    resetFinalOutput();

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
    resetFinalOutput();

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
    resetFinalOutput();

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

    resetFinalOutput();
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

      const nextItems: WorkItem[] =
        imagePlans.map(
          (
            plan
          ): WorkItem => ({
            id: makeId(),

            planId:
              plan.id,

            title:
              plan.title,

            summary:
              plan.summary,

            image:
              plan.image,
          })
        );

      setWorkItems(
        nextItems
      );
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

  const optimizeImageForPdf = (
    source: string
  ): Promise<string> => {
    if (
      source.startsWith(
        "data:image/jpeg"
      )
    ) {
      return Promise.resolve(
        source
      );
    }

    return new Promise(
      (
        resolve,
        reject
      ) => {
        const image =
          new Image();

        image.onload = () => {
          try {
            const canvas =
              document.createElement(
                "canvas"
              );

            const maxWidth =
              1600;

            const scale =
              Math.min(
                1,
                maxWidth /
                  image.width
              );

            canvas.width =
              Math.max(
                1,
                Math.round(
                  image.width *
                    scale
                )
              );

            canvas.height =
              Math.max(
                1,
                Math.round(
                  image.height *
                    scale
                )
              );

            const ctx =
              canvas.getContext(
                "2d"
              );

            if (!ctx) {
              reject(
                new Error(
                  "PDF 이미지 최적화에 실패했습니다."
                )
              );
              return;
            }

            // PNG 투명 영역이 JPEG에서 검게 변하지 않도록 흰색 배경을 깝니다.
            ctx.fillStyle =
              "#ffffff";

            ctx.fillRect(
              0,
              0,
              canvas.width,
              canvas.height
            );

            ctx.drawImage(
              image,
              0,
              0,
              canvas.width,
              canvas.height
            );

            resolve(
              canvas.toDataURL(
                "image/jpeg",
                0.88
              )
            );
          } catch (
            error
          ) {
            reject(error);
          }
        };

        image.onerror = () =>
          reject(
            new Error(
              "PDF용 이미지를 불러오지 못했습니다."
            )
          );

        image.src =
          source;
      }
    );
  };

  const getPdfImageFormat = (
    image: string
  ) =>
    image.startsWith(
      "data:image/jpeg"
    )
      ? "JPEG"
      : "PNG";

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
      getPdfImageFormat(
        image
      ),
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
          "PDF에 넣을 써밋네컷 이미지가 없습니다."
        );

        return;
      }

      if (
        !frontCoverImage ||
        !backCoverImage
      ) {
        alert(
          "앞표지 또는 뒷표지가 준비되지 않았습니다. 전체 이미지 생성을 다시 실행해 주세요."
        );

        return;
      }

      try {
        setMakingPdf(true);

        // 버튼 상태가 먼저 화면에 반영되도록 한 번 양보합니다.
        await new Promise<void>(
          (resolve) =>
            setTimeout(
              resolve,
              50
            )
        );

        // PDF에 들어갈 이미지를 동시에 가볍게 준비합니다.
        const [
          pdfFrontCover,
          pdfBackCover,
        ] =
          await Promise.all([
            optimizeImageForPdf(
              frontCoverImage
            ),
            optimizeImageForPdf(
              backCoverImage
            ),
          ]);

        const pdfWorkImages =
          await Promise.all(
            workItems.map(
              (item) =>
                optimizeImageForPdf(
                  item.image
                )
            )
          );

        const pdf =
          new jsPDF({
            orientation:
              "landscape",

            unit: "mm",

            format: "a4",

            compress:
              false,
          });

        const pageWidth =
          pdf.internal.pageSize.getWidth();

        const pageHeight =
          pdf.internal.pageSize.getHeight();

        pdf.addImage(
          pdfFrontCover,
          getPdfImageFormat(
            pdfFrontCover
          ),
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
            pdfWorkImages[
              index
            ]
          );
        }

        pdf.addPage(
          "a4",
          "landscape"
        );

        addImagePageToPdf(
          pdf,
          pdfBackCover
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

  const allImagesInWorkBox =
    generatedImageCount > 0 &&
    workItems.length ===
      generatedImageCount;

  const totalPdfPages =
    workItems.length + 2;

  const busy =
    loadingPdf ||
    loadingAi ||
    creatingAllPlans;

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
              PDF 선택부터 본문 추출과 설계안 생성까지 자동으로 진행합니다.
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
                onChange={(e) => {
                  setSchoolName(
                    e.target.value
                  );

                  setFrontCoverImage(
                    ""
                  );
                }}
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
                onChange={(e) => {
                  setGradeName(
                    e.target.value
                  );

                  setFrontCoverImage(
                    ""
                  );
                }}
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
                onChange={(e) => {
                  setLessonName(
                    e.target.value
                  );

                  setFrontCoverImage(
                    ""
                  );
                }}
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

          <p className="mt-2 text-sm text-slate-500">
            PDF를 선택하면 본문 추출과 전체 설계안 생성까지 자동으로 진행됩니다.
          </p>

          <label
            className={`mt-5 flex items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center ${
              busy
                ? "cursor-not-allowed border-slate-200 bg-slate-100"
                : "cursor-pointer border-emerald-200 bg-emerald-50"
            }`}
          >
            <div>
              <p className="font-black">
                {busy
                  ? "자동 처리 중..."
                  : "PDF 파일 선택"}
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
              disabled={busy}
              className="hidden"
              onChange={(e) => {
                const file =
                  e.target.files?.[0];

                if (file) {
                  processUploadedPdf(
                    file
                  );
                }

                e.target.value =
                  "";
              }}
            />
          </label>
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
                  본문
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  추출된 본문을 확인하고 필요한 경우 수정할 수 있습니다.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  rebuildAllPlans
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
                  ? planProgressText ||
                    "전체 설계 중..."
                  : "전체 설계안 다시 만들기"}
              </button>
            </div>

            {planProgressText && (
              <div className="mt-4 rounded-xl bg-purple-50 p-4 font-black text-purple-700 ring-1 ring-purple-100">
                {
                  planProgressText
                }
              </div>
            )}

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
                      className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-700 disabled:opacity-50"
                    >
                      {creatingPlanId ===
                      passage.id
                        ? "설계안 다시 만드는 중..."
                        : "이 본문 설계안만 다시 만들기"}
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="mt-6 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
              {planProgressText && (
                <p className="mb-3 text-center font-black text-emerald-800">
                  {
                    planProgressText
                  }
                </p>
              )}

              <button
                type="button"
                onClick={
                  rebuildAllPlans
                }
                disabled={
                  creatingAllPlans ||
                  Boolean(
                    creatingPlanId
                  )
                }
                className="w-full rounded-xl bg-emerald-700 px-5 py-4 font-black text-white transition active:scale-[0.99] disabled:opacity-50"
              >
                {creatingAllPlans
                  ? planProgressText ||
                    "전체 설계 중..."
                  : "전체 설계안 다시 만들기"}
              </button>
            </div>
          </section>
        )}

        {plans.length > 0 && (
          <section
            id="comic-plan-editor"
            className="mt-10 scroll-mt-6"
          >
            <div className="mb-6">
              <p className="text-sm font-bold text-purple-600">
                SUMMIT FOUR-CUT EDITOR
              </p>

              <h2 className="mt-1 text-3xl font-black">
                써밋네컷 설계안
              </h2>

              <p className="mt-2 text-slate-600">
                설계안을 확인하고 필요한 부분을 수정한 뒤 전체 이미지를 생성합니다.
              </p>
            </div>

            <div className="space-y-10">
              {plans.map(
                (
                  plan,
                  planIndex
                ) => (
                  <div
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
                                        rows={5}
                                        className="mt-1 min-h-[125px] w-full resize-y rounded-lg border border-purple-200 px-3 py-3 leading-6"
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

                      {plan.image && (
                        <div className="mt-6 rounded-2xl bg-slate-50 p-4">
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
                              generateImage(
                                plan.id
                              )
                            }
                            disabled={
                              plan.loadingImage ||
                              loadingAllImages
                            }
                            className="mt-3 w-full rounded-xl border border-purple-200 bg-white px-5 py-3 font-black text-purple-700 disabled:opacity-50"
                          >
                            이 이미지만 다시 생성
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
                FINAL IMAGE GENERATION
              </p>

              <h3 className="mt-1 text-2xl font-black">
                설계안 확인이 모두 끝났나요?
              </h3>

              <p className="mt-2 text-sm text-slate-300">
                버튼을 누르면 써밋네컷 전체와 앞표지·뒷표지를 순서대로 자동 생성합니다.
              </p>

              {(creatingAllPlans ||
                Boolean(
                  creatingPlanId
                )) && (
                <div className="mt-5 rounded-xl border border-amber-300/30 bg-amber-400/10 p-4 text-center">
                  <p className="font-black text-amber-200">
                    {planProgressText ||
                      "전체 설계 중..."}
                  </p>

                  <p className="mt-1 text-sm text-slate-300">
                    설계가 모두 완료되면 전체 이미지 생성 버튼이 활성화됩니다.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={
                  generateAllImagesAndFinalize
                }
                disabled={
                  creatingAllPlans ||
                  Boolean(
                    creatingPlanId
                  ) ||
                  loadingAllImages ||
                  loadingBackCover
                }
                className="mt-5 w-full rounded-xl bg-purple-500 px-6 py-4 text-lg font-black text-white transition active:scale-[0.99] disabled:opacity-50"
              >
                {creatingAllPlans ||
                Boolean(
                  creatingPlanId
                )
                  ? planProgressText ||
                    "전체 설계 완료 후 이미지 생성 가능"
                  : loadingAllImages ||
                    loadingBackCover
                  ? imageProgress ||
                    statusText ||
                    "전체 이미지 생성 중..."
                  : "전체 이미지 생성"}
              </button>

              {(loadingAllImages ||
                loadingBackCover) && (
                <div className="mt-4 rounded-xl bg-white/10 p-4 text-center font-bold text-purple-100">
                  {imageProgress ||
                    statusText}
                </div>
              )}
            </div>
          </section>
        )}

        {(frontCoverImage ||
          generatedImageCount >
            0 ||
          backCoverImage) && (
          <section
            id="final-image-gallery"
            className="mt-12 scroll-mt-6"
          >
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
              <p className="text-sm font-bold text-purple-600">
                FINAL PREVIEW
              </p>

              <h2 className="mt-1 text-3xl font-black">
                완성 이미지 확인
              </h2>

              <p className="mt-2 text-slate-600">
                PDF에 들어갈 순서대로 확인할 수 있습니다.
              </p>

              <div className="mt-7 space-y-8">
                {frontCoverImage && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-lg font-black">
                      앞표지
                    </p>

                    <img
                      src={
                        frontCoverImage
                      }
                      alt="써밋네컷 앞표지"
                      className="w-full rounded-xl"
                    />
                  </div>
                )}

                {plans
                  .filter(
                    (plan) =>
                      Boolean(
                        plan.image
                      )
                  )
                  .map(
                    (
                      plan,
                      index
                    ) => (
                      <div
                        key={
                          plan.id
                        }
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="mb-1 text-sm font-bold text-purple-600">
                          써밋네컷{" "}
                          {index +
                            1}
                        </p>

                        <p className="mb-3 text-lg font-black">
                          {
                            plan.summary
                          }
                        </p>

                        <img
                          src={
                            plan.image
                          }
                          alt={`써밋네컷 ${
                            index +
                            1
                          }`}
                          className="w-full rounded-xl"
                        />
                      </div>
                    )
                  )}

                {backCoverImage && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="mb-1 text-sm font-bold text-amber-600">
                      BACK COVER
                    </p>

                    <p className="mb-3 text-lg font-black">
                      뒷표지
                    </p>

                    {backCoverText && (
                      <p className="mb-3 text-sm font-bold text-slate-500">
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
                      className="w-full rounded-xl"
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={
                  addAllImagesToWorkBox
                }
                disabled={
                  allImagesInWorkBox
                }
                className={`mt-8 w-full rounded-xl px-6 py-4 text-lg font-black transition active:scale-[0.98] ${
                  allImagesInWorkBox
                    ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                    : "bg-slate-900 text-white"
                }`}
              >
                {allImagesInWorkBox
                  ? `전체 이미지 PDF 작업함에 담김 ✓ · ${workItems.length}장`
                  : `전체 이미지 PDF 작업함에 담기 · ${generatedImageCount}장`}
              </button>
            </div>
          </section>
        )}

        {workItems.length >
          0 && (
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
                  써밋네컷 페이지 순서를 마지막으로 확인합니다.
                </p>
              </div>

              <p className="text-3xl font-black">
                {
                  workItems.length
                }
              </p>
            </div>

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
                          2}{" "}
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
                          className="rounded-lg bg-slate-100 px-3 py-2 font-black disabled:opacity-30"
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
                          className="rounded-lg bg-slate-100 px-3 py-2 font-black disabled:opacity-30"
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
                          className="rounded-lg bg-red-50 px-3 py-2 font-bold text-red-600"
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
                최종 PDF
              </h3>

              <p className="mt-2 text-sm text-slate-300">
                앞표지 1장 + 써밋네컷{" "}
                {
                  workItems.length
                }
                장 + 뒷표지 1장
              </p>

              {(!frontCoverImage ||
                !backCoverImage) && (
                <div className="mt-5 rounded-xl border border-purple-300/30 bg-white/10 p-4 text-center">
                  <p className="font-black text-purple-100">
                    최종 PDF를 준비하고 있습니다.
                  </p>

                  <p className="mt-1 text-sm text-slate-300">
                    앞표지와 뒷표지가 자동으로 완성되면 다운로드 버튼이 활성화됩니다.
                  </p>

                  <div className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-purple-200">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-purple-300" />
                    표지 자동 생성 대기 중
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={
                  downloadLessonPdf
                }
                disabled={
                  makingPdf ||
                  !frontCoverImage ||
                  !backCoverImage
                }
                className="mt-5 w-full rounded-xl bg-purple-500 px-6 py-4 text-lg font-black text-white transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-50"
              >
                {makingPdf
                  ? "PDF 만드는 중..."
                  : !frontCoverImage ||
                    !backCoverImage
                  ? "표지 자동 완성 후 다운로드 가능"
                  : `PDF 다운로드 · 총 ${totalPdfPages}페이지`}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}