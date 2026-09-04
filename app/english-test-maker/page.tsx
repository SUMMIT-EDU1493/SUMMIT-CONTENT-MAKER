"use client";

import { useEffect, useMemo, useState } from "react";
import HomeButton from "../components/HomeButton";

type SavedPassage = {
  id: string;
  title: string;
  source: string;
  createdAt: string;
};

type ExtractedPassage = {
  id: string;
  title: string;
  source: string;
};

type GeneratedQuestion = {
  id: string;
  passageId: string;
  passageTitle: string;
  type: string;
  difficulty: string;
  stem: string;
  passage: string;
  boxTitle: string;
  boxText: string;
  choices: string[];
  supplementaryItems: string[];
  answer: string;
  explanation: string;
  keyPoint: string;
};

type QuestionHistoryItem = {
  passageId: string;
  type: string;
  stem: string;
  answer: string;
  keyPoint: string;
};

const QUESTION_TYPES = [
  "제목",
  "주제",
  "요지",
  "내용 일치·불일치",
  "어휘",
  "빈칸 추론",
];

const COLORS = [
  { name: "민트", value: "#8FE7C1" },
  { name: "레몬", value: "#F6E77A" },
  { name: "블루", value: "#A9D8FF" },
  { name: "라벤더", value: "#D9C6FF" },
  { name: "코랄", value: "#FFB7A6" },
  { name: "그레이", value: "#CBD5E1" },
];

const DIFFICULTIES = ["기본", "중상", "고난도"];

const STORAGE_KEY = "summit-english-passages";
const QUESTION_HISTORY_KEY = "summit-english-question-history";

function makePassageId(source: string) {
  const normalized = source
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  let hash = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }

  return `passage-${hash.toString(16)}`;
}

