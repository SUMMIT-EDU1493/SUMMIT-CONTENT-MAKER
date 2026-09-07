"use client";

import {
  useState,
} from "react";

import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

type PageImage = {
  pageNumber: number;
  imageUrl: string;
};

type PageTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PageTextData = {
  pageNumber: number;
  items: PageTextItem[];
};

type PassageMarker = {
  label: string;
  text: string;
  kind:
    | "section"
    | "underline"
    | "symbol"
    | "quoted"
    | "other";
};

type SourceQuestion = {
  number: string;
  pageNumber: number;
  stem: string;
  bogi: string;
  choices: string[];
  originalImage?: string;
};

type TwinPassageGroup = {
  id: string;
  title: string;
  source: string;
  markers: PassageMarker[];
  questions: SourceQuestion[];
};

type NormalizedBBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function normalizeText(
  value: string
) {
  return value
    .replace(/\s+/g, "")
    .replace(/[．。]/g, ".")
    .trim();
}

function detectQuestionNumber(
  text: string
) {
  const normalized =
    normalizeText(
      text
    );

  const match =
    normalized.match(
      /^(\d{1,2})[.)]?$/
    );

  if (!match) {
    return null;
  }

  return Number(
    match[1]
  );
}

function getColumn(
  x: number
) {
  if (x < 450) {
    return "left";
  }

  if (x > 550) {
    return "right";
  }

  return "full";
}

function sameColumn(
  a: PageTextItem,
  b: PageTextItem
) {
  const columnA =
    getColumn(a.x);

  const columnB =
    getColumn(b.x);

  if (
    columnA === "full" ||
    columnB === "full"
  ) {
    return true;
  }

  return (
    columnA ===
    columnB
  );
}

function findQuestionItem(
  questionNumber: string,
  page: PageTextData
) {
  const target =
    Number(
      questionNumber
    );

  return (
    page.items
      .filter(
        (
          item: PageTextItem
        ) =>
          detectQuestionNumber(
            item.text
          ) === target
      )
      .sort(
        (
          a,
          b
        ) =>
          a.y - b.y
      )[0] || null
  );
}

function detectQuestionPage(
  questionNumber: string,
  pageTextData: PageTextData[]
) {
  for (
    const page of pageTextData
  ) {
    if (
      findQuestionItem(
        questionNumber,
        page
      )
    ) {
      return page.pageNumber;
    }
  }

  return 0;
}

