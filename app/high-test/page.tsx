"use client";

import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { jsPDF } from "jspdf";

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

  const updatePlanField = (
    planIndex: number,
    field: keyof HighComicPlan,
    value: any
  ) => {
    setResult((prev) => {
      if (!prev) return prev;

      const plans = [...prev.plans];
      plans[planIndex] = {
        ...plans[planIndex],
        [field]: value,
      };

      return {
        ...prev,
        plans,
      };
    });
  };

  const updatePanelField = (
    planIndex: number,
    panelIndex: number,
    field: keyof ComicPanel,
    value: any
  ) => {
    setResult((prev) => {
      if (!prev) return prev;

      const plans = [...prev.plans];
      const panels = [...plans[planIndex].panels];

      panels[panelIndex] = {
        ...panels[panelIndex],
        [field]: value,
      };

      plans[planIndex] = {
        ...plans[planIndex],
        panels,
      };

      return {
        ...prev,
        plans,
      };
    });
  };

  const updateDialogue = (
    planIndex: number,
    panelIndex: number,
    dialogueIndex: number,
    field: keyof ComicDialogue,
    value: string
  ) => {
    setResult((prev) => {
      if (!prev) return prev;

      const plans = [...prev.plans];
      const panels = [...plans[planIndex].panels];
      const dialogue = [...panels[panelIndex].dialogue];

      dialogue[dialogueIndex] = {
        ...dialogue[dialogueIndex],
        [field]: value,
      };

      panels[panelIndex] = {
        ...panels[panelIndex],
        dialogue,
      };

      plans[planIndex] = {
        ...plans[planIndex],
        panels,
      };

      return {
        ...prev,
        plans,
      };
    });
  };

  const addDialogue = (
    planIndex: number,
    panelIndex: number
  ) => {
    setResult((prev) => {
      if (!prev) return prev;

      const plans = [...prev.plans];
      const panels = [...plans[planIndex].panels];
      const dialogue = [
        ...panels[panelIndex].dialogue,
        {
          speaker: "화자",
          text: "",
        },
      ];

      panels[panelIndex] = {
        ...panels[panelIndex],
        dialogue,
      };

      plans[planIndex] = {
        ...plans[planIndex],
        panels,
      };

      return {
        ...prev,
        plans,
      };
    });
  };

  const deleteDialogue = (
    planIndex: number,
    panelIndex: number,
    dialogueIndex: number
  ) => {
    setResult((prev) => {
      if (!prev) return prev;

      const plans = [...prev.plans];
      const panels = [...plans[planIndex].panels];

      const dialogue =
        panels[panelIndex].dialogue.filter(
          (_, index) => index !== dialogueIndex
        );

      panels[panelIndex] = {
        ...panels[panelIndex],
        dialogue,
      };

      plans[planIndex] = {
        ...plans[planIndex],
        panels,
      };

      return {
        ...prev,
        plans,
      };
    });
  };

  const [generatedImages, setGeneratedImages] =
    useState<Record<string, string>>({});

  const [generatingId, setGeneratingId] =
    useState<string>("");

  const [generatingAll, setGeneratingAll] =
    useState(false);

  const [batchProgress, setBatchProgress] =
    useState("");

  const [workItems, setWorkItems] =
    useState<
      {
        id: string;
        title: string;
        subtitle: string;
        image: string;
      }[]
    >([]);

  const [makingPdf, setMakingPdf] =
    useState(false);

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

  const generateImageRequest = async (
    plan: HighComicPlan
  ) => {
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

    return data.image as string;
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

      const image =
        await generateImageRequest(plan);

      setGeneratedImages((prev) => ({
        ...prev,
        [plan.id]: image,
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

  const addToWorkbox = (
    plan: HighComicPlan
  ) => {
    const image =
      generatedImages[plan.id];

    if (!image) {
      alert("먼저 이미지를 생성해줘.");
      return;
    }

    setWorkItems((prev) => {
      if (
        prev.some(
          (item) => item.id === plan.id
        )
      ) {
        return prev;
      }

      return [
        ...prev,
        {
          id: plan.id,
          title: plan.englishTitle,
          subtitle: plan.koreanSubtitle,
          image,
        },
      ];
    });
  };

  const addAllToWorkbox = () => {
    if (!result) {
      return;
    }

    const available =
      result.plans.filter(
        (plan) =>
          Boolean(
            generatedImages[plan.id]
          )
      );

    if (available.length === 0) {
      alert("생성된 이미지가 없어.");
      return;
    }

    setWorkItems((prev) => {
      const existingIds =
        new Set(
          prev.map((item) => item.id)
        );

      const newItems =
        available
          .filter(
            (plan) =>
              !existingIds.has(
                plan.id
              )
          )
          .map((plan) => ({
            id: plan.id,
            title:
              plan.englishTitle,
            subtitle:
              plan.koreanSubtitle,
            image:
              generatedImages[
                plan.id
              ],
          }));

      return [
        ...prev,
        ...newItems,
      ];
    });
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

  const createHighCoverImage = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1536;
    canvas.height = 1024;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("표지 캔버스를 만들 수 없어.");
    }

    const white = "#FFFFFF";
    const black = "#111111";

    ctx.fillStyle = "#F7F5ED";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --------------------------------
    // 가벼운 두들 / 낙서 장식
    // --------------------------------

    ctx.save();

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const drawSpark = (
      x: number,
      y: number,
      size: number,
      color: string
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;

      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x, y + size);
      ctx.moveTo(x - size, y);
      ctx.lineTo(x + size, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(
        x - size * 0.65,
        y - size * 0.65
      );
      ctx.lineTo(
        x + size * 0.65,
        y + size * 0.65
      );
      ctx.moveTo(
        x + size * 0.65,
        y - size * 0.65
      );
      ctx.lineTo(
        x - size * 0.65,
        y + size * 0.65
      );
      ctx.stroke();
    };

    const drawStar = (
      cx: number,
      cy: number,
      radius: number,
      color: string
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;

      ctx.beginPath();

      for (let i = 0; i < 10; i++) {
        const angle =
          -Math.PI / 2 +
          (Math.PI * i) / 5;

        const r =
          i % 2 === 0
            ? radius
            : radius * 0.42;

        const x =
          cx + Math.cos(angle) * r;

        const y =
          cy + Math.sin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.closePath();
      ctx.stroke();
    };

    // 왼쪽 위 작은 강조선
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 6;

    ctx.beginPath();
    ctx.moveTo(105, 300);
    ctx.lineTo(75, 275);
    ctx.moveTo(125, 280);
    ctx.lineTo(112, 245);
    ctx.moveTo(92, 330);
    ctx.lineTo(52, 325);
    ctx.stroke();

    // 별 / 반짝임
    drawStar(
      1390,
      250,
      28,
      "#FBBF24"
    );

    drawSpark(
      1430,
      360,
      20,
      "#60A5FA"
    );

    drawSpark(
      105,
      760,
      17,
      "#34D399"
    );

    drawStar(
      1360,
      760,
      22,
      "#F472B6"
    );

    // 오른쪽 아래 느슨한 곡선
    ctx.strokeStyle = "#818CF8";
    ctx.lineWidth = 5;

    ctx.beginPath();
    ctx.moveTo(1320, 690);
    ctx.bezierCurveTo(
      1390,
      720,
      1435,
      690,
      1410,
      650
    );
    ctx.bezierCurveTo(
      1390,
      620,
      1435,
      610,
      1450,
      640
    );
    ctx.stroke();

    // 작은 동그라미
    ctx.strokeStyle = "#38BDF8";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.arc(
      135,
      820,
      10,
      0,
      Math.PI * 2
    );
    ctx.stroke();

    ctx.restore();

    const loadImage = (src: string) =>
      new Promise<HTMLImageElement>(
        (resolve, reject) => {
          const image = new Image();

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

    // --------------------------------
    // 학교 / 학년
    // --------------------------------

    const schoolLine =
      [schoolName.trim(), gradeName.trim()]
        .filter(Boolean)
        .join(" ");

    ctx.fillStyle = black;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.font =
      '700 36px "Noto Sans KR", "Malgun Gothic", sans-serif';

    ctx.fillText(
      schoolLine || "고등부",
      150,
      150
    );

    // --------------------------------
    // Lesson + 써밋네컷
    // --------------------------------

    ctx.font =
      '800 42px "Noto Sans KR", "Malgun Gothic", sans-serif';

    const lessonText =
      lessonName.trim() || "Lesson";

    ctx.fillText(
      lessonText,
      150,
      215
    );

    // --------------------------------
    // 필름
    // --------------------------------

    const filmX = 150;
    const filmY = 330;
    const filmWidth = 1236;
    const filmHeight = 390;

    ctx.fillStyle = black;

    ctx.fillRect(
      filmX,
      filmY,
      filmWidth,
      filmHeight
    );

    // 필름 위/아래 구멍
    const holeWidth = 28;
    const holeHeight = 24;
    const holeGap = 22;

    for (
      let x = filmX + 22;
      x <
      filmX +
        filmWidth -
        holeWidth -
        10;
      x += holeWidth + holeGap
    ) {
      ctx.fillStyle = white;

      ctx.fillRect(
        x,
        filmY + 15,
        holeWidth,
        holeHeight
      );

      ctx.fillRect(
        x,
        filmY +
          filmHeight -
          holeHeight -
          15,
        holeWidth,
        holeHeight
      );
    }

    const letters = [
      "써",
      "밋",
      "네",
      "컷",
    ];

    const innerMarginX = 34;
    const frameGap = 14;

    const frameTop =
      filmY + 60;

    const frameHeight =
      filmHeight - 120;

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

        ctx.fillStyle = black;
        ctx.strokeStyle = black;
        ctx.lineWidth = 2;

        ctx.font =
          '900 138px "Noto Sans KR", "Malgun Gothic", sans-serif';

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

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

    // --------------------------------
    // 공식 SUMMIT 로고
    // 중등과 같은 방식 + 안전 영역
    // --------------------------------

    try {
      const logo =
        await loadImage(
          "/summit-logo-trimmed.png"
        );

      const maxLogoWidth = 250;
      const maxLogoHeight = 160;

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
        805,
        logoWidth,
        logoHeight
      );
    } catch (error) {
      console.error(
        "HIGH COVER LOGO ERROR:",
        error
      );

      ctx.fillStyle = black;
      ctx.textAlign = "center";

      ctx.font =
        '800 36px "Noto Sans KR", "Malgun Gothic", sans-serif';

      ctx.fillText(
        "SUMMIT EDU",
        canvas.width / 2,
        880
      );
    }

    return canvas.toDataURL(
      "image/png",
      1
    );
  };

  const createHighBackCoverImage = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1536;
    canvas.height = 1024;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("뒷표지 캔버스를 만들 수 없어.");
    }

    ctx.fillStyle = "#111827";
    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";

    ctx.font = "900 64px sans-serif";
    ctx.fillText(
      "끝까지 읽었으면",
      768,
      360
    );

    ctx.font = "900 78px sans-serif";
    ctx.fillText(
      "이미 반은 끝난 거지.",
      768,
      460
    );

    ctx.fillStyle = "#C4B5FD";
    ctx.font = "700 32px sans-serif";
    ctx.fillText(
      "SUMMIT EDU",
      768,
      550
    );

    const logo = new Image();
    logo.src = "/summit-logo.png";

    await new Promise<void>(
      (resolve, reject) => {
        logo.onload = () => resolve();
        logo.onerror = () =>
          reject(
            new Error(
              "SUMMIT 로고를 불러오지 못했어."
            )
          );
      }
    );

    const logoWidth = 360;
    const logoHeight =
      (logo.height / logo.width) *
      logoWidth;

    ctx.drawImage(
      logo,
      (1536 - logoWidth) / 2,
      690,
      logoWidth,
      logoHeight
    );

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

    pdf.addImage(
      image,
      "PNG",
      0,
      0,
      pageWidth,
      pageHeight,
      undefined,
      "FAST"
    );
  };

  const fetchPdfPageImage = async (
    url: string,
    extraBody: Record<string, any> = {}
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
        ...extraBody,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.detail ||
          data?.error ||
          "PDF 페이지 생성에 실패했습니다."
      );
    }

    if (!data?.image) {
      throw new Error("생성된 페이지 이미지가 없습니다.");
    }

    return data.image as string;
  };

  const compressReferenceImage = async (
    dataUrl: string
  ) => {
    return new Promise<string>(
      (resolve, reject) => {
        const image = new Image();

        image.onload = () => {
          const maxWidth = 480;
          const maxHeight = 320;

          const scale = Math.min(
            maxWidth / image.width,
            maxHeight / image.height,
            1
          );

          const width = Math.round(
            image.width * scale
          );

          const height = Math.round(
            image.height * scale
          );

          const canvas =
            document.createElement("canvas");

          canvas.width = width;
          canvas.height = height;

          const ctx =
            canvas.getContext("2d");

          if (!ctx) {
            reject(
              new Error(
                "참조 이미지 압축에 실패했어."
              )
            );
            return;
          }

          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(
            0,
            0,
            width,
            height
          );

          ctx.drawImage(
            image,
            0,
            0,
            width,
            height
          );

          resolve(
            canvas.toDataURL(
              "image/jpeg",
              0.35
            )
          );
        };

        image.onerror = () => {
          reject(
            new Error(
              "참조 이미지를 읽지 못했어."
            )
          );
        };

        image.src = dataUrl;
      }
    );
  };

  const makeFinalPdf = async () => {
    if (workItems.length === 0) {
      alert(
        "먼저 이미지를 작업함에 추가해줘."
      );
      return;
    }

    try {
      setMakingPdf(true);

      const coverImage =
        await createHighCoverImage();

      const referenceImages =
        await Promise.all(
          workItems
            .slice(0, 1)
            .map(
              (item) =>
                compressReferenceImage(
                  item.image
                )
            )
        );

      const backCoverImage =
        await fetchPdfPageImage(
          "/api/high-back-cover",
          {
            referenceImages,
          }
        );

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      addImagePageToPdf(
        pdf,
        coverImage
      );

      for (
        let index = 0;
        index < workItems.length;
        index++
      ) {
        pdf.addPage(
          "a4",
          "landscape"
        );

        addImagePageToPdf(
          pdf,
          workItems[index].image
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
          gradeName.trim(),
          lessonName.trim(),
        ]
          .filter(Boolean)
          .join("-") ||
        "summit-high";

      pdf.save(
        `${baseName}-고등-써밋네컷.pdf`
      );
    } catch (error) {
      console.error(
        "HIGH PDF ERROR:",
        error
      );

      alert(
        "고등 PDF를 만드는 중 오류가 발생했어."
      );
    } finally {
      setMakingPdf(false);
    }
  };

  const generateAllImages = async () => {
    if (!result) {
      return;
    }

    const remainingPlans =
      result.plans.filter(
        (plan) =>
          !generatedImages[plan.id]
      );

    if (remainingPlans.length === 0) {
      alert("이미 모든 이미지가 생성되어 있어.");
      return;
    }

    const confirmed = window.confirm(
      `아직 생성되지 않은 이미지 ${remainingPlans.length}장을 순서대로 만들 거야. 이미지 생성 비용이 발생해. 계속할까?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setGeneratingAll(true);
      setErrorMessage("");

      for (
        let index = 0;
        index < remainingPlans.length;
        index++
      ) {
        const plan =
          remainingPlans[index];

        setGeneratingId(plan.id);

        setBatchProgress(
          `${index + 1} / ${remainingPlans.length} 생성 중 · ${plan.englishTitle}`
        );

        const image =
          await generateImageRequest(plan);

        setGeneratedImages((prev) => ({
          ...prev,
          [plan.id]: image,
        }));
      }

      setBatchProgress(
        `완료 · ${remainingPlans.length}장 생성`
      );
    } catch (error: any) {
      console.error(
        "HIGH BATCH IMAGE ERROR:",
        error
      );

      setErrorMessage(
        error?.message ||
          "전체 이미지 생성 중 오류가 발생했습니다."
      );

      setBatchProgress(
        "중간에 오류가 발생했어. 이미 만들어진 이미지는 그대로 유지돼."
      );
    } finally {
      setGeneratingId("");
      setGeneratingAll(false);
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

                      <input
                        value={plan.englishTitle}
                        onChange={(e) =>
                          updatePlanField(
                            planIndex,
                            "englishTitle",
                            e.target.value
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-3xl font-black text-white outline-none"
                      />

                      <input
                        value={plan.koreanSubtitle}
                        onChange={(e) =>
                          updatePlanField(
                            planIndex,
                            "koreanSubtitle",
                            e.target.value
                          )
                        }
                        className="mt-3 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xl font-bold text-slate-100 outline-none"
                      />
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

                          <textarea
                            value={plan.blockSummary}
                            onChange={(e) =>
                              updatePlanField(
                                planIndex,
                                "blockSummary",
                                e.target.value
                              )
                            }
                            rows={4}
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 leading-6 text-slate-700"
                          />
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

                                <textarea
                                  value={panel.scene}
                                  onChange={(e) =>
                                    updatePanelField(
                                      planIndex,
                                      panelIndex,
                                      "scene",
                                      e.target.value
                                    )
                                  }
                                  rows={4}
                                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 leading-6 text-slate-700"
                                />
                              </div>

                              <div className="mt-4">
                                <p className="text-xs font-bold text-emerald-600">
                                  등장인물
                                </p>

                                <textarea
                                  value={panel.characters}
                                  onChange={(e) =>
                                    updatePanelField(
                                      planIndex,
                                      panelIndex,
                                      "characters",
                                      e.target.value
                                    )
                                  }
                                  rows={3}
                                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 leading-6 text-slate-700"
                                />
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
                                      <input
                                        value={dialogue.speaker}
                                        onChange={(e) =>
                                          updateDialogue(
                                            planIndex,
                                            panelIndex,
                                            dialogueIndex,
                                            "speaker",
                                            e.target.value
                                          )
                                        }
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-purple-600"
                                      />

                                      <textarea
                                        value={dialogue.text}
                                        onChange={(e) =>
                                          updateDialogue(
                                            planIndex,
                                            panelIndex,
                                            dialogueIndex,
                                            "text",
                                            e.target.value
                                          )
                                        }
                                        rows={3}
                                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-lg font-bold leading-7 text-slate-900"
                                      />

                                      <button
                                        type="button"
                                        onClick={() =>
                                          deleteDialogue(
                                            planIndex,
                                            panelIndex,
                                            dialogueIndex
                                          )
                                        }
                                        className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-600"
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
                                    planIndex,
                                    panelIndex
                                  )
                                }
                                className="mt-4 w-full rounded-xl border-2 border-dashed border-purple-300 px-4 py-3 text-sm font-black text-purple-600"
                              >
                                + 대사 추가
                              </button>
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
                        <div className="mt-6">
                          <div className="overflow-hidden rounded-3xl bg-slate-100 p-3">
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

                          <button
                            type="button"
                            onClick={() =>
                              addToWorkbox(
                                plan
                              )
                            }
                            disabled={workItems.some(
                              (item) =>
                                item.id ===
                                plan.id
                            )}
                            className="mt-4 w-full rounded-2xl bg-emerald-600 px-6 py-4 font-black text-white disabled:bg-slate-300"
                          >
                            {workItems.some(
                              (item) =>
                                item.id ===
                                plan.id
                            )
                              ? "작업함에 추가됨"
                              : "이 이미지 작업함에 추가"}
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                )
              )}
            </div>

            <div className="mt-8 rounded-3xl bg-purple-50 p-6 ring-1 ring-purple-200">
              <p className="text-sm font-bold text-purple-600">
                전체 이미지 생성
              </p>

              <h3 className="mt-1 text-2xl font-black text-slate-900">
                확인한 설계안 전체 이미지 생성
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                이미 만들어진 이미지는 건너뛰고,
                아직 없는 블록만 순서대로 생성해.
              </p>

              <button
                type="button"
                onClick={generateAllImages}
                disabled={
                  generatingAll ||
                  Boolean(generatingId)
                }
                className="mt-5 w-full rounded-2xl bg-purple-600 px-6 py-4 text-lg font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingAll
                  ? "전체 이미지 생성 중..."
                  : "확인한 설계안 전체 이미지 생성"}
              </button>

              {batchProgress && (
                <div className="mt-4 rounded-xl bg-white p-4 text-sm font-bold text-slate-700 ring-1 ring-purple-200">
                  {batchProgress}
                </div>
              )}

              <p className="mt-3 text-center text-xs font-semibold text-slate-500">
                ⚠️ 생성되는 이미지 수만큼 이미지 API 비용이 발생해.
              </p>
            </div>

            <div className="mt-6 rounded-3xl bg-emerald-50 p-6 ring-1 ring-emerald-200">
              <p className="text-sm font-bold text-emerald-600">
                작업함
              </p>

              <h3 className="mt-1 text-2xl font-black text-slate-900">
                생성된 이미지 전체 작업함에 추가
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                현재 생성되어 있는 이미지만 추가하고,
                이미 작업함에 있는 이미지는 건너뛰어.
              </p>

              <button
                type="button"
                onClick={addAllToWorkbox}
                className="mt-5 w-full rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-black text-white"
              >
                생성된 이미지 전체 작업함에 추가
              </button>
            </div>

          </section>
        )}

        {workItems.length > 0 && (
          <section className="mt-10 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-emerald-600">
                  WORKBOX
                </p>

                <h2 className="mt-1 text-2xl font-black text-slate-900">
                  고등 써밋네컷 작업함
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  현재 {workItems.length}장
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {workItems.map(
                (item, index) => (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                  >
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full"
                    />

                    <div className="p-4">
                      <p className="text-xs font-black text-emerald-600">
                        PAGE {index + 1}
                      </p>

                      <p className="mt-1 font-black text-slate-900">
                        {item.title}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {item.subtitle}
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          removeWorkItem(
                            item.id
                          )
                        }
                        className="mt-4 w-full rounded-xl bg-red-50 px-4 py-3 text-sm font-black text-red-600"
                      >
                        작업함에서 삭제
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        )}


        {workItems.length > 0 && (
          <section className="mt-8 rounded-3xl bg-slate-900 p-6 text-white">
            <p className="text-sm font-bold text-purple-300">
              FINAL PDF
            </p>

            <h2 className="mt-1 text-2xl font-black">
              고등 써밋네컷 최종 PDF
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              앞표지 + 작업함 이미지 {workItems.length}장 + 뒷표지
              순서로 PDF를 만들어.
            </p>

            <div className="mt-4 rounded-2xl bg-white/10 p-4">
              <p className="text-sm font-bold text-slate-200">
                총 {workItems.length + 2}페이지
              </p>
            </div>

            <button
              type="button"
              onClick={makeFinalPdf}
              disabled={makingPdf}
              className="mt-5 w-full rounded-2xl bg-white px-6 py-4 text-lg font-black text-slate-900 disabled:opacity-50"
            >
              {makingPdf
                ? "최종 PDF 만드는 중..."
                : "앞표지 · 본문 · 뒷표지 PDF 저장"}
            </button>
          </section>
        )}


      </div>
    </main>
  );
}