export default function EnglishTestMakerPage() {
  const [schoolName, setSchoolName] = useState("");
  const [gradeName, setGradeName] = useState("");
  const [rangeName, setRangeName] = useState("");

  const [savedPassages, setSavedPassages] = useState<SavedPassage[]>([]);
  const [selectedPassageIds, setSelectedPassageIds] = useState<string[]>([]);

  const [extractedPassages, setExtractedPassages] = useState<
    ExtractedPassage[]
  >([]);

  const [selectedExtractedIds, setSelectedExtractedIds] = useState<string[]>(
    []
  );

  const [pdfFileName, setPdfFileName] = useState("");
  const [readingPdf, setReadingPdf] = useState(false);
  const [analyzingPdf, setAnalyzingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");

  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "주제·제목",
    "내용 일치·불일치",
  ]);

  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({
    "주제·제목": 1,
    "내용 일치·불일치": 1,
  });

  const [difficulties, setDifficulties] = useState<string[]>(["기본"]);

  const [themeColor, setThemeColor] = useState(COLORS[0].value);

  const [generatedQuestions, setGeneratedQuestions] = useState<
    GeneratedQuestion[]
  >([]);

  const [generatingQuestions, setGeneratingQuestions] = useState(false);

  const [questionStatus, setQuestionStatus] = useState("");

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null
  );

  const [transformingQuestionId, setTransformingQuestionId] =
    useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        setSavedPassages(parsed);
      }
    } catch {
      console.error("저장된 지문을 불러오지 못했습니다.");
    }
  }, []);

  const totalQuestions = useMemo(() => {
    return selectedTypes.reduce(
      (sum, type) => sum + (questionCounts[type] || 0),
      0
    );
  }, [selectedTypes, questionCounts]);

  const savePassageList = (passages: SavedPassage[]) => {
    setSavedPassages(passages);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(passages));
  };

  const toggleQuestionType = (type: string) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((item) => item !== type);
      }

      return [...prev, type];
    });

    setQuestionCounts((prev) => ({
      ...prev,
      [type]: prev[type] || 1,
    }));
  };

  const toggleSavedPassage = (id: string) => {
    setSelectedPassageIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }

      return [...prev, id];
    });
  };

  const toggleExtractedPassage = (id: string) => {
    setSelectedExtractedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }

      return [...prev, id];
    });
  };

  const toggleDifficulty = (difficulty: string) => {
    setDifficulties((prev) => {
      if (prev.includes(difficulty)) {
        if (prev.length === 1) {
          return prev;
        }

        return prev.filter((item) => item !== difficulty);
      }

      return [...prev, difficulty];
    });
  };

  const deleteSavedPassage = (id: string) => {
    const next = savedPassages.filter((item) => item.id !== id);

    savePassageList(next);

    setSelectedPassageIds((prev) =>
      prev.filter((selectedId) => selectedId !== id)
    );
  };

  const saveExtractedPassages = (onlySelected: boolean) => {
    const targets = onlySelected
      ? extractedPassages.filter((item) =>
          selectedExtractedIds.includes(item.id)
        )
      : extractedPassages;

    if (targets.length === 0) {
      alert("저장할 지문을 선택해 주세요.");
      return;
    }

    const existingIds = new Set(savedPassages.map((item) => item.id));

    const newItems: SavedPassage[] = [];

    for (const passage of targets) {
      const id = makePassageId(passage.source);

      if (existingIds.has(id)) {
        continue;
      }

      existingIds.add(id);

      newItems.push({
        id,
        title: passage.title,
        source: passage.source,
        createdAt: new Date().toISOString(),
      });
    }

    if (newItems.length === 0) {
      alert("선택한 지문은 이미 라이브러리에 저장되어 있습니다.");
      return;
    }

    const next = [...savedPassages, ...newItems];

    savePassageList(next);

    setSelectedPassageIds((prev) => [
      ...new Set([...prev, ...newItems.map((item) => item.id)]),
    ]);

    alert(`${newItems.length}개의 지문을 저장했습니다.`);
  };

  const extractPdfText = async (file: File) => {
    try {
      setReadingPdf(true);
      setAnalyzingPdf(false);
      setPdfStatus("PDF에서 텍스트를 읽고 있습니다...");
      setExtractedPassages([]);
      setSelectedExtractedIds([]);
      setPdfFileName(file.name);

      const pdfjs = await import("pdfjs-dist");

      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();

      const pdf = await pdfjs.getDocument({
        data: arrayBuffer,
      }).promise;

      let fullText = "";

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        setPdfStatus(
          `PDF 읽는 중... ${pageNumber} / ${pdf.numPages} 페이지`
        );

        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const pageText = content.items
          .map((item) => {
            if ("str" in item) {
              return item.str;
            }

            return "";
          })
          .join(" ");

        fullText += `\n\n--- PAGE ${pageNumber} ---\n\n${pageText}`;
      }

      if (!fullText.trim()) {
        throw new Error("PDF에서 텍스트를 추출하지 못했습니다.");
      }

      setReadingPdf(false);
      setAnalyzingPdf(true);
      setPdfStatus("AI가 영어 지문을 찾아 분리하고 있습니다...");

      const response = await fetch("/api/english-test-passages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceText: fullText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "영어 지문 분석 중 오류가 발생했습니다."
        );
      }

      const passages: ExtractedPassage[] = Array.isArray(data?.passages)
        ? data.passages.map(
            (
              item: {
                title?: string;
                source?: string;
              },
              index: number
            ) => ({
              id: `extracted-${Date.now()}-${index}`,
              title: item.title || `Passage ${index + 1}`,
              source: item.source || "",
            })
          )
        : [];

      if (passages.length === 0) {
        throw new Error("사용 가능한 영어 지문을 찾지 못했습니다.");
      }

      setExtractedPassages(passages);
      setSelectedExtractedIds(passages.map((item) => item.id));

      setPdfStatus(
        `${passages.length}개의 영어 지문을 찾았습니다. 저장할 지문을 확인해 주세요.`
      );
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "PDF 분석 중 오류가 발생했습니다.";

      setPdfStatus(message);
      alert(message);
    } finally {
      setReadingPdf(false);
      setAnalyzingPdf(false);
    }
  };

  const selectAllSavedPassages = () => {
    setSelectedPassageIds(savedPassages.map((passage) => passage.id));
  };

  const clearAllSavedPassages = () => {
    setSelectedPassageIds([]);
  };

  const selectAllQuestionTypes = () => {
    setSelectedTypes([...QUESTION_TYPES]);

    setQuestionCounts((prev) => {
      const next = { ...prev };

      QUESTION_TYPES.forEach((type) => {
        next[type] = next[type] || 1;
      });

      return next;
    });
  };

  const clearAllQuestionTypes = () => {
    setSelectedTypes([]);
  };

  const transformQuestion = async (
    question: GeneratedQuestion,
    mode: string
  ) => {
    try {
      setTransformingQuestionId(question.id);

      const originalPassage = savedPassages.find(
        (item) => item.id === question.passageId
      );

      const response = await fetch("/api/english-test-transform", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          mode,
          originalSource: originalPassage?.source || question.passage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "문제 변형 중 오류가 발생했습니다."
        );
      }

      const transformed = data?.question as GeneratedQuestion;

      setGeneratedQuestions((prev) =>
        prev.map((item) =>
          item.id === question.id
            ? {
                ...transformed,
                id: question.id,
              }
            : item
        )
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "문제 변형 중 오류가 발생했습니다.";

      alert(message);
    } finally {
      setTransformingQuestionId(null);
    }
  };

  const makeQuestions = async () => {
    if (selectedPassageIds.length === 0) {
      alert("출제에 사용할 지문을 선택해 주세요.");
      return;
    }

    if (selectedTypes.length === 0) {
      alert("문제 유형을 하나 이상 선택해 주세요.");
      return;
    }

    const selectedPassages = savedPassages.filter((passage) =>
      selectedPassageIds.includes(passage.id)
    );

    const questionRequests = selectedTypes.map((type) => ({
      type,
      count: questionCounts[type] || 1,
    }));

    let previousQuestions: QuestionHistoryItem[] = [];

    try {
      const raw = localStorage.getItem(QUESTION_HISTORY_KEY);

      if (raw) {
        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed)) {
          previousQuestions = parsed;
        }
      }
    } catch {
      previousQuestions = [];
    }

    try {
      setGeneratingQuestions(true);
      setQuestionStatus(
        `${totalQuestions}개의 변형문제를 제작하고 있습니다...`
      );

      const response = await fetch("/api/english-test-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          passages: selectedPassages,
          questionRequests,
          difficulties,
          previousQuestions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "변형문제 생성 중 오류가 발생했습니다."
        );
      }

      const questions: GeneratedQuestion[] = Array.isArray(data?.questions)
        ? data.questions
        : [];

      if (questions.length === 0) {
        throw new Error("생성된 문제가 없습니다.");
      }

      setGeneratedQuestions(questions);

      const newHistory: QuestionHistoryItem[] = questions.map((question) => ({
        passageId: question.passageId,
        type: question.type,
        stem: question.stem,
        answer: question.answer,
        keyPoint: question.keyPoint,
      }));

      const combinedHistory = [
        ...previousQuestions,
        ...newHistory,
      ].slice(-300);

      localStorage.setItem(
        QUESTION_HISTORY_KEY,
        JSON.stringify(combinedHistory)
      );

      setQuestionStatus(
        `${questions.length}개의 변형문제가 생성되었습니다.`
      );
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "변형문제 생성 중 오류가 발생했습니다.";

      setQuestionStatus(message);
      alert(message);
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const updateQuestion = (
    id: string,
    field: keyof GeneratedQuestion,
    value: string | string[]
  ) => {
    setGeneratedQuestions((prev) =>
      prev.map((question) =>
        question.id === id
          ? {
              ...question,
              [field]: value,
            }
          : question
      )
    );
  };

  const renderPassageText = (text: string) => {
    const parts = text.split(/(__[^_]+__)/g);

    return parts.map((part, index) => {
      if (part.startsWith("__") && part.endsWith("__")) {
        return (
          <span
            key={index}
            className="underline decoration-2 underline-offset-4"
          >
            {part.slice(2, -2)}
          </span>
        );
      }

      return <span key={index}>{part}</span>;
    });
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);

    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  };

  const downloadExamPdf = async (
    mode: "questions" | "answers"
  ) => {
    if (generatedQuestions.length === 0) {
      alert("먼저 변형문제를 생성해 주세요.");
      return;
    }

    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    // ---------------------------------------------
    // 한글 폰트
    // ---------------------------------------------
    const fontResponse = await fetch(
      "/fonts/NotoSansKR-Bold.ttf"
    );

    if (!fontResponse.ok) {
      alert("PDF 한글 폰트를 불러오지 못했습니다.");
      return;
    }

    const fontBuffer = await fontResponse.arrayBuffer();
    const fontBase64 = arrayBufferToBase64(fontBuffer);

    doc.addFileToVFS(
      "NotoSansKR-Bold.ttf",
      fontBase64
    );

    doc.addFont(
      "NotoSansKR-Bold.ttf",
      "NotoKR",
      "normal"
    );

    // ---------------------------------------------
    // 테마 컬러
    // ---------------------------------------------
    const themeMap: Record<
      string,
      [number, number, number]
    > = {
      mint: [72, 187, 160],
      lemon: [220, 184, 55],
      blue: [73, 144, 226],
      lavender: [145, 117, 210],
      coral: [225, 111, 101],
      gray: [105, 116, 130],
    };

    const accent =
      themeMap[themeColor] || themeMap.mint;

    const pageWidth = 210;
    const pageHeight = 297;

    const outerMargin = 12;
    const centerGap = 8;

    const columnWidth =
      (pageWidth -
        outerMargin * 2 -
        centerGap) /
      2;

    const leftColumnX = outerMargin;

    const rightColumnX =
      outerMargin +
      columnWidth +
      centerGap;

    const contentTop = 35;
    const contentBottom = 283;

    let column: 0 | 1 = 0;
    let cursorY = contentTop;
    let pageNo = 1;

    const getColumnX = () =>
      column === 0
        ? leftColumnX
        : rightColumnX;

    const cleanUnderlineMarkers = (
      value: string
    ) => value.replace(/__/g, "");

    const drawHeader = () => {
      // 상단 브랜드
      doc.setFont("NotoKR", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...accent);

      doc.text(
        "SUMMIT VISUAL LAB",
        outerMargin,
        11
      );

      doc.setFontSize(16);
      doc.setTextColor(25, 32, 45);

      doc.text(
        mode === "questions"
          ? "고등영어 변형문제"
          : "고등영어 정답 · 해설",
        outerMargin,
        19
      );

      doc.setFontSize(8.5);
      doc.setTextColor(90, 99, 112);

      const meta = [
        schoolName,
        gradeName,
        rangeName,
      ]
        .filter(Boolean)
        .join("   |   ");

      if (meta) {
        doc.text(
          meta,
          outerMargin,
          25.5
        );
      }

      // 상단 포인트 라인
      doc.setDrawColor(...accent);
      doc.setLineWidth(0.7);

      doc.line(
        outerMargin,
        29,
        pageWidth - outerMargin,
        29
      );

      // 가운데 2단 구분선
      doc.setDrawColor(218, 222, 228);
      doc.setLineWidth(0.25);

      doc.line(
        pageWidth / 2,
        contentTop - 1,
        pageWidth / 2,
        contentBottom
      );

      // 페이지 번호
      doc.setFont("NotoKR", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(130, 136, 145);

      doc.text(
        String(pageNo),
        pageWidth / 2,
        291,
        { align: "center" }
      );
    };

    const nextColumn = () => {
      if (column === 0) {
        column = 1;
        cursorY = contentTop;
      } else {
        doc.addPage();
        pageNo += 1;
        column = 0;
        cursorY = contentTop;
        drawHeader();
      }
    };

    const ensureSpace = (
      requiredHeight: number
    ) => {
      if (
        cursorY + requiredHeight >
        contentBottom
      ) {
        nextColumn();
      }
    };

    const splitKR = (
      value: string,
      width: number,
      size: number
    ) => {
      doc.setFont("NotoKR", "normal");
      doc.setFontSize(size);

      return doc.splitTextToSize(
        value,
        width
      ) as string[];
    };

    const splitEN = (
      value: string,
      width: number,
      size: number
    ) => {
      doc.setFont("times", "normal");
      doc.setFontSize(size);

      return doc.splitTextToSize(
        cleanUnderlineMarkers(value),
        width
      ) as string[];
    };

    const estimateQuestionHeight = (
      question: GeneratedQuestion
    ) => {
      const stemLines = splitKR(
        question.stem,
        columnWidth - 7,
        9.7
      ).length;

      const passageLines = splitEN(
        question.passage,
        columnWidth - 5,
        9.3
      ).length;

      let choiceLines = 0;

      question.choices.forEach(
        (choice) => {
          choiceLines += splitEN(
            choice,
            columnWidth - 7,
            9.1
          ).length;
        }
      );

      return (
        10 +
        stemLines * 4.3 +
        passageLines * 4.15 +
        choiceLines * 4.0 +
        11
      );
    };

    // ---------------------------------------------
    // 영어 지문 출력
    // __word__ 는 실제 밑줄 표시
    // ---------------------------------------------
    const drawEnglishPassage = (
      rawText: string,
      x: number,
      y: number,
      maxWidth: number
    ) => {
      doc.setFont("times", "normal");
      doc.setFontSize(9.3);
      doc.setTextColor(35, 39, 46);

      const lineHeight = 4.15;
      const paragraphs = rawText.split("\n");

      let currentY = y;

      for (
        let p = 0;
        p < paragraphs.length;
        p++
      ) {
        const paragraph =
          paragraphs[p].trim();

        if (!paragraph) {
          currentY += lineHeight;
          continue;
        }

        const tokens =
          paragraph.match(
            /__[^_]+__|\S+/g
          ) || [];

        let currentX = x;

        for (const token of tokens) {
          const underlined =
            token.startsWith("__") &&
            token.endsWith("__");

          const visible = underlined
            ? token.slice(2, -2)
            : token;

          const textWidth =
            doc.getTextWidth(visible);

          const spaceWidth =
            doc.getTextWidth(" ");

          if (
            currentX +
              textWidth >
            x + maxWidth
          ) {
            currentX = x;
            currentY += lineHeight;

            if (
              currentY >
              contentBottom - 5
            ) {
              nextColumn();
              currentX =
                getColumnX() + 2.5;
              currentY = cursorY;
            }
          }

          doc.text(
            visible,
            currentX,
            currentY
          );

          if (underlined) {
            doc.setDrawColor(
              35,
              39,
              46
            );

            doc.setLineWidth(0.25);

            doc.line(
              currentX,
              currentY + 0.7,
              currentX + textWidth,
              currentY + 0.7
            );
          }

          currentX +=
            textWidth + spaceWidth;
        }

        currentY += lineHeight;

        if (p < paragraphs.length - 1) {
          currentY += 1.1;
        }
      }

      return currentY;
    };

    const drawQuestion = (
      question: GeneratedQuestion,
      index: number
    ) => {
      const estimated =
        estimateQuestionHeight(question);

      // 한 단에 들어갈 수 있는 크기면
      // 문항 중간 분리를 최대한 피한다.
      if (
        estimated <
        contentBottom - contentTop
      ) {
        ensureSpace(estimated);
      }

      let x = getColumnX();

      // 문항 번호 컬러 태그
      doc.setFillColor(...accent);

      doc.roundedRect(
        x,
        cursorY,
        10,
        5.6,
        1.6,
        1.6,
        "F"
      );

      doc.setFont("NotoKR", "normal");
      doc.setFontSize(7.3);
      doc.setTextColor(255, 255, 255);

      doc.text(
        String(index + 1).padStart(
          2,
          "0"
        ),
        x + 5,
        cursorY + 3.8,
        { align: "center" }
      );

      // 유형
      doc.setFontSize(7.2);
      doc.setTextColor(...accent);

      doc.text(
        question.type,
        x + 12.2,
        cursorY + 3.8
      );

      cursorY += 8;

      // 발문
      doc.setFont("NotoKR", "normal");
      doc.setFontSize(9.7);
      doc.setTextColor(22, 28, 38);

      const stemLines = doc.splitTextToSize(
        question.stem,
        columnWidth - 5
      ) as string[];

      doc.text(
        stemLines,
        x + 1.5,
        cursorY
      );

      cursorY +=
        stemLines.length * 4.3 + 3;

      // 지문
      doc.setDrawColor(224, 227, 232);
      doc.setLineWidth(0.25);

      doc.line(
        x + 1.5,
        cursorY - 1.5,
        x + columnWidth - 1.5,
        cursorY - 1.5
      );

      cursorY += 1.8;

      cursorY = drawEnglishPassage(
        question.passage,
        x + 2.3,
        cursorY,
        columnWidth - 4.6
      );

      cursorY += 2.5;

      // 선택지
      doc.setFont("times", "normal");
      doc.setFontSize(9.1);
      doc.setTextColor(30, 35, 43);

      for (
        let i = 0;
        i < question.choices.length;
        i++
      ) {
        const choice =
          cleanUnderlineMarkers(
            question.choices[i]
          );

        const lines =
          doc.splitTextToSize(
            choice,
            columnWidth - 6
          ) as string[];

        if (
          cursorY +
            lines.length * 4 >
          contentBottom
        ) {
          nextColumn();
          x = getColumnX();
        }

        doc.text(
          lines,
          x + 2.3,
          cursorY
        );

        cursorY +=
          lines.length * 4 + 0.9;
      }

      cursorY += 5;

      // 문항 구분
      doc.setDrawColor(230, 232, 236);
      doc.setLineWidth(0.2);

      doc.line(
        x + 1,
        cursorY,
        x + columnWidth - 1,
        cursorY
      );

      cursorY += 5;
    };

    const drawAnswer = (
      question: GeneratedQuestion,
      index: number
    ) => {
      const x = getColumnX();

      const explanationLines =
        splitKR(
          question.explanation,
          columnWidth - 7,
          8.8
        );

      const required =
        18 +
        explanationLines.length * 4.2;

      ensureSpace(required);

      const actualX = getColumnX();

      doc.setFillColor(...accent);

      doc.roundedRect(
        actualX,
        cursorY,
        10,
        5.6,
        1.6,
        1.6,
        "F"
      );

      doc.setFont("NotoKR", "normal");
      doc.setFontSize(7.3);
      doc.setTextColor(255, 255, 255);

      doc.text(
        String(index + 1).padStart(
          2,
          "0"
        ),
        actualX + 5,
        cursorY + 3.8,
        { align: "center" }
      );

      doc.setFontSize(8);
      doc.setTextColor(...accent);

      doc.text(
        question.type,
        actualX + 12,
        cursorY + 3.8
      );

      cursorY += 9;

      // 정답
      doc.setFontSize(9.5);
      doc.setTextColor(25, 31, 40);

      doc.text(
        `정답  ${question.answer}`,
        actualX + 2,
        cursorY
      );

      cursorY += 5.5;

      doc.setFontSize(8.8);
      doc.setTextColor(67, 75, 88);

      doc.text(
        explanationLines,
        actualX + 2,
        cursorY
      );

      cursorY +=
        explanationLines.length * 4.2 +
        5;

      doc.setDrawColor(230, 232, 236);

      doc.line(
        actualX + 1,
        cursorY,
        actualX + columnWidth - 1,
        cursorY
      );

      cursorY += 5;
    };

    // ---------------------------------------------
    // 첫 페이지
    // ---------------------------------------------
    drawHeader();

    if (mode === "questions") {
      generatedQuestions.forEach(
        (question, index) => {
          drawQuestion(
            question,
            index
          );
        }
      );
    } else {
      generatedQuestions.forEach(
        (question, index) => {
          drawAnswer(
            question,
            index
          );
        }
      );
    }

    // ---------------------------------------------
    // 파일명
    // ---------------------------------------------
    const safeSchool =
      schoolName?.trim() ||
      "SUMMIT";

    const fileName =
      mode === "questions"
        ? `${safeSchool}_영어_변형문제.pdf`
        : `${safeSchool}_영어_정답해설.pdf`;

    doc.save(fileName);
  };

  const deleteQuestion = (id: string) => {
    setGeneratedQuestions((prev) =>
      prev.filter((question) => question.id !== id)
    );

    if (editingQuestionId === id) {
      setEditingQuestionId(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <HomeButton />

          <div className="rounded-full bg-sky-100 px-4 py-2 text-xs font-black tracking-[0.16em] text-sky-700">
            ENG MOCK TEST LAB
          </div>
        </div>

        <section className="mt-8">
          <p className="text-sm font-black tracking-[0.18em] text-sky-600">
            SUMMIT VISUAL LAB
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            고등영어 변형문제 제작
          </h1>

          <p className="mt-3 text-base font-medium text-slate-600">
            교재 PDF를 분석해 원하는 유형의 모의고사·내신형 변형문제를
            제작합니다.
          </p>
        </section>

        {/* 1 */}
        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-slate-900">1. 기본정보</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label>
              <span className="text-sm font-bold text-slate-700">학교명</span>

              <input
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="예) 써밋고"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 placeholder:text-slate-400"
              />
            </label>

            <label>
              <span className="text-sm font-bold text-slate-700">학년</span>

              <input
                value={gradeName}
                onChange={(e) => setGradeName(e.target.value)}
                placeholder="예) 고 2"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 placeholder:text-slate-400"
              />
            </label>

            <label>
              <span className="text-sm font-bold text-slate-700">
                시험 범위
              </span>

              <input
                value={rangeName}
                onChange={(e) => setRangeName(e.target.value)}
                placeholder="예) Extra Reading Ⅰ & Ⅱ"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 placeholder:text-slate-400"
              />
            </label>
          </div>
        </section>

        {/* 2 */}
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                2. 지문 라이브러리
              </h2>

              <p className="mt-2 text-sm font-medium text-slate-500">
                한 번 저장한 지문은 다음 제작에서도 다시 사용할 수 있습니다.
              </p>
            </div>

            <label
              className={`inline-flex cursor-pointer rounded-2xl px-5 py-3 font-black text-white shadow-sm transition ${
                readingPdf || analyzingPdf
                  ? "bg-slate-400"
                  : "bg-sky-600 hover:bg-sky-700"
              }`}
            >
              {readingPdf || analyzingPdf ? "분석 중..." : "PDF 업로드"}

              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={readingPdf || analyzingPdf}
                onChange={(e) => {
                  const file = e.target.files?.[0];

                  if (file) {
                    extractPdfText(file);
                  }

                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {pdfFileName && (
            <div className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-sm font-bold text-sky-700">
              {pdfFileName}
            </div>
          )}

          {pdfStatus && (
            <div className="mt-3 text-sm font-bold text-slate-600">
              {pdfStatus}
            </div>
          )}

          {/* 분석된 새 지문 */}
          {extractedPassages.length > 0 && (
            <div className="mt-6 rounded-3xl border border-sky-200 bg-sky-50/50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    PDF에서 찾은 지문
                  </h3>

                  <p className="mt-1 text-sm font-medium text-slate-500">
                    저장하지 않을 지문은 체크를 해제할 수 있습니다.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedExtractedIds(
                        extractedPassages.map((item) => item.id)
                      )
                    }
                    className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm"
                  >
                    전체 선택
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedExtractedIds([])}
                    className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm"
                  >
                    전체 해제
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {extractedPassages.map((passage, index) => {
                  const selected = selectedExtractedIds.includes(passage.id);

                  return (
                    <button
                      key={passage.id}
                      type="button"
                      onClick={() => toggleExtractedPassage(passage.id)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-sky-400 bg-white"
                          : "border-slate-200 bg-slate-50 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm font-black ${
                            selected
                              ? "border-sky-600 bg-sky-600 text-white"
                              : "border-slate-300 bg-white text-transparent"
                          }`}
                        >
                          ✓
                        </div>

                        <div className="min-w-0">
                          <p className="font-black text-slate-900">
                            {index + 1}. {passage.title}
                          </p>

                          <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-500">
                            {passage.source}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => saveExtractedPassages(true)}
                  className="rounded-2xl bg-sky-600 px-5 py-3 font-black text-white hover:bg-sky-700"
                >
                  선택한 지문 저장
                </button>

                <button
                  type="button"
                  onClick={() => saveExtractedPassages(false)}
                  className="rounded-2xl bg-slate-900 px-5 py-3 font-black text-white hover:bg-slate-800"
                >
                  전체 지문 저장
                </button>
              </div>
            </div>
          )}

          {/* 저장된 라이브러리 */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-black text-slate-900">저장된 지문</h3>

              <span className="text-sm font-bold text-slate-400">
                {savedPassages.length}개
              </span>
            </div>

            {savedPassages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm font-bold text-slate-400">
                아직 저장된 지문이 없습니다.
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="mb-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={selectAllSavedPassages}
                  disabled={savedPassages.length === 0}
                  className="rounded-full bg-sky-50 px-4 py-2 text-sm font-black text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  전체 선택
                </button>

                <button
                  type="button"
                  onClick={clearAllSavedPassages}
                  disabled={selectedPassageIds.length === 0}
                  className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  전체 해제
                </button>
              </div>

              {savedPassages.map((passage) => {
                  const selected = selectedPassageIds.includes(passage.id);

                  return (
                    <div
                      key={passage.id}
                      className={`rounded-2xl border p-4 ${
                        selected
                          ? "border-sky-400 bg-sky-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <button
                          type="button"
                          onClick={() => toggleSavedPassage(passage.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm font-black ${
                                selected
                                  ? "border-sky-600 bg-sky-600 text-white"
                                  : "border-slate-300 bg-white text-transparent"
                              }`}
                            >
                              ✓
                            </div>

                            <div className="min-w-0">
                              <p className="font-black text-slate-900">
                                {passage.title}
                              </p>

                              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
                                {passage.source}
                              </p>
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteSavedPassage(passage.id)}
                          className="shrink-0 rounded-full bg-red-50 px-3 py-2 text-xs font-black text-red-500 transition hover:bg-red-100"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* 3 */}
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black text-slate-900">
              3. 문제 유형 선택
            </h2>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllQuestionTypes}
                className="rounded-full bg-sky-50 px-4 py-2 text-sm font-black text-sky-700"
              >
                전체 선택
              </button>

              <button
                type="button"
                onClick={clearAllQuestionTypes}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600"
              >
                전체 해제
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {QUESTION_TYPES.map((type) => {
              const checked = selectedTypes.includes(type);

              return (
                <div
                  key={type}
                  className={`flex items-center justify-between rounded-2xl border p-4 ${
                    checked
                      ? "border-sky-300 bg-sky-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleQuestionType(type)}
                      className="h-5 w-5"
                    />

                    <span className="font-bold text-slate-800">{type}</span>
                  </label>

                  {checked && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setQuestionCounts((prev) => ({
                            ...prev,
                            [type]: Math.max(1, (prev[type] || 1) - 1),
                          }))
                        }
                        className="h-8 w-8 rounded-full bg-white font-black shadow-sm"
                      >
                        −
                      </button>

                      <span className="min-w-6 text-center font-black">
                        {questionCounts[type] || 1}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setQuestionCounts((prev) => ({
                            ...prev,
                            [type]: Math.min(10, (prev[type] || 1) + 1),
                          }))
                        }
                        className="h-8 w-8 rounded-full bg-white font-black shadow-sm"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl bg-slate-900 px-5 py-4 text-white">
            <span className="text-sm font-bold text-slate-300">
              총 문항 수
            </span>

            <strong className="ml-3 text-2xl">{totalQuestions}문항</strong>
          </div>
        </section>

        {/* 4 + 5 */}
        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-900">4. 난이도</h2>

            <p className="mt-2 text-sm font-medium text-slate-500">
              여러 난이도를 선택하면 선택한 수준을 섞어 출제합니다.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {DIFFICULTIES.map((item) => {
                const checked = difficulties.includes(item);

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleDifficulty(item)}
                    className={`rounded-2xl px-4 py-3 font-black transition ${
                      checked
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {checked ? "✓ " : ""}
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-900">
              5. THEME COLOR
            </h2>

            <p className="mt-2 text-sm font-medium text-slate-500">
              시험지 제목, 문항 태그, 지문 테두리 등에 적용됩니다.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              {COLORS.map((color) => {
                const selected = themeColor === color.value;

                return (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setThemeColor(color.value)}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black ${
                      selected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    <span
                      className="h-5 w-5 rounded-full border border-black/10"
                      style={{
                        backgroundColor: color.value,
                      }}
                    />

                    {color.name}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 6 */}
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-slate-900">6. 문제 제작</h2>

          <div className="mt-5 grid gap-3 text-sm font-bold text-slate-600 md:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              선택 지문
              <strong className="mt-1 block text-xl text-slate-900">
                {selectedPassageIds.length}
              </strong>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              문제 유형
              <strong className="mt-1 block text-xl text-slate-900">
                {selectedTypes.length}
              </strong>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              총 문항
              <strong className="mt-1 block text-xl text-slate-900">
                {totalQuestions}
              </strong>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              난이도
              <strong className="mt-1 block text-lg text-slate-900">
                {difficulties.join(" · ")}
              </strong>
            </div>
          </div>

          <button
            type="button"
            disabled={
              generatingQuestions ||
              selectedPassageIds.length === 0 ||
              selectedTypes.length === 0 ||
              totalQuestions === 0
            }
            onClick={makeQuestions}
            className="mt-6 w-full rounded-2xl bg-sky-600 px-6 py-4 text-lg font-black text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {generatingQuestions
              ? "변형문제 만드는 중..."
              : "선택한 유형으로 변형문제 만들기"}
          </button>
        </section>

        {questionStatus && (
          <div className="mt-5 rounded-2xl bg-sky-50 px-5 py-4 text-sm font-bold text-sky-700">
            {questionStatus}
          </div>
        )}

        {generatedQuestions.length > 0 && (
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-black tracking-[0.15em] text-sky-600">
                  QUESTION REVIEW
                </p>

                <h2 className="mt-1 text-3xl font-black text-slate-900">
                  생성된 변형문제
                </h2>

                <p className="mt-2 text-sm font-medium text-slate-500">
                  문제를 확인한 뒤 수정하거나 삭제할 수 있습니다.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadExamPdf("questions")
                    }
                    className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-black text-white shadow-sm"
                  >
                    문제지 PDF
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      downloadExamPdf("answers")
                    }
                    className="rounded-full bg-white px-5 py-2.5 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200"
                  >
                    정답 · 해설 PDF
                  </button>
                </div>
              </div>

              <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-black text-white">
                {generatedQuestions.length}문항
              </div>
            </div>

            <div className="mt-6 grid gap-6">
              {generatedQuestions.map((question, index) => {
                const editing = editingQuestionId === question.id;

                return (
                  <article
                    key={question.id}
                    className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-black text-sky-700">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                          {question.type}
                        </span>

                        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">
                          {question.difficulty}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingQuestionId(
                              editing ? null : question.id
                            )
                          }
                          className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700"
                        >
                          {editing ? "수정 완료" : "수정"}
                        </button>

                        <div className="relative group">
                          <button
                            type="button"
                            disabled={transformingQuestionId === question.id}
                            className="rounded-full bg-violet-50 px-4 py-2 text-sm font-black text-violet-700 disabled:opacity-50"
                          >
                            {transformingQuestionId === question.id
                              ? "변형 중..."
                              : "변형"}
                          </button>

                          <div className="invisible absolute right-0 top-full z-30 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100">
                            {[
                              "난이도 높이기",
                              "난이도 낮추기",
                              "발문 변경",
                              "선지 변형",
                              "다른 유형으로 변형",
                              "객관식 → 서술형",
                              "서술형 → 객관식",
                            ].map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() =>
                                  transformQuestion(question, mode)
                                }
                                className="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-violet-50"
                              >
                                {mode}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteQuestion(question.id)}
                          className="rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-500"
                        >
                          삭제
                        </button>
                      </div>
                    </div>

                    <p className="mt-4 text-xs font-black text-slate-400">
                      {question.passageTitle}
                    </p>

                    {editing ? (
                      <div className="mt-5 grid gap-4">
                        <textarea
                          value={question.stem}
                          onChange={(e) =>
                            updateQuestion(
                              question.id,
                              "stem",
                              e.target.value
                            )
                          }
                          rows={3}
                          className="w-full rounded-2xl border border-slate-300 p-4"
                        />

                        <textarea
                          value={question.passage}
                          onChange={(e) =>
                            updateQuestion(
                              question.id,
                              "passage",
                              e.target.value
                            )
                          }
                          rows={10}
                          className="w-full rounded-2xl border border-slate-300 p-4 font-serif leading-8"
                        />

                        <input
                          value={question.boxTitle || ""}
                          onChange={(e) =>
                            updateQuestion(
                              question.id,
                              "boxTitle",
                              e.target.value
                            )
                          }
                          placeholder="보기 박스 제목"
                          className="w-full rounded-xl border border-slate-300 px-4 py-3"
                        />

                        <textarea
                          value={question.boxText || ""}
                          onChange={(e) =>
                            updateQuestion(
                              question.id,
                              "boxText",
                              e.target.value
                            )
                          }
                          rows={4}
                          placeholder="보기 박스 내용"
                          className="w-full rounded-2xl border border-slate-300 p-4"
                        />

                        {question.choices.map((choice, choiceIndex) => (
                          <input
                            key={choiceIndex}
                            value={choice}
                            onChange={(e) => {
                              const next = [...question.choices];
                              next[choiceIndex] = e.target.value;

                              updateQuestion(
                                question.id,
                                "choices",
                                next
                              );
                            }}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3"
                          />
                        ))}

                        <input
                          value={question.answer}
                          onChange={(e) =>
                            updateQuestion(
                              question.id,
                              "answer",
                              e.target.value
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 px-4 py-3"
                        />

                        <textarea
                          value={question.explanation}
                          onChange={(e) =>
                            updateQuestion(
                              question.id,
                              "explanation",
                              e.target.value
                            )
                          }
                          rows={4}
                          className="w-full rounded-2xl border border-slate-300 p-4"
                        />
                      </div>
                    ) : (
                      <>
                        <h3 className="mt-4 text-lg font-black leading-7 text-slate-900">
                          {question.stem}
                        </h3>

                        <div className="mt-5 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-6 font-serif text-[18px] leading-9 text-slate-800">
                          {renderPassageText(question.passage)}
                        </div>

                        {question.choices.length > 0 && (
                          <div className="mt-5 grid gap-2">
                            {question.choices.map((choice, choiceIndex) => (
                              <div
                                key={choiceIndex}
                                className="rounded-xl px-3 py-2.5 text-[17px] leading-7 text-slate-800"
                              >
                                {choice}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="mt-6 grid gap-3 md:grid-cols-[minmax(220px,0.8fr)_1.7fr]">
                          <div className="rounded-2xl bg-emerald-50 p-4">
                            <p className="text-xs font-black text-emerald-600">
                              정답
                            </p>

                            <p className="mt-1 font-black text-slate-900">
                              {question.answer}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-amber-50 p-4">
                            <p className="text-xs font-black text-amber-600">
                              해설
                            </p>

                            <p className="mt-1 text-sm font-medium leading-6 text-slate-700">
                              {question.explanation}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}