function findQuestionBBox(
  questionNumber: string,
  pageNumber: number,
  pageTextData: PageTextData[]
): NormalizedBBox {
  const page =
    pageTextData.find(
      (
        item: PageTextData
      ) =>
        item.pageNumber ===
        pageNumber
    );

  if (!page) {
    return {
      x: 5,
      y: 0,
      width: 990,
      height: 1000,
    };
  }

  const current =
    findQuestionItem(
      questionNumber,
      page
    );

  if (!current) {
    return {
      x: 5,
      y: 0,
      width: 990,
      height: 1000,
    };
  }

  const currentNumber =
    Number(
      questionNumber
    );

  const column =
    getColumn(
      current.x
    );

  const questionItems =
    page.items
      .map(
        (
          item: PageTextItem
        ) => ({
          item,
          number:
            detectQuestionNumber(
              item.text
            ),
        })
      )
      .filter(
        (
          candidate
        ) =>
          candidate.number !==
          null
      )
      .filter(
        (
          candidate
        ) =>
          candidate.item.y >
            current.y + 12 &&
          Number(
            candidate.number
          ) >
            currentNumber &&
          sameColumn(
            current,
            candidate.item
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          a.item.y -
          b.item.y
      );

  const next =
    questionItems[0]
      ?.item;

  const startY =
    clamp(
      current.y - 18,
      0,
      990
    );

  const endY =
    next
      ? clamp(
          next.y - 18,
          startY + 80,
          1000
        )
      : 995;

  if (
    column === "left"
  ) {
    return {
      x: 5,
      y: startY,
      width: 495,
      height:
        endY -
        startY,
    };
  }

  if (
    column === "right"
  ) {
    return {
      x: 500,
      y: startY,
      width: 495,
      height:
        endY -
        startY,
    };
  }

  return {
    x: 5,
    y: startY,
    width: 990,
    height:
      endY -
      startY,
  };
}

function cropImage(
  imageUrl: string,
  bbox: NormalizedBBox
) {
  return new Promise<string>(
    (
      resolve,
      reject
    ) => {
      const image =
        new Image();

      image.onload = () => {
        try {
          const sourceX =
            Math.round(
              (bbox.x /
                1000) *
                image.naturalWidth
            );

          const sourceY =
            Math.round(
              (bbox.y /
                1000) *
                image.naturalHeight
            );

          const sourceWidth =
            Math.round(
              (bbox.width /
                1000) *
                image.naturalWidth
            );

          const sourceHeight =
            Math.round(
              (bbox.height /
                1000) *
                image.naturalHeight
            );

          const safeX =
            clamp(
              sourceX,
              0,
              image.naturalWidth -
                1
            );

          const safeY =
            clamp(
              sourceY,
              0,
              image.naturalHeight -
                1
            );

          const safeWidth =
            clamp(
              sourceWidth,
              1,
              image.naturalWidth -
                safeX
            );

          const safeHeight =
            clamp(
              sourceHeight,
              1,
              image.naturalHeight -
                safeY
            );

          const canvas =
            document.createElement(
              "canvas"
            );

          canvas.width =
            safeWidth;

          canvas.height =
            safeHeight;

          const context =
            canvas.getContext(
              "2d"
            );

          if (!context) {
            reject(
              new Error(
                "이미지 크롭에 실패했습니다."
              )
            );

            return;
          }

          context.fillStyle =
            "#ffffff";

          context.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
          );

          context.drawImage(
            image,
            safeX,
            safeY,
            safeWidth,
            safeHeight,
            0,
            0,
            canvas.width,
            canvas.height
          );

          resolve(
            canvas.toDataURL(
              "image/jpeg",
              0.94
            )
          );
        } catch (
          error
        ) {
          reject(
            error
          );
        }
      };

      image.onerror =
        () => {
          reject(
            new Error(
              "PDF 페이지 이미지를 불러오지 못했습니다."
            )
          );
        };

      image.src =
        imageUrl;
    }
  );
}

async function attachOriginalQuestionImages(
  groups: TwinPassageGroup[],
  pageImages: PageImage[],
  pageTextData: PageTextData[]
) {
  const completedGroups: TwinPassageGroup[] =
    [];

  for (
    const group of groups
  ) {
    const completedQuestions: SourceQuestion[] =
      [];

    for (
      const question of
        group.questions
    ) {
      let pageNumber =
        detectQuestionPage(
          question.number,
          pageTextData
        );

      if (
        pageNumber <= 0
      ) {
        pageNumber =
          question.pageNumber;
      }

      const pageImage =
        pageImages.find(
          (
            item: PageImage
          ) =>
            item.pageNumber ===
            pageNumber
        );

      if (!pageImage) {
        completedQuestions.push(
          {
            ...question,
            pageNumber,
          }
        );

        continue;
      }

      const bbox =
        findQuestionBBox(
          question.number,
          pageNumber,
          pageTextData
        );

      try {
        const originalImage =
          await cropImage(
            pageImage.imageUrl,
            bbox
          );

        completedQuestions.push(
          {
            ...question,
            pageNumber,
            originalImage,
          }
        );
      } catch {
        completedQuestions.push(
          {
            ...question,
            pageNumber,
            originalImage:
              pageImage.imageUrl,
          }
        );
      }
    }

    completedGroups.push({
      ...group,
      questions:
        completedQuestions,
    });
  }

  return completedGroups;
}

