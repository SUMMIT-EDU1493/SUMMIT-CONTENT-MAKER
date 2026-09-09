"use client";

import {
  ChangeEvent,
  useMemo,
  useState,
} from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

type Difficulty =
  | "중"
  | "상";

type Passage = {
  id: string;
  title: string;
  content: string;
  selected: boolean;
};

type QuestionTypeSetting = {
  type: string;
  count: number;
  description: string;
};

type Question = {
  id: string;
  passageId: string;
  passageTitle: string;
  type: string;
  difficulty: Difficulty;
  stem: string;
  boxText: string;
  targetWord: string;
  choices: string[];
  answer: number;
  explanation: string;
  choiceExplanations: string[];
  evidence: string;
};

type SkippedType = {
  passageTitle: string;
  type: string;
  reason: string;
};

const DEFAULT_TYPES: QuestionTypeSetting[] =
  [
    {
      type:
        "글의 구조와 전개 방식",
      count: 1,
      description:
        "문단의 역할과 글 전체의 전개 구조를 판단합니다.",
    },
    {
      type:
        "세부 내용 파악",
      count: 1,
      description:
        "지문의 조건·대상·인과·범위를 정확히 파악합니다.",
    },
    {
      type:
        "구체적 사례 적용",
      count: 1,
      description:
        "지문의 개념이나 원리를 새로운 <보기>에 적용합니다.",
    },
    {
      type:
        "단어의 의미 파악",
      count: 1,
      description:
        "원문에 실제 등장하는 어휘의 문맥적 의미를 판단합니다.",
    },
    {
      type:
        "생략된 내용 추론",
      count: 1,
      description:
        "직접 쓰이지 않은 내용을 지문의 논리로 추론합니다.",
    },
    {
      type:
        "다른 견해와의 비교",
      count: 0,
      description:
        "지문과 새로운 <보기>의 관점을 비교합니다.",
    },
    {
      type:
        "중심 내용 파악",
      count: 1,
      description:
        "글 전체를 포괄하는 핵심 내용을 판단합니다.",
    },
  ];

