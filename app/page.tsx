"use client";

import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { jsPDF } from "jspdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type Dialogue = {
  title: string;
  content: string;
};

type AnalysisResult = {
  dialogues?: Dialogue[];
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

type ComicPlan = {
  title: string;
  summary: string;
  panels: ComicPanel[];
};

type ComicProject = {
  id: string;
  sourceTitle: string;
  sourceContent: string;
  plan: ComicPlan;
  image: string;
  loadingImage: boolean;
};

type WorkItem = {
  id: string;
  title: string;
  summary: string;
  image: string;
};

type SchoolLevel = "" | "middle" | "high";
type WorkMode = "" | "dialogue" | "passage" | "fourcut" | "summary";

export default function Home() {
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>("");
  const [workMode, setWorkMode] = useState<WorkMode>("");
  const [schoolName, setSchoolName] = useState("");
  const [gradeName, setGradeName] = useState("중3");
  const [lessonName, setLessonName] = useState("Lesson 1");
  const [contentType, setContentType] = useState("대화문");

  const [fileName, setFileName] = useState("");
  const [pdfText, setPdfText] = useState("");

  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingComic, setLoadingComic] = useState(false);
  const [loadingAllComics, setLoadingAllComics] = useState(false);
  const [loadingAllImages, setLoadingAllImages] = useState(false);
  const [loadingBackCover, setLoadingBackCover] = useState(false);

  const [imageProgress, setImageProgress] = useState("");
  const [makingPdf, setMakingPdf] = useState(false);
  const [currentCreatingTitle, setCurrentCreatingTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [comicProjects, setComicProjects] = useState<ComicProject[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);

  const [backCoverImage, setBackCoverImage] = useState("");
  const [backCoverText, setBackCoverText] = useState("");

  const makeId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const readPdf = async (file: File) => {
    try {
      setLoadingPdf(true);
      setErrorMessage("");
      setPdfText("");
      setAnalysis(null);
      setComicProjects([]);
      setBackCoverImage("");
      setBackCoverText("");

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
            if ("str" in item) return item.str;
            return "";
          })
          .join(" ");

        fullText += `\n\n--- ${pageNumber}페이지 ---\n\n${pageText}`;
      }

      if (!fullText.trim()) {
        setErrorMessage(
          "PDF는 열렸지만 텍스트를 찾지 못했어. 스캔 PDF일 가능성이 있어."
        );
        return;
      }

      setPdfText(fullText.trim());
    } catch (error) {
      console.error(error);
      setErrorMessage("PDF를 읽는 중 오류가 발생했어.");
    } finally {
      setLoadingPdf(false);
    }
  };

  const analyzePdf = async () => {
    if (!pdfText) {
      alert("먼저 PDF를 업로드해줘.");
      return;
    }

    try {
      setLoadingAi(true);
      setErrorMessage("");
      setAnalysis(null);
      setComicProjects([]);
      setBackCoverImage("");
      setBackCoverText("");

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: pdfText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.error ||
            "교재 분석에 실패했습니다."
        );
      }

      setAnalysis(data);
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          "교재 분석 중 오류가 발생했어."
      );
    } finally {
      setLoadingAi(false);
    }
  };

  const deleteDialogue = (indexToDelete: number) => {
    if (!analysis?.dialogues) return;

    const newDialogues = analysis.dialogues.filter(
      (_, index) => index !== indexToDelete
    );

    setAnalysis({
      ...analysis,
      dialogues: newDialogues,
    });
  };

  const requestComicPlan = async (
    title: string,
    content: string
  ): Promise<ComicPlan> => {
    const response = await fetch("/api/comic-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        content,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.detail ||
          data?.error ||
          "써밋네컷 설계안 생성에 실패했습니다."
      );
    }

    return data;
  };

  const makeComicPlan = async (
    title: string,
    content: string
  ) => {
    try {
      setLoadingComic(true);
      setCurrentCreatingTitle(title);
      setErrorMessage("");

      const plan = await requestComicPlan(
        title,
        content
      );

      const newProject: ComicProject = {
        id: makeId(),
        sourceTitle: title,
        sourceContent: content,
        plan,
        image: "",
        loadingImage: false,
      };

      setComicProjects((prev) => [
        ...prev,
        newProject,
      ]);

      setTimeout(() => {
        document
          .getElementById("comic-projects")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 100);
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          "써밋네컷 설계안 생성 중 오류가 발생했어."
      );
    } finally {
      setLoadingComic(false);
      setCurrentCreatingTitle("");
    }
  };

  const makeAllComicPlans = async () => {
    const dialogues =
      analysis?.dialogues || [];

    if (dialogues.length === 0) {
      alert("남아 있는 대화문이 없어.");
      return;
    }

    try {
      setLoadingAllComics(true);
      setErrorMessage("");
      setComicProjects([]);
      setBackCoverImage("");
      setBackCoverText("");

      const newProjects: ComicProject[] = [];

      for (
        let index = 0;
        index < dialogues.length;
        index++
      ) {
        const dialogue = dialogues[index];

        setCurrentCreatingTitle(
          `${index + 1}/${dialogues.length} · ${dialogue.title}`
        );

        const plan = await requestComicPlan(
          dialogue.title,
          dialogue.content
        );

        newProjects.push({
          id: makeId(),
          sourceTitle: dialogue.title,
          sourceContent: dialogue.content,
          plan,
          image: "",
          loadingImage: false,
        });

        setComicProjects([...newProjects]);
      }

      setTimeout(() => {
        document
          .getElementById("comic-projects")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 100);
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          "전체 설계안 생성 중 오류가 발생했어."
      );
    } finally {
      setLoadingAllComics(false);
      setCurrentCreatingTitle("");
    }
  };

  const updateSummary = (
    projectId: string,
    value: string
  ) => {
    setComicProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? {
              ...project,
              plan: {
                ...project.plan,
                summary: value,
              },
            }
          : project
      )
    );
  };

  const updatePanelScene = (
    projectId: string,
    panelIndex: number,
    value: string
  ) => {
    setComicProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const newPanels = [
          ...project.plan.panels,
        ];

        newPanels[panelIndex] = {
          ...newPanels[panelIndex],
          scene: value,
        };

        return {
          ...project,
          plan: {
            ...project.plan,
            panels: newPanels,
          },
        };
      })
    );
  };

  const updateSpeaker = (
    projectId: string,
    panelIndex: number,
    dialogueIndex: number,
    value: string
  ) => {
    setComicProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const newPanels = [
          ...project.plan.panels,
        ];

        const newDialogue = [
          ...newPanels[panelIndex].dialogue,
        ];

        newDialogue[dialogueIndex] = {
          ...newDialogue[dialogueIndex],
          speaker: value,
        };

        newPanels[panelIndex] = {
          ...newPanels[panelIndex],
          dialogue: newDialogue,
        };

        return {
          ...project,
          plan: {
            ...project.plan,
            panels: newPanels,
          },
        };
      })
    );
  };

  const updateDialogueText = (
    projectId: string,
    panelIndex: number,
    dialogueIndex: number,
    value: string
  ) => {
    setComicProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const newPanels = [
          ...project.plan.panels,
        ];

        const newDialogue = [
          ...newPanels[panelIndex].dialogue,
        ];

        newDialogue[dialogueIndex] = {
          ...newDialogue[dialogueIndex],
          text: value,
        };

        newPanels[panelIndex] = {
          ...newPanels[panelIndex],
          dialogue: newDialogue,
        };

        return {
          ...project,
          plan: {
            ...project.plan,
            panels: newPanels,
          },
        };
      })
    );
  };

  const addDialogue = (
    projectId: string,
    panelIndex: number
  ) => {
    setComicProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const newPanels = [
          ...project.plan.panels,
        ];

        newPanels[panelIndex] = {
          ...newPanels[panelIndex],
          dialogue: [
            ...newPanels[panelIndex]
              .dialogue,
            {
              speaker: "",
              text: "",
            },
          ],
        };

        return {
          ...project,
          plan: {
            ...project.plan,
            panels: newPanels,
          },
        };
      })
    );
  };

  const removeDialogue = (
    projectId: string,
    panelIndex: number,
    dialogueIndex: number
  ) => {
    setComicProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const newPanels = [
          ...project.plan.panels,
        ];

        newPanels[panelIndex] = {
          ...newPanels[panelIndex],
          dialogue:
            newPanels[
              panelIndex
            ].dialogue.filter(
              (_, index) =>
                index !== dialogueIndex
            ),
        };

        return {
          ...project,
          plan: {
            ...project.plan,
            panels: newPanels,
          },
        };
      })
    );
  };

  const removeComicProject = (
    projectId: string
  ) => {
    setComicProjects((prev) =>
      prev.filter(
        (project) =>
          project.id !== projectId
      )
    );

    setBackCoverImage("");
    setBackCoverText("");
  };

  const requestComicImage = async (
    plan: ComicPlan
  ): Promise<string> => {
    const response = await fetch(
      "/api/generate-comic",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(plan),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.detail ||
          data?.error ||
          "만화 이미지 생성에 실패했습니다."
      );
    }

    if (!data.image) {
      throw new Error(
        "생성된 이미지가 없습니다."
      );
    }

    return data.image;
  };

  const generateComicImage = async (
    projectId: string
  ) => {
    const project = comicProjects.find(
      (item) => item.id === projectId
    );

    if (!project) return;

    try {
      setErrorMessage("");

      setComicProjects((prev) =>
        prev.map((item) =>
          item.id === projectId
            ? {
                ...item,
                loadingImage: true,
                image: "",
              }
            : item
        )
      );

      const image =
        await requestComicImage(
          project.plan
        );

      setComicProjects((prev) =>
        prev.map((item) =>
          item.id === projectId
            ? {
                ...item,
                loadingImage: false,
                image,
              }
            : item
        )
      );
    } catch (error: any) {
      setComicProjects((prev) =>
        prev.map((item) =>
          item.id === projectId
            ? {
                ...item,
                loadingImage: false,
              }
            : item
        )
      );

      setErrorMessage(
        error?.message ||
          "만화 이미지 생성 중 오류가 발생했어."
      );
    }
  };

  const generateAllComicImages =
    async () => {
      const targets =
        comicProjects.filter(
          (project) => !project.image
        );

      if (
        comicProjects.length === 0
      ) {
        alert(
          "먼저 설계안을 만들어줘."
        );
        return;
      }

      if (targets.length === 0) {
        alert(
          "모든 설계안의 이미지가 이미 만들어져 있어."
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
          const project =
            targets[index];

          const originalIndex =
            comicProjects.findIndex(
              (item) =>
                item.id === project.id
            );

          setImageProgress(
            `${index + 1}/${targets.length} · 설계안 ${
              originalIndex + 1
            } · ${project.sourceTitle}`
          );

          setComicProjects((prev) =>
            prev.map((item) =>
              item.id === project.id
                ? {
                    ...item,
                    loadingImage: true,
                  }
                : item
            )
          );

          const image =
            await requestComicImage(
              project.plan
            );

          setComicProjects((prev) =>
            prev.map((item) =>
              item.id === project.id
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
          "전체 이미지 생성 완료!"
        );
      } catch (error: any) {
        setErrorMessage(
          error?.message ||
            "전체 이미지 생성 중 오류가 발생했어."
        );
      } finally {
        setLoadingAllImages(false);

        setTimeout(() => {
          setImageProgress("");
        }, 2000);
      }
    };

  const generateBackCover = async () => {
    if (
      comicProjects.length === 0
    ) {
      alert(
        "먼저 써밋네컷 설계안을 만들어줘."
      );
      return;
    }

    try {
      setLoadingBackCover(true);
      setErrorMessage("");

      const response = await fetch(
        "/api/generate-cheer-page",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            plans: comicProjects.map(
              (project) =>
                project.plan
            ),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.error ||
            "뒷표지 생성에 실패했습니다."
        );
      }

      if (!data.image) {
        throw new Error(
          "뒷표지 이미지가 없습니다."
        );
      }

      setBackCoverImage(data.image);
      setBackCoverText(
        data.cheerText || ""
      );
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          "뒷표지 생성 중 오류가 발생했어."
      );
    } finally {
      setLoadingBackCover(false);
    }
  };

  const addToWorkBox = (
    projectId: string
  ) => {
    const project = comicProjects.find(
      (item) => item.id === projectId
    );

    if (
      !project ||
      !project.image
    ) {
      return;
    }

    const alreadyAdded =
      workItems.some(
        (item) =>
          item.title ===
            project.sourceTitle &&
          item.image === project.image
      );

    if (alreadyAdded) {
      alert(
        "이 이미지는 이미 한 과 작업함에 들어가 있어."
      );
      return;
    }

    setWorkItems((prev) => [
      ...prev,
      {
        id: makeId(),
        title:
          project.sourceTitle,
        summary:
          project.plan.summary,
        image: project.image,
      },
    ]);
  };

  const addAllImagesToWorkBox =
    () => {
      const imageProjects =
        comicProjects.filter(
          (project) =>
            Boolean(project.image)
        );

      const newItems =
        imageProjects
          .filter(
            (project) =>
              !workItems.some(
                (item) =>
                  item.title ===
                    project.sourceTitle &&
                  item.image ===
                    project.image
              )
          )
          .map(
            (
              project
            ): WorkItem => ({
              id: makeId(),
              title:
                project.sourceTitle,
              summary:
                project.plan.summary,
              image:
                project.image,
            })
          );

      if (
        newItems.length === 0
      ) {
        alert(
          "새로 작업함에 넣을 이미지가 없어."
        );
        return;
      }

      setWorkItems((prev) => [
        ...prev,
        ...newItems,
      ]);

      alert(
        `${newItems.length}장을 작업함에 추가했어.`
      );
    };

  const removeWorkItem = (
    id: string
  ) => {
    setWorkItems((prev) =>
      prev.filter(
        (item) => item.id !== id
      )
    );
  };

  const moveWorkItem = (
    index: number,
    direction: "up" | "down"
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
      newItems[targetIndex];

    newItems[targetIndex] =
      temp;

    setWorkItems(newItems);
  };

  const loadImage = (
    src: string
  ): Promise<HTMLImageElement> => {
    return new Promise(
      (resolve, reject) => {
        const img = new Image();

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
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width = 1600;
      canvas.height = 1131;

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        throw new Error(
          "표지 캔버스를 만들 수 없습니다."
        );
      }

      const bgColor = "#f8f7f3";
      const black = "#111111";
      const gray = "#505050";
      const white = "#ffffff";

      ctx.fillStyle = bgColor;

      ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      const filmX = 150;
      const filmY = 330;
      const filmWidth = 1300;
      const filmHeight = 390;

      const topLine = [
        schoolName.trim(),
        gradeName.trim(),
      ]
        .filter(Boolean)
        .join("  ·  ");

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      ctx.fillStyle = black;

      ctx.font =
        '700 36px "Noto Sans KR", "Malgun Gothic", sans-serif';

      ctx.fillText(
        topLine ||
          gradeName ||
          "SUMMIT EDU",
        filmX,
        145
      );

      ctx.fillStyle = gray;

      ctx.font =
        '700 42px "Noto Sans KR", "Malgun Gothic", sans-serif';

      ctx.fillText(
        `${
          lessonName.trim() ||
          "Lesson"
        }  ·  ${contentType}`,
        filmX,
        205
      );

      ctx.fillStyle = black;
      ctx.beginPath();

      ctx.roundRect(
        filmX,
        filmY,
        filmWidth,
        filmHeight,
        26
      );

      ctx.fill();

      const holeWidth = 52;
      const holeHeight = 24;
      const holeGap = 30;

      ctx.fillStyle = bgColor;

      for (
        let x = filmX + 35;
        x <
        filmX +
          filmWidth -
          holeWidth -
          20;
        x += holeWidth + holeGap
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

      const innerMarginX = 48;
      const frameGap = 20;
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
        (letter, index) => {
          const x =
            filmX +
            innerMarginX +
            index *
              (frameWidth +
                frameGap);

          ctx.fillStyle = white;

          ctx.fillRect(
            x,
            frameTop,
            frameWidth,
            frameHeight
          );

          ctx.strokeStyle =
            white;

          ctx.lineWidth = 7;

          ctx.strokeRect(
            x,
            frameTop,
            frameWidth,
            frameHeight
          );

          ctx.fillStyle = black;
          ctx.strokeStyle = black;
          ctx.lineWidth = 2;

          ctx.font =
            '900 138px "Noto Sans KR", "Malgun Gothic", sans-serif';

          ctx.textAlign = "center";
          ctx.textBaseline =
            "middle";

          const centerX =
            x + frameWidth / 2;

          const centerY =
            frameTop +
            frameHeight / 2 +
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

        const ratio = Math.min(
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
          canvas.width / 2 -
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

        ctx.fillStyle = black;
        ctx.textAlign = "center";

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
      pageWidth - margin * 2;

    const availableHeight =
      pageHeight - margin * 2;

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
      imageWidth / imageRatio;

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
          "먼저 한 과 작업함에 써밋네컷을 추가해줘."
        );

        return;
      }

      try {
        setMakingPdf(true);

        const coverImage =
          await createCoverImage();

        const pdf = new jsPDF({
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

        if (backCoverImage) {
          pdf.addPage(
            "a4",
            "landscape"
          );

          addImagePageToPdf(
            pdf,
            backCoverImage
          );
        }

        const baseName =
          [
            schoolName.trim(),
            gradeName.trim(),
            lessonName.trim(),
          ]
            .filter(Boolean)
            .join("-") ||
          "summit-lesson";

        pdf.save(
          `${baseName}-써밋네컷.pdf`
        );
      } catch (error) {
        console.error(
          "PDF ERROR:",
          error
        );

        alert(
          "PDF를 만드는 중 오류가 발생했어."
        );
      } finally {
        setMakingPdf(false);
      }
    };

  const generatedImageCount =
    comicProjects.filter(
      (project) =>
        Boolean(project.image)
    ).length;

  const totalPdfPages =
    1 +
    workItems.length +
    (backCoverImage ? 1 : 0);

  if (!schoolLevel) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold text-blue-600">
              SUMMIT EDU
            </p>

            <h1 className="mt-2 text-4xl font-black text-slate-900 md:text-5xl">
              SUMMIT CONTENT MAKER
            </h1>

            <p className="mt-4 text-slate-600">
              만들 콘텐츠의 학년군을 먼저 선택해줘.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setSchoolLevel("middle");
                setWorkMode("");
              }}
              className="rounded-3xl bg-white p-8 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <p className="text-sm font-bold text-purple-600">
                MIDDLE SCHOOL
              </p>

              <h2 className="mt-2 text-3xl font-black text-slate-900">
                중등
              </h2>

              <p className="mt-3 text-slate-500">
                대화문 · 본문
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setSchoolLevel("high");
                setWorkMode("");
              }}
              className="rounded-3xl bg-slate-900 p-8 text-left text-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <p className="text-sm font-bold text-purple-300">
                HIGH SCHOOL
              </p>

              <h2 className="mt-2 text-3xl font-black">
                고등
              </h2>

              <p className="mt-3 text-slate-300">
                써밋네컷 · 요약집
              </p>
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!workMode) {
    const isMiddle = schoolLevel === "middle";

    return (
      <main className="min-h-screen bg-slate-50 px-5 py-12">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() => {
              setSchoolLevel("");
              setWorkMode("");
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-600"
          >
            ← 중등 / 고등 선택으로
          </button>

          <div className="mt-8">
            <p className="text-sm font-bold text-blue-600">
              SUMMIT CONTENT MAKER
            </p>

            <h1 className="mt-2 text-4xl font-black text-slate-900">
              {isMiddle ? "중등" : "고등"} 콘텐츠 선택
            </h1>

            <p className="mt-3 text-slate-600">
              {isMiddle
                ? "대화문 또는 본문 작업을 선택해줘."
                : "써밋네컷 또는 요약집 작업을 선택해줘."}
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {isMiddle ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setWorkMode("dialogue");
                    setContentType("대화문");
                    setGradeName("중3");
                  }}
                  className="rounded-3xl bg-purple-600 p-8 text-left text-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <p className="text-sm font-bold text-purple-200">
                    DIALOGUE
                  </p>

                  <h2 className="mt-2 text-3xl font-black">
                    대화문
                  </h2>

                  <p className="mt-3 text-purple-100">
                    중등 대화문 써밋네컷
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWorkMode("passage");
                    setContentType("본문");
                  }}
                  className="rounded-3xl bg-white p-8 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <p className="text-sm font-bold text-blue-600">
                    PASSAGE
                  </p>

                  <h2 className="mt-2 text-3xl font-black text-slate-900">
                    본문
                  </h2>

                  <p className="mt-3 text-slate-500">
                    중등 본문 작업
                  </p>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/high-test";
                  }}
                  className="rounded-3xl bg-slate-900 p-8 text-left text-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <p className="text-sm font-bold text-purple-300">
                    SUMMIT FOUR-CUT
                  </p>

                  <h2 className="mt-2 text-3xl font-black">
                    써밋네컷
                  </h2>

                  <p className="mt-3 text-slate-300">
                    긴 본문을 흐름대로 나눠 여러 개의 4컷으로
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/high-summary-test";
                  }}
                  className="rounded-3xl border border-slate-200 bg-white p-7 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <p className="text-sm font-bold text-amber-600">
                    SUMMARY BOOK
                  </p>

                  <h2 className="mt-2 text-3xl font-black text-slate-900">
                    요약집
                  </h2>

                  <p className="mt-3 text-slate-500">
                    고등 본문 핵심 요약 자료
                  </p>
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (!(schoolLevel === "middle" && workMode === "dialogue")) {
    const modeTitle =
      workMode === "passage"
        ? "중등 · 본문"
        : workMode === "fourcut"
        ? "고등 · 써밋네컷"
        : "고등 · 요약집";

    return (
      <main className="min-h-screen bg-slate-50 px-5 py-12">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() => setWorkMode("")}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-600"
          >
            ← 콘텐츠 선택으로
          </button>

          <section className="mt-8 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-bold text-purple-600">
              NEXT WORKSPACE
            </p>

            <h1 className="mt-2 text-4xl font-black text-slate-900">
              {modeTitle}
            </h1>

            <p className="mt-4 text-slate-600">
              메뉴 연결 완료. 이 화면부터 다음 기능을 개발하면 돼.
            </p>

            {workMode === "fourcut" && (
              <div className="mt-6 rounded-2xl bg-slate-900 p-6 text-white">
                <p className="text-sm font-bold text-purple-300">
                  다음 개발
                </p>

                <p className="mt-2 text-xl font-black">
                  고등 긴 본문 → 흐름 순서대로 여러 개의 써밋네컷
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => setWorkMode("")}
          className="mb-6 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-600"
        >
          ← 콘텐츠 선택으로
        </button>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-bold text-blue-600">
              SUMMIT EDU
            </p>

            <h1 className="mt-2 text-4xl font-black text-slate-900">
              SUMMIT CONTENT MAKER
            </h1>

            <p className="mt-3 text-slate-600">
              중3 영어 교재의 대화문을 찾아 써밋네컷으로 만들자.
            </p>
          </div>

          <div className="rounded-2xl bg-purple-100 px-5 py-4 text-center ring-1 ring-purple-200">
            <p className="text-xs font-bold text-purple-600">
              한 과 작업함
            </p>

            <p className="mt-1 text-3xl font-black text-purple-900">
              {workItems.length}
            </p>

            <p className="text-xs text-purple-600">
              장 저장됨
            </p>
          </div>
        </div>

        <section className="mt-10 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-bold text-purple-600">
            COVER INFORMATION
          </p>

          <h2 className="mt-1 text-2xl font-black">
            표지 정보
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            여기 입력한 내용이 PDF 첫 장 표지에 들어가.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
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
                placeholder="예: 발안중"
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
                  setGradeName(
                    e.target.value
                  )
                }
                placeholder="예: 3"
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
                  setLessonName(
                    e.target.value
                  )
                }
                placeholder="예: Lesson 5"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                내용 구분
              </label>

              <select
                value={contentType}
                onChange={(e) =>
                  setContentType(
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              >
                <option value="대화문">
                  대화문
                </option>

                <option value="본문">
                  본문
                </option>
              </select>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold">
            1. 중3 교재 PDF 업로드
          </h2>

          <label className="mt-5 inline-block cursor-pointer rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white">
            PDF 선택

            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file =
                  e.target.files?.[0];

                if (!file) return;

                setFileName(
                  file.name
                );

                readPdf(file);
              }}
            />
          </label>

          {fileName && (
            <div className="mt-5 rounded-xl bg-slate-100 p-4">
              <p className="text-xs text-slate-500">
                선택된 파일
              </p>

              <p className="mt-1 font-semibold">
                {fileName}
              </p>
            </div>
          )}
        </section>

        {loadingPdf && (
          <div className="mt-6 rounded-2xl bg-blue-50 p-6 font-semibold text-blue-700">
            PDF 읽는 중...
          </div>
        )}

        {!loadingPdf &&
          pdfText && (
            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-bold">
                2. 대화문 찾기
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                교재 안의 대화문을 모두 찾은 다음 필요한 것만 남기면 돼.
              </p>

              <button
                type="button"
                onClick={
                  analyzePdf
                }
                disabled={
                  loadingAi
                }
                className="mt-5 w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold text-white disabled:opacity-50"
              >
                {loadingAi
                  ? "대화문 찾는 중..."
                  : "대화문 전체 찾기"}
              </button>
            </section>
          )}

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            {errorMessage}
          </div>
        )}

        {analysis && (
          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">
                  발견된 대화문
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  필요 없는 것은 삭제하고 사용할 대화문만 남겨줘.
                </p>
              </div>

              <div className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700">
                {analysis
                  .dialogues
                  ?.length || 0}
                개 남음
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {analysis.dialogues?.map(
                (
                  dialogue,
                  index
                ) => (
                  <div
                    key={`${dialogue.title}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <p className="text-sm font-bold text-blue-600">
                      대화문{" "}
                      {index + 1}
                    </p>

                    <p className="mt-1 text-lg font-bold">
                      {
                        dialogue.title
                      }
                    </p>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {
                        dialogue.content
                      }
                    </p>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          makeComicPlan(
                            dialogue.title,
                            dialogue.content
                          )
                        }
                        disabled={
                          loadingComic ||
                          loadingAllComics
                        }
                        className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-40"
                      >
                        {loadingComic &&
                        currentCreatingTitle ===
                          dialogue.title
                          ? "설계안 만드는 중..."
                          : "이 대화문만 설계안 만들기"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteDialogue(
                            index
                          )
                        }
                        disabled={
                          loadingAllComics
                        }
                        className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 font-bold text-red-600 disabled:opacity-40"
                      >
                        필요 없는 대화문 삭제
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>

            {(analysis
              .dialogues
              ?.length || 0) >
              0 && (
              <div className="mt-8 rounded-2xl bg-purple-50 p-6 ring-1 ring-purple-200">
                <p className="text-sm font-bold text-purple-600">
                  STEP 3
                </p>

                <h3 className="mt-1 text-2xl font-black text-slate-900">
                  남은 대화문 전체 설계안 만들기
                </h3>

                <button
                  type="button"
                  onClick={
                    makeAllComicPlans
                  }
                  disabled={
                    loadingAllComics ||
                    loadingComic
                  }
                  className="mt-5 w-full rounded-xl bg-purple-600 px-6 py-4 text-lg font-black text-white disabled:opacity-50"
                >
                  {loadingAllComics
                    ? `전체 설계안 만드는 중 · ${currentCreatingTitle}`
                    : `남은 ${
                        analysis
                          .dialogues
                          ?.length ||
                        0
                      }개 전체 설계안 만들기`}
                </button>
              </div>
            )}
          </section>
        )}

        {comicProjects.length >
          0 && (
          <section
            id="comic-projects"
            className="mt-10"
          >
            <div className="mb-6">
              <p className="text-sm font-bold text-purple-600">
                SUMMIT FOUR-CUT EDITOR
              </p>

              <h2 className="mt-1 text-3xl font-black">
                써밋네컷 설계안
              </h2>

              <p className="mt-2 text-slate-600">
                현재{" "}
                {
                  comicProjects.length
                }
                개 설계안 · 이미지{" "}
                {
                  generatedImageCount
                }
                개 생성됨
              </p>
            </div>



            <div className="space-y-12">
              {comicProjects.map(
                (
                  project,
                  projectIndex
                ) => (
                  <div
                    key={project.id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="bg-slate-900 p-6 text-white">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-purple-300">
                            설계안{" "}
                            {projectIndex +
                              1}
                          </p>

                          <h3 className="mt-1 text-2xl font-black">
                            {
                              project.sourceTitle
                            }
                          </h3>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeComicProject(
                              project.id
                            )
                          }
                          disabled={
                            loadingAllImages
                          }
                          className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white disabled:opacity-30"
                        >
                          이 설계안 삭제
                        </button>
                      </div>
                    </div>

                    <div className="p-6">
                      <label className="text-sm font-bold">
                        만화 상단 한줄 제목
                      </label>

                      <input
                        value={
                          project.plan
                            .summary
                        }
                        onChange={(e) =>
                          updateSummary(
                            project.id,
                            e.target
                              .value
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-xl font-bold"
                      />

                      <div className="mt-6 grid gap-6 md:grid-cols-2">
                        {project.plan.panels.map(
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
                              <h4 className="text-xl font-bold">
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
                                onChange={(
                                  e
                                ) =>
                                  updatePanelScene(
                                    project.id,
                                    panelIndex,
                                    e.target
                                      .value
                                  )
                                }
                                rows={4}
                                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                              />

                              <div className="mt-5 space-y-4">
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
                                      <input
                                        value={
                                          dialogue.speaker
                                        }
                                        onChange={(
                                          e
                                        ) =>
                                          updateSpeaker(
                                            project.id,
                                            panelIndex,
                                            dialogueIndex,
                                            e
                                              .target
                                              .value
                                          )
                                        }
                                        className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2"
                                      />

                                      <textarea
                                        value={
                                          dialogue.text
                                        }
                                        onChange={(
                                          e
                                        ) =>
                                          updateDialogueText(
                                            project.id,
                                            panelIndex,
                                            dialogueIndex,
                                            e
                                              .target
                                              .value
                                          )
                                        }
                                        rows={
                                          3
                                        }
                                        className="mt-3 w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-lg font-semibold"
                                      />

                                      {panel
                                        .dialogue
                                        .length >
                                        1 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeDialogue(
                                              project.id,
                                              panelIndex,
                                              dialogueIndex
                                            )
                                          }
                                          className="mt-2 text-sm font-bold text-red-500"
                                        >
                                          이 대사 삭제
                                        </button>
                                      )}
                                    </div>
                                  )
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    addDialogue(
                                      project.id,
                                      panelIndex
                                    )
                                  }
                                  className="w-full rounded-xl border-2 border-dashed border-purple-300 py-3 font-bold text-purple-600"
                                >
                                  + 대사 추가
                                </button>
                              </div>
                            </div>
                          )
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          generateComicImage(
                            project.id
                          )
                        }
                        disabled={
                          project.loadingImage ||
                          loadingAllImages
                        }
                        className="mt-6 w-full rounded-xl bg-purple-600 px-6 py-4 text-lg font-black text-white disabled:opacity-50"
                      >
                        {project.loadingImage
                          ? "이미지 생성 중..."
                          : project.image
                          ? "이 이미지 다시 생성"
                          : `설계안 ${
                              projectIndex +
                              1
                            } 이미지 생성`}
                      </button>

                      {project.image && (
                        <div className="mt-6">
                          <img
                            src={
                              project.image
                            }
                            alt="써밋네컷"
                            className="w-full rounded-xl"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              addToWorkBox(
                                project.id
                              )
                            }
                            className="mt-4 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white"
                          >
                            한 과 작업함에 추가
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
                설계안 확인 다 했어?
              </h3>

              <p className="mt-2 text-sm text-slate-300">
                모든 설계안을 확인한 뒤 여기서 한꺼번에 이미지를 생성하면 돼.
              </p>

              <button
                type="button"
                onClick={generateAllComicImages}
                disabled={loadingAllImages}
                className="mt-5 w-full rounded-xl bg-purple-500 px-6 py-4 text-lg font-black text-white disabled:opacity-50"
              >
                {loadingAllImages
                  ? `전체 이미지 생성 중 · ${imageProgress}`
                  : `확인한 설계안 전체 이미지 생성 · ${
                      comicProjects.length - generatedImageCount
                    }개 남음`}
              </button>

              {generatedImageCount > 0 && (
                <button
                  type="button"
                  onClick={addAllImagesToWorkBox}
                  disabled={loadingAllImages}
                  className="mt-3 w-full rounded-xl border border-white/20 bg-white/10 px-6 py-4 font-bold text-white"
                >
                  생성된 이미지 전체 작업함에 추가
                </button>
              )}
            </div>

            <div className="mt-12 rounded-3xl bg-amber-50 p-6 ring-1 ring-amber-200">
              <p className="text-sm font-bold text-amber-600">
                BACK COVER
              </p>

              <h3 className="mt-1 text-2xl font-black text-slate-900">
                뒷표지
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                이 Lesson에 등장한 캐릭터들을 모아 마지막 뒷표지를 만들어.
              </p>

              <p className="mt-1 text-xs text-slate-500">
                뒷표지 생성은 AI 이미지 1장을 사용하므로 이미지 생성 비용이 발생해.
              </p>

              <button
                type="button"
                onClick={
                  generateBackCover
                }
                disabled={
                  loadingBackCover
                }
                className="mt-5 w-full rounded-xl bg-amber-500 px-6 py-4 text-lg font-black text-white disabled:opacity-50"
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
                      {backCoverText}
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
            </div>
          </section>
        )}

        <section className="mt-12 rounded-3xl bg-slate-900 p-6 text-white">
          <div className="flex justify-between gap-5">
            <div>
              <p className="text-sm font-bold text-purple-300">
                LESSON WORKBOX
              </p>

              <h2 className="text-3xl font-black">
                한 과 작업함
              </h2>
            </div>

            <p className="text-3xl font-black">
              {workItems.length}
            </p>
          </div>

          {workItems.length ===
          0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-slate-600 p-8 text-center text-slate-400">
              아직 작업함에 넣은 이미지가 없어.
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
                      <div className="flex justify-between gap-4">
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
                            className="rounded-lg bg-slate-100 px-3 py-2 disabled:opacity-30"
                          >
                            ↑
                          </button>

                          <button
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
                            className="rounded-lg bg-slate-100 px-3 py-2 disabled:opacity-30"
                          >
                            ↓
                          </button>

                          <button
                            onClick={() =>
                              removeWorkItem(
                                item.id
                              )
                            }
                            className="rounded-lg bg-red-50 px-3 py-2 text-red-600"
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
                  표지 1장 + 써밋네컷{" "}
                  {workItems.length}
                  장
                  {backCoverImage
                    ? " + 뒷표지 1장"
                    : ""}
                </p>

                {!backCoverImage && (
                  <p className="mt-2 text-xs text-amber-300">
                    뒷표지를 아직 만들지 않았어. 지금 PDF를 만들면 뒷표지 없이 저장돼.
                  </p>
                )}

                <button
                  type="button"
                  onClick={
                    downloadLessonPdf
                  }
                  disabled={
                    makingPdf
                  }
                  className="mt-5 w-full rounded-xl bg-purple-500 px-6 py-4 text-lg font-black text-white disabled:opacity-50"
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