export default function KoreanTwinQuestionsPage() {
  const [
    fileName,
    setFileName,
  ] = useState("");

  const [
    groups,
    setGroups,
  ] = useState<
    TwinPassageGroup[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

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
        setLoading(
          true
        );

        setGroups(
          []
        );

        setErrorMessage(
          ""
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

        const pageImages: PageImage[] =
          [];

        const pageTextData: PageTextData[] =
          [];

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

          const viewport =
            page.getViewport({
              scale: 2,
            });

          const content =
            await page.getTextContent();

          const textItems: PageTextItem[] =
            [];

          const pageText =
            content.items
              .map(
                (
                  rawItem: any
                ) => {
                  if (
                    !(
                      "str" in
                      rawItem
                    )
                  ) {
                    return "";
                  }

                  const text =
                    String(
                      rawItem.str ??
                        ""
                    );

                  try {
                    const transformed =
                      pdfjsLib.Util.transform(
                        viewport.transform,
                        rawItem.transform
                      );

                    const x =
                      transformed[4];

                    const fontHeight =
                      Math.max(
                        1,
                        Math.abs(
                          transformed[3]
                        )
                      );

                    const y =
                      transformed[5] -
                      fontHeight;

                    const width =
                      Math.max(
                        1,
                        Number(
                          rawItem.width ??
                            1
                        ) *
                          viewport.scale
                      );

                    textItems.push({
                      text,

                      x:
                        (x /
                          viewport.width) *
                        1000,

                      y:
                        (y /
                          viewport.height) *
                        1000,

                      width:
                        (width /
                          viewport.width) *
                        1000,

                      height:
                        (fontHeight /
                          viewport.height) *
                        1000,
                    });
                  } catch {
                    //
                  }

                  return text;
                }
              )
              .join(
                " "
              );

          fullText += `

--- ${pageNumber}페이지 ---

${pageText}
`;

          pageTextData.push({
            pageNumber,
            items:
              textItems,
          });

          const canvas =
            document.createElement(
              "canvas"
            );

          const context =
            canvas.getContext(
              "2d",
              {
                alpha:
                  false,
              }
            );

          if (!context) {
            throw new Error(
              "PDF 페이지 이미지를 만들지 못했습니다."
            );
          }

          canvas.width =
            Math.ceil(
              viewport.width
            );

          canvas.height =
            Math.ceil(
              viewport.height
            );

          context.fillStyle =
            "#ffffff";

          context.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
          );

          await page.render({
            canvasContext:
              context,
            viewport,
          } as any).promise;

          pageImages.push({
            pageNumber,

            imageUrl:
              canvas.toDataURL(
                "image/jpeg",
                0.92
              ),
          });
        }

        const text =
          fullText.trim();

        if (!text) {
          throw new Error(
            "PDF에서 텍스트를 읽지 못했습니다."
          );
        }

        setStatusText(
          "지문과 문항을 분석하는 중..."
        );

        const response =
          await fetch(
            "/api/korean-twin-passages",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  text,
                  pdfText:
                    text,
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
              "원본 문제 분석에 실패했습니다."
          );
        }

        const foundGroups: TwinPassageGroup[] =
          Array.isArray(
            data?.groups
          )
            ? data.groups
            : [];

        if (
          foundGroups.length ===
          0
        ) {
          throw new Error(
            "지문과 문제 세트를 찾지 못했습니다."
          );
        }

        setStatusText(
          "원본 문항 이미지를 만드는 중..."
        );

        const completedGroups =
          await attachOriginalQuestionImages(
            foundGroups,
            pageImages,
            pageTextData
          );

        setGroups(
          completedGroups
        );

        const questionCount =
          completedGroups.reduce(
            (
              total: number,
              group: TwinPassageGroup
            ) =>
              total +
              group.questions
                .length,
            0
          );

        setStatusText(
          `${completedGroups.length}개 지문 · ${questionCount}문항 분석 완료`
        );
      } catch (
        error: any
      ) {
        console.error(
          error
        );

        setErrorMessage(
          error?.message ||
            "오류가 발생했습니다."
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  const handleFileChange =
    async (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        event.target
          .files?.[0];

      if (!file) {
        return;
      }

      if (
        file.type !==
          "application/pdf" &&
        !file.name
          .toLowerCase()
          .endsWith(
            ".pdf"
          )
      ) {
        alert(
          "PDF 파일을 선택해줘."
        );

        return;
      }

      await readPdf(
        file
      );

      event.target.value =
        "";
    };

  const totalQuestions =
    groups.reduce(
      (
        total,
        group
      ) =>
        total +
        group.questions
          .length,
      0
    );

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-black tracking-widest text-purple-600">
          SUMMIT VISUAL LAB
        </p>

        <h1 className="mt-2 text-4xl font-black text-slate-950">
          국어 쌍둥이 문제
        </h1>

        <p className="mt-3 text-slate-600">
          원본 모의고사 문항을 그대로 보존해 분석합니다.
        </p>

        <section className="mt-8 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-2xl font-black">
            원본 시험 PDF
          </h2>

          <label className="mt-6 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-purple-400 hover:bg-purple-50">
            <div>
              <p className="text-lg font-black">
                PDF 파일 선택
              </p>

              {fileName && (
                <p className="mt-4 font-bold text-purple-600">
                  {fileName}
                </p>
              )}
            </div>

            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={
                handleFileChange
              }
            />
          </label>

          {statusText && (
            <div className="mt-5 rounded-2xl bg-blue-50 px-5 py-4 font-bold text-blue-700">
              {statusText}
            </div>
          )}
        </section>

        {errorMessage && (
          <div className="mt-7 rounded-2xl bg-red-50 p-5 font-bold text-red-700">
            {errorMessage}
          </div>
        )}

        {groups.length >
          0 && (
          <section className="mt-10">
            <h2 className="text-3xl font-black text-slate-950">
              원본 문제 구조 확인
            </h2>

            <p className="mt-2 text-slate-500">
              총{" "}
              {totalQuestions}
              문항
            </p>

            <div className="mt-8 space-y-12">
              {groups.map(
                (
                  group,
                  groupIndex
                ) => (
                  <section
                    key={
                      group.id
                    }
                    className="overflow-hidden rounded-[30px] bg-white shadow-sm ring-1 ring-slate-200"
                  >
                    <div className="bg-slate-950 px-8 py-6 text-white">
                      <p className="text-xs font-black tracking-widest text-purple-300">
                        PASSAGE{" "}
                        {groupIndex +
                          1}
                      </p>

                      <h3 className="mt-2 text-2xl font-black">
                        {
                          group.title
                        }
                      </h3>

                      <p className="mt-2 text-sm text-slate-300">
                        원본문제{" "}
                        {group.questions
                          .map(
                            (
                              question
                            ) =>
                              question.number
                          )
                          .join(
                            " · "
                          )}
                      </p>
                    </div>

                    <details className="border-b border-slate-200 bg-slate-50 px-8 py-5">
                      <summary className="cursor-pointer font-bold text-slate-600">
                        분석용 지문 텍스트 보기
                      </summary>

                      <div className="mt-5 whitespace-pre-wrap text-[15px] leading-8 text-slate-800">
                        {
                          group.source
                        }
                      </div>
                    </details>

                    <div className="space-y-8 bg-slate-100 p-6 md:p-9">
                      {group.questions.map(
                        (
                          question
                        ) => (
                          <article
                            key={
                              question.number
                            }
                            className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
                          >
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                              <p className="font-black text-slate-900">
                                {
                                  question.number
                                }
                                번 원본
                              </p>

                              <p className="text-xs font-bold text-slate-400">
                                PDF{" "}
                                {
                                  question.pageNumber
                                }
                                페이지
                              </p>
                            </div>

                            {question.originalImage ? (
                              <div className="bg-white p-3 md:p-5">
                                <img
                                  src={
                                    question.originalImage
                                  }
                                  alt={`${question.number}번 원본 문제`}
                                  className="mx-auto h-auto max-h-[1000px] max-w-full object-contain"
                                />
                              </div>
                            ) : (
                              <div className="p-8 text-center font-bold text-red-600">
                                원본 문항 이미지를 만들지 못했습니다.
                              </div>
                            )}
                          </article>
                        )
                      )}
                    </div>
                  </section>
                )
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}