function makeId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export default function KoreanQuestionMakerPage() {
  const [
    schoolName,
    setSchoolName,
  ] = useState("");

  const [
    gradeName,
    setGradeName,
  ] = useState("고3");

  const [
    materialName,
    setMaterialName,
  ] = useState("");

  const [
    fileName,
    setFileName,
  ] = useState("");

  const [
    loadingPdf,
    setLoadingPdf,
  ] = useState(false);

  const [
    extracting,
    setExtracting,
  ] = useState(false);

  const [
    generating,
    setGenerating,
  ] = useState(false);

  const [
    generationProgress,
    setGenerationProgress,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    passages,
    setPassages,
  ] = useState<Passage[]>(
    []
  );

  const [
    difficulties,
    setDifficulties,
  ] = useState<Difficulty[]>([
    "중",
    "상",
  ]);

  const [
    typeSettings,
    setTypeSettings,
  ] =
    useState<
      QuestionTypeSetting[]
    >(DEFAULT_TYPES);

  const [
    questions,
    setQuestions,
  ] = useState<Question[]>(
    []
  );

  const [
    skippedTypes,
    setSkippedTypes,
  ] =
    useState<SkippedType[]>(
      []
    );

  const [
    showAnswers,
    setShowAnswers,
  ] = useState(true);

  const selectedPassages =
    useMemo(
      () =>
        passages.filter(
          (passage) =>
            passage.selected
        ),
      [passages]
    );

  const questionCount =
    useMemo(
      () =>
        typeSettings.reduce(
          (
            sum,
            item
          ) =>
            sum +
            item.count,
          0
        ),
      [typeSettings]
    );

  const updateTypeCount = (
    type: string,
    nextCount: number
  ) => {
    setTypeSettings(
      (prev) =>
        prev.map(
          (item) =>
            item.type === type
              ? {
                  ...item,
                  count:
                    Math.max(
                      0,
                      Math.min(
                        30,
                        nextCount
                      )
                    ),
                }
              : item
        )
    );
  };

  const setAllTypeCounts = (
    count: number
  ) => {
    const safeCount =
      Math.max(
        0,
        Math.min(
          30,
          count
        )
      );

    setTypeSettings(
      (prev) =>
        prev.map(
          (item) => ({
            ...item,
            count: safeCount,
          })
        )
    );
  };

  const toggleDifficulty = (
    level: Difficulty
  ) => {
    setDifficulties(
      (prev) => {
        if (
          prev.includes(
            level
          )
        ) {
          if (
            prev.length ===
            1
          ) {
            return prev;
          }

          return prev.filter(
            (item) =>
              item !== level
          );
        }

        return [
          ...prev,
          level,
        ];
      }
    );
  };

  const readPdf = async (
    file: File
  ) => {
    try {
      setLoadingPdf(true);
      setExtracting(false);
      setGenerating(false);
      setErrorMessage("");
      setPassages([]);
      setQuestions([]);
      setSkippedTypes([]);
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
        pageNumber <=
        pdf.numPages;
        pageNumber++
      ) {
        const page =
          await pdf.getPage(
            pageNumber
          );

        const textContent =
          await page.getTextContent();

        const pageText =
          textContent.items
            .map(
              (
                item: any
              ) =>
                "str" in item
                  ? item.str
                  : ""
            )
            .join(" ");

        fullText +=
          `\n\n--- ${pageNumber}페이지 ---\n${pageText}`;
      }

      if (
        !fullText.trim()
      ) {
        throw new Error(
          "PDF에서 텍스트를 읽지 못했습니다."
        );
      }

      setLoadingPdf(false);
      setExtracting(true);

      const response =
        await fetch(
          "/api/korean-question-passages",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                text: fullText,
              }),
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
            "지문 추출에 실패했습니다."
        );
      }

      const nextPassages =
        Array.isArray(
          data?.passages
        )
          ? data.passages.map(
              (
                passage: {
                  title?: string;
                  content?: string;
                },
                index: number
              ): Passage => ({
                id: makeId(),

                title:
                  passage.title ||
                  `지문 ${index + 1}`,

                content:
                  passage.content ||
                  "",

                selected: true,
              })
            )
          : [];

      if (
        nextPassages.length ===
        0
      ) {
        throw new Error(
          "추출된 지문이 없습니다."
        );
      }

      setPassages(
        nextPassages
      );

      setTypeSettings(
        (prev) =>
          prev.map(
            (item) => ({
              ...item,
              count:
                nextPassages.length,
            })
          )
      );
    } catch (
      error: any
    ) {
      console.error(
        error
      );

      setErrorMessage(
        error?.message ||
          "PDF 처리 중 오류가 발생했습니다."
      );
    } finally {
      setLoadingPdf(
        false
      );

      setExtracting(
        false
      );
    }
  };

  const onFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    void readPdf(
      file
    );
  };

  const togglePassage = (
    id: string
  ) => {
    setPassages(
      (prev) =>
        prev.map(
          (passage) =>
            passage.id ===
            id
              ? {
                  ...passage,
                  selected:
                    !passage.selected,
                }
              : passage
        )
    );
  };

  const updatePassageTitle = (
    id: string,
    title: string
  ) => {
    setPassages(
      (prev) =>
        prev.map(
          (passage) =>
            passage.id ===
            id
              ? {
                  ...passage,
                  title,
                }
              : passage
        )
    );
  };

  const updatePassageContent = (
    id: string,
    content: string
  ) => {
    setPassages(
      (prev) =>
        prev.map(
          (passage) =>
            passage.id ===
            id
              ? {
                  ...passage,
                  content,
                }
              : passage
        )
    );
  };

  const deletePassage = (
    id: string
  ) => {
    setPassages(
      (prev) =>
        prev.filter(
          (passage) =>
            passage.id !==
            id
        )
    );
  };

  const generateQuestions =
    async () => {
      if (
        generating
      ) {
        return;
      }

      if (
        selectedPassages.length ===
        0
      ) {
        alert(
          "문제를 만들 지문을 하나 이상 선택해 주세요."
        );
        return;
      }

      if (
        questionCount ===
        0
      ) {
        alert(
          "최소 한 개 이상의 문제 유형을 선택해 주세요."
        );
        return;
      }

      if (
        difficulties.length ===
        0
      ) {
        alert(
          "난이도를 하나 이상 선택해 주세요."
        );
        return;
      }

      try {
        setGenerating(
          true
        );

        setErrorMessage(
          ""
        );

        setQuestions(
          []
        );

        setSkippedTypes(
          []
        );

        const nextQuestions: Question[] =
          [];

        const nextSkipped: SkippedType[] =
          [];

        const passageCount =
          selectedPassages.length;

        const requestsByPassage =
          selectedPassages.map(
            () =>
              [] as {
                type: string;
                count: number;
              }[]
          );

        typeSettings.forEach(
          (
            setting,
            typeIndex
          ) => {
            if (
              setting.count <=
              0
            ) {
              return;
            }

            const base =
              Math.floor(
                setting.count /
                  passageCount
              );

            const remainder =
              setting.count %
              passageCount;

            for (
              let offset = 0;
              offset <
              passageCount;
              offset++
            ) {
              const passageIndex =
                (
                  offset +
                  typeIndex
                ) %
                passageCount;

              const count =
                base +
                (
                  offset <
                  remainder
                    ? 1
                    : 0
                );

              if (
                count >
                0
              ) {
                requestsByPassage[
                  passageIndex
                ].push({
                  type:
                    setting.type,
                  count,
                });
              }
            }
          }
        );

        for (
          let index = 0;
          index <
          selectedPassages.length;
          index++
        ) {
          const passage =
            selectedPassages[
              index
            ];

          const passageTypes =
            requestsByPassage[
              index
            ];

          if (
            passageTypes.length ===
            0
          ) {
            continue;
          }

          setGenerationProgress(
            `수능형 문제 생성 중 (${index + 1}/${selectedPassages.length}) · ${passage.title}`
          );

          try {
            const response =
              await fetch(
                "/api/korean-question-generate",
                {
                  method:
                    "POST",

                  headers: {
                    "Content-Type":
                      "application/json",
                  },

                  body:
                    JSON.stringify({
                      title:
                        passage.title,

                      passage:
                        passage.content,

                      difficulties,

                      types:
                        passageTypes,
                    }),
                }
              );

            const data =
              await response.json();

            if (
              !response.ok
            ) {
              nextSkipped.push({
                passageTitle:
                  passage.title,
                type:
                  "전체",
                reason:
                  data?.detail ||
                  data?.error ||
                  "문제 생성에 실패했습니다.",
              });

              setSkippedTypes([
                ...nextSkipped,
              ]);

              continue;
            }

            if (
              Array.isArray(
                data?.questions
              )
            ) {
              data.questions.forEach(
                (
                  raw: any
                ) => {
                  nextQuestions.push({
                    id:
                      makeId(),

                    passageId:
                      passage.id,

                    passageTitle:
                      passage.title,

                    type:
                      raw.type ||
                      "",

                    difficulty:
                      raw.difficulty ===
                      "상"
                        ? "상"
                        : "중",

                    stem:
                      raw.stem ||
                      "",

                    boxText:
                      raw.boxText ||
                      "",

                    targetWord:
                      raw.targetWord ||
                      "",

                    choices:
                      Array.isArray(
                        raw.choices
                      )
                        ? raw.choices
                        : [],

                    answer:
                      Number(
                        raw.answer
                      ) || 1,

                    explanation:
                      raw.explanation ||
                      "",

                    choiceExplanations:
                      Array.isArray(
                        raw.choiceExplanations
                      )
                        ? raw.choiceExplanations
                        : [],

                    evidence:
                      raw.evidence ||
                      "",
                  });
                }
              );
            }

            if (
              Array.isArray(
                data?.skippedTypes
              )
            ) {
              data.skippedTypes.forEach(
                (
                  item: any
                ) => {
                  nextSkipped.push({
                    passageTitle:
                      passage.title,

                    type:
                      item.type ||
                      "",

                    reason:
                      item.reason ||
                      "",
                  });
                }
              );
            }

            setQuestions([
              ...nextQuestions,
            ]);

            setSkippedTypes([
              ...nextSkipped,
            ]);
          } catch (
            passageError: any
          ) {
            nextSkipped.push({
              passageTitle:
                passage.title,
              type:
                "전체",
              reason:
                passageError?.message ||
                "이 지문의 문제 생성 중 오류가 발생했습니다.",
            });

            setSkippedTypes([
              ...nextSkipped,
            ]);
          }
        }

        if (
          nextQuestions.length ===
          0
        ) {
          throw new Error(
            "선택한 지문에서 유효한 문제를 생성하지 못했습니다."
          );
        }

        setGenerationProgress(
          `문제 생성 완료 · 총 ${nextQuestions.length}문항`
        );

        setTimeout(
          () => {
            document
              .getElementById(
                "question-results"
              )
              ?.scrollIntoView({
                behavior:
                  "smooth",
                block:
                  "start",
              });
          },
          200
        );
      } catch (
        error: any
      ) {
        console.error(
          error
        );

        setErrorMessage(
          error?.message ||
            "문제 생성 중 오류가 발생했습니다."
        );
      } finally {
        setGenerating(
          false
        );
      }
    };

  const printQuestions =
    (
      includeAnswers: boolean
    ) => {
      setShowAnswers(
        includeAnswers
      );

      setTimeout(
        () => {
          window.print();
        },
        100
      );
    };

  const choiceNumber = (
    index: number
  ) =>
    [
      "①",
      "②",
      "③",
      "④",
      "⑤",
    ][index] ||
    `${index + 1}.`;

  return (
    <main className="min-h-screen bg-[#f7f4ea] px-5 py-10 text-slate-900">
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .print-area {
            max-width: none !important;
          }

          .print-card {
            box-shadow: none !important;
            border: 0 !important;
            break-inside: avoid;
          }

          .print-passage {
            break-inside: avoid;
          }

          .answer-area.hidden-for-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-6xl print-area">
        <div className="no-print">
          <button
            type="button"
            onClick={() => {
              window.location.href =
                "/";
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-600 shadow-sm"
          >
            ← 홈으로
          </button>
        </div>

        <section className="mt-6 overflow-hidden rounded-[32px] bg-slate-950 p-8 text-white shadow-sm no-print md:p-10">
          <p className="text-sm font-black tracking-[0.18em] text-violet-300">
            KOREAN CSAT QUESTION LAB
          </p>

          <h1 className="mt-3 text-4xl font-black md:text-5xl">
            수능형 국어 문제
          </h1>

          <p className="mt-4 max-w-3xl leading-7 text-slate-300">
            원문 지문은 그대로 보존하고,
            수능·모의평가형 독서 문제만 새로 제작합니다.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {[
              "구조",
              "세부",
              "사례 적용",
              "어휘",
              "추론",
              "견해 비교",
              "중심 내용",
            ].map(
              (
                label
              ) => (
                <span
                  key={
                    label
                  }
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200"
                >
                  {
                    label
                  }
                </span>
              )
            )}
          </div>
        </section>

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 no-print md:p-8">
          <p className="text-sm font-black text-violet-600">
            STEP 1
          </p>

          <h2 className="mt-1 text-3xl font-black">
            교재 정보 · PDF
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-sm font-bold">
                학교
              </span>

              <input
                value={
                  schoolName
                }
                onChange={(
                  e
                ) =>
                  setSchoolName(
                    e.target
                      .value
                  )
                }
                placeholder="예: 향일고"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold">
                학년
              </span>

              <input
                value={
                  gradeName
                }
                onChange={(
                  e
                ) =>
                  setGradeName(
                    e.target
                      .value
                  )
                }
                placeholder="예: 고2"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold">
                자료명
              </span>

              <input
                value={
                  materialName
                }
                onChange={(
                  e
                ) =>
                  setMaterialName(
                    e.target
                      .value
                  )
                }
                placeholder="예: 9월 모의고사 독서"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </label>
          </div>

          <label className="mt-6 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50 p-6">
            <div>
              <p className="font-black text-violet-800">
                국어 PDF 선택
              </p>

              <p className="mt-1 text-sm text-violet-600">
                문제·정답·해설은 제외하고 지문만 자동 추출합니다.
              </p>

              {fileName && (
                <p className="mt-2 text-sm font-bold text-slate-700">
                  {
                    fileName
                  }
                </p>
              )}
            </div>

            <span className="rounded-xl bg-violet-600 px-5 py-3 font-black text-white">
              PDF 선택
            </span>

            <input
              type="file"
              accept="application/pdf"
              onChange={
                onFileChange
              }
              className="hidden"
            />
          </label>

          {(loadingPdf ||
            extracting) && (
            <div className="mt-5 rounded-2xl bg-slate-900 p-5 text-white">
              <p className="font-black">
                {loadingPdf
                  ? "PDF 텍스트 읽는 중..."
                  : "원문 지문만 추출하는 중..."}
              </p>

              <p className="mt-1 text-sm text-slate-300">
                원문을 바꾸지 않고 문제 출제에 필요한 지문 경계를 확인하고 있습니다.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="mt-5 rounded-2xl bg-red-50 p-5 font-bold text-red-700 ring-1 ring-red-100">
              {
                errorMessage
              }
            </div>
          )}
        </section>

        {passages.length >
          0 && (
          <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 no-print md:p-8">
            <p className="text-sm font-black text-emerald-600">
              STEP 2
            </p>

            <h2 className="mt-1 text-3xl font-black">
              지문 확인
            </h2>

            <p className="mt-2 text-slate-500">
              문제를 만들 지문만 체크하세요. 추출된 원문은 직접 수정할 수도 있습니다.
            </p>

            <div className="mt-6 space-y-6">
              {passages.map(
                (
                  passage,
                  index
                ) => (
                  <article
                    key={
                      passage.id
                    }
                    className={`rounded-2xl border p-5 ${
                      passage.selected
                        ? "border-emerald-300 bg-emerald-50/40"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex cursor-pointer items-center gap-3 font-black">
                        <input
                          type="checkbox"
                          checked={
                            passage.selected
                          }
                          onChange={() =>
                            togglePassage(
                              passage.id
                            )
                          }
                          className="h-5 w-5 accent-emerald-600"
                        />

                        지문{" "}
                        {index +
                          1}
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          deletePassage(
                            passage.id
                          )
                        }
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm font-black text-red-600"
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
                        updatePassageTitle(
                          passage.id,
                          e.target
                            .value
                        )
                      }
                      className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-black"
                    />

                    <textarea
                      value={
                        passage.content
                      }
                      onChange={(
                        e
                      ) =>
                        updatePassageContent(
                          passage.id,
                          e.target
                            .value
                        )
                      }
                      rows={
                        14
                      }
                      className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-4 leading-8"
                    />
                  </article>
                )
              )}
            </div>
          </section>
        )}

        {passages.length >
          0 && (
          <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 no-print md:p-8">
            <p className="text-sm font-black text-amber-600">
              STEP 3
            </p>

            <h2 className="mt-1 text-3xl font-black">
              난이도 · 문제 유형
            </h2>

            <div className="mt-6">
              <p className="font-black">
                난이도
              </p>

              <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
                {(
                  [
                    "중",
                    "상",
                  ] as Difficulty[]
                ).map(
                  (
                    level
                  ) => {
                    const selected =
                      difficulties.includes(
                        level
                      );

                    return (
                      <button
                        key={
                          level
                        }
                        type="button"
                        onClick={() =>
                          toggleDifficulty(
                            level
                          )
                        }
                        className={`rounded-xl px-5 py-4 font-black transition ${
                          selected
                            ? "bg-slate-900 text-white"
                            : "border border-slate-300 bg-white text-slate-600"
                        }`}
                      >
                        {selected
                          ? "✓ "
                          : ""}
                        난이도{" "}
                        {
                          level
                        }
                      </button>
                    );
                  }
                )}
              </div>

              <p className="mt-3 text-sm text-slate-500">
                중·상을 함께 선택하면 두 난이도를 섞어서 출제합니다.
              </p>
            </div>

            <div className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-black">
                    문제 유형
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    문항 수는 선택한 전체 지문에 고르게 분배합니다. 0문항이면 해당 유형은 출제하지 않습니다.
                  </p>
                </div>

                <p className="rounded-full bg-violet-100 px-4 py-2 text-sm font-black text-violet-700">
                  전체 최대{" "}
                  {
                    questionCount
                  }
                  문항
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <span className="text-sm font-black text-slate-700">
                  전체 유형 문항 수
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setAllTypeCounts(
                      Math.max(
                        0,
                        Math.min(
                          ...typeSettings.map(
                            (item) =>
                              item.count
                          )
                        ) - 1
                      )
                    )
                  }
                  className="h-9 w-9 rounded-lg border border-slate-300 bg-white font-black"
                >
                  -
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setAllTypeCounts(
                      Math.max(
                        ...typeSettings.map(
                          (item) =>
                            item.count
                        )
                      ) + 1
                    )
                  }
                  className="h-9 w-9 rounded-lg bg-slate-900 font-black text-white"
                >
                  +
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setAllTypeCounts(
                      selectedPassages.length
                    )
                  }
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white"
                >
                  선택 지문 수로 맞추기
                </button>

                <span className="text-sm text-slate-500">
                  현재 선택 지문{" "}
                  <strong>
                    {
                      selectedPassages.length
                    }
                  </strong>
                  개
                </span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {typeSettings.map(
                  (
                    item
                  ) => (
                    <div
                      key={
                        item.type
                      }
                      className={`rounded-2xl border p-5 ${
                        item.count >
                        0
                          ? "border-violet-200 bg-violet-50/40"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-black">
                            {
                              item.type
                            }
                          </p>

                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            {
                              item.description
                            }
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateTypeCount(
                                item.type,
                                item.count -
                                  1
                              )
                            }
                            disabled={
                              item.count ===
                              0
                            }
                            className="h-9 w-9 rounded-lg border border-slate-300 bg-white font-black disabled:opacity-30"
                          >
                            -
                          </button>

                          <span className="w-8 text-center text-lg font-black">
                            {
                              item.count
                            }
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              updateTypeCount(
                                item.type,
                                item.count +
                                  1
                              )
                            }
                            disabled={
                              item.count >=
                              30
                            }
                            className="h-9 w-9 rounded-lg bg-violet-600 font-black text-white disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-slate-950 p-6 text-white">
              <p className="text-sm font-bold text-violet-300">
                SELECTED
              </p>

              <p className="mt-1 text-2xl font-black">
                지문{" "}
                {
                  selectedPassages.length
                }
                개 · 전체 최대{" "}
                {
                  questionCount
                }
                문항
              </p>

              <button
                type="button"
                onClick={
                  generateQuestions
                }
                disabled={
                  generating ||
                  selectedPassages.length ===
                    0 ||
                  questionCount ===
                    0
                }
                className="mt-5 w-full rounded-xl bg-violet-500 px-6 py-4 text-lg font-black text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generating
                  ? generationProgress ||
                    "수능형 문제 생성 중..."
                  : "수능형 문제 생성"}
              </button>

              {generationProgress && (
                <div className="mt-4 rounded-xl bg-white/10 p-4 text-center font-bold text-violet-100">
                  {
                    generationProgress
                  }
                </div>
              )}
            </div>
          </section>
        )}

        {questions.length >
          0 && (
          <section
            id="question-results"
            className="mt-10 scroll-mt-6"
          >
            <div className="no-print rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
              <p className="text-sm font-black text-violet-600">
                FINAL QUESTIONS
              </p>

              <h2 className="mt-1 text-3xl font-black">
                문제 검수
              </h2>

              <p className="mt-2 text-slate-500">
                총{" "}
                {
                  questions.length
                }
                문항이 생성되었습니다.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    printQuestions(
                      false
                    )
                  }
                  className="rounded-xl bg-slate-900 px-5 py-4 font-black text-white"
                >
                  문제지만 인쇄 · PDF 저장
                </button>

                <button
                  type="button"
                  onClick={() =>
                    printQuestions(
                      true
                    )
                  }
                  className="rounded-xl bg-violet-600 px-5 py-4 font-black text-white"
                >
                  정답·해설 포함 인쇄 · PDF 저장
                </button>
              </div>
            </div>

            {skippedTypes.length >
              0 && (
              <div className="no-print mt-6 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-100">
                <p className="font-black text-amber-800">
                  출제하지 않은 유형
                </p>

                <div className="mt-3 space-y-2 text-sm text-amber-900">
                  {skippedTypes.map(
                    (
                      item,
                      index
                    ) => (
                      <p
                        key={
                          index
                        }
                      >
                        <strong>
                          {
                            item.passageTitle
                          }{" "}
                          ·{" "}
                          {
                            item.type
                          }
                        </strong>
                        {" — "}
                        {
                          item.reason
                        }
                      </p>
                    )
                  )}
                </div>
              </div>
            )}

            <div className="mt-8 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200 print-card">
              <div className="border-b-2 border-slate-900 pb-5">
                <p className="text-sm font-black tracking-[0.15em] text-violet-600">
                  SUMMIT VISUAL LAB
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  수능형 국어 독서 문제
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  {[
                    schoolName,
                    gradeName,
                    materialName,
                  ]
                    .filter(
                      Boolean
                    )
                    .join(
                      " · "
                    )}
                </p>
              </div>

              {selectedPassages.map(
                (
                  passage,
                  passageIndex
                ) => {
                  const passageQuestions =
                    questions.filter(
                      (
                        question
                      ) =>
                        question.passageId ===
                        passage.id
                    );

                  if (
                    passageQuestions.length ===
                    0
                  ) {
                    return null;
                  }

                  return (
                    <div
                      key={
                        passage.id
                      }
                      className="mt-10"
                    >
                      <div className="print-passage rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
                        <p className="text-sm font-black text-violet-600">
                          지문{" "}
                          {passageIndex +
                            1}
                        </p>

                        <h3 className="mt-1 text-xl font-black">
                          {
                            passage.title
                          }
                        </h3>

                        <div className="mt-5 whitespace-pre-wrap text-[15px] leading-8 text-slate-800">
                          {
                            passage.content
                          }
                        </div>
                      </div>

                      <div className="mt-8 space-y-9">
                        {passageQuestions.map(
                          (
                            question,
                            questionIndex
                          ) => {
                            const globalIndex =
                              questions.findIndex(
                                (
                                  item
                                ) =>
                                  item.id ===
                                  question.id
                              ) +
                              1;

                            return (
                              <article
                                key={
                                  question.id
                                }
                                className="print-card border-b border-slate-200 pb-8"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-white">
                                    {
                                      question.type
                                    }
                                  </span>

                                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">
                                    난이도{" "}
                                    {
                                      question.difficulty
                                    }
                                  </span>
                                </div>

                                <p className="mt-4 text-[17px] font-black leading-8">
                                  {
                                    globalIndex
                                  }
                                  .{" "}
                                  {
                                    question.stem
                                  }
                                </p>

                                {question.targetWord && (
                                  <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm ring-1 ring-amber-100">
                                    <span className="font-black text-amber-800">
                                      대상 어휘
                                    </span>
                                    {" "}
                                    {
                                      question.targetWord
                                    }
                                  </div>
                                )}

                                {question.boxText && (
                                  <div className="mt-5 rounded-xl border border-slate-400 bg-white p-5">
                                    <p className="text-center text-sm font-black">
                                      &lt;보기&gt;
                                    </p>

                                    <p className="mt-3 whitespace-pre-wrap leading-7">
                                      {
                                        question.boxText
                                      }
                                    </p>
                                  </div>
                                )}

                                <div className="mt-5 space-y-3">
                                  {question.choices.map(
                                    (
                                      choice,
                                      choiceIndex
                                    ) => (
                                      <p
                                        key={
                                          choiceIndex
                                        }
                                        className="leading-7"
                                      >
                                        <span className="mr-2 font-black">
                                          {choiceNumber(
                                            choiceIndex
                                          )}
                                        </span>

                                        {
                                          choice
                                        }
                                      </p>
                                    )
                                  )}
                                </div>

                                <div
                                  className={`answer-area mt-6 rounded-2xl bg-violet-50 p-5 ring-1 ring-violet-100 ${
                                    showAnswers
                                      ? ""
                                      : "hidden-for-print"
                                  }`}
                                >
                                  <p className="font-black text-violet-800">
                                    정답{" "}
                                    {
                                      question.answer
                                    }
                                    번
                                  </p>

                                  <p className="mt-3 leading-7 text-slate-700">
                                    {
                                      question.explanation
                                    }
                                  </p>

                                  {question.choiceExplanations.length >
                                    0 && (
                                    <div className="mt-5 border-t border-violet-200 pt-4">
                                      <p className="font-black text-slate-700">
                                        선지별 해설
                                      </p>

                                      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                                        {question.choiceExplanations.map(
                                          (
                                            explanation,
                                            index
                                          ) => (
                                            <p
                                              key={
                                                index
                                              }
                                            >
                                              <strong>
                                                {choiceNumber(
                                                  index
                                                )}
                                              </strong>{" "}
                                              {
                                                explanation
                                              }
                                            </p>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {question.evidence && (
                                    <div className="no-print mt-5 rounded-xl bg-white p-4 ring-1 ring-violet-200">
                                      <p className="text-xs font-black text-violet-700">
                                        관리자 검수용 원문 근거
                                      </p>

                                      <p className="mt-2 text-sm leading-6 text-slate-600">
                                        {
                                          question.evidence
                                        }
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </article>
                            );
                          }
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
