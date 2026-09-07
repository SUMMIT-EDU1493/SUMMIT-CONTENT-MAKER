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

type QuestionAttachment = {
  id: string;
  type:
    | "table"
    | "graph"
    | "diagram"
    | "image"
    | "chart"
    | "other";
  placement:
    | "passage"
    | "question"
    | "bogi"
    | "choice";
  pageNumber: number;
  description: string;
  imageUrl: string;
};

type SourceQuestion = {
  number: string;
  pageNumber: number;
  stem: string;
  bogi: string;
  choices: string[];
  attachments: QuestionAttachment[];
};

type TwinPassageGroup = {
  id: string;
  title: string;
  source: string;
  markers: PassageMarker[];
  questions: SourceQuestion[];
};

function DecoratedPassage({
  source,
  markers,
}: {
  source: string;
  markers: PassageMarker[];
}) {
  type Piece = {
    text: string;
    marker?: PassageMarker;
  };

  let pieces: Piece[] =
    [
      {
        text:
          source,
      },
    ];

  const sortedMarkers =
    [...markers].sort(
      (
        a,
        b
      ) =>
        b.text.length -
        a.text.length
    );

  for (
    const marker of sortedMarkers
  ) {
    const next: Piece[] =
      [];

    for (
      const piece of pieces
    ) {
      if (
        piece.marker ||
        !piece.text.includes(
          marker.text
        )
      ) {
        next.push(
          piece
        );

        continue;
      }

      const index =
        piece.text.indexOf(
          marker.text
        );

      const before =
        piece.text.slice(
          0,
          index
        );

      const matched =
        piece.text.slice(
          index,
          index +
            marker.text.length
        );

      const after =
        piece.text.slice(
          index +
            marker.text.length
        );

      if (before) {
        next.push({
          text: before,
        });
      }

      next.push({
        text:
          matched,
        marker,
      });

      if (after) {
        next.push({
          text: after,
        });
      }
    }

    pieces =
      next;
  }

  return (
    <div className="whitespace-pre-wrap text-[16px] leading-[2.05] text-slate-950">
      {pieces.map(
        (
          piece,
          index
        ) => {
          if (
            !piece.marker
          ) {
            return (
              <span
                key={
                  index
                }
              >
                {
                  piece.text
                }
              </span>
            );
          }

          if (
            piece.marker
              .kind ===
              "section" ||
            piece.marker
              .kind ===
              "underline" ||
            piece.marker
              .kind ===
              "symbol"
          ) {
            return (
              <span
                key={
                  index
                }
                className="underline decoration-[1.5px] underline-offset-[4px]"
              >
                {
                  piece.text
                }
              </span>
            );
          }

          return (
            <span
              key={
                index
              }
            >
              {
                piece.text
              }
            </span>
          );
        }
      )}
    </div>
  );
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
        setLoading(true);
        setGroups([]);
        setErrorMessage("");

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
              scale: 1.7,
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
                    const transform =
                      pdfjsLib.Util.transform(
                        viewport.transform,
                        rawItem.transform
                      );

                    const x =
                      transform[4];

                    const fontHeight =
                      Math.max(
                        1,
                        Math.abs(
                          transform[3]
                        )
                      );

                    const y =
                      transform[5] -
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
                0.8
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
          "원본 문제와 시각 자료를 분석하는 중..."
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
                  pageImages,
                  pageTextData,
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
              "분석에 실패했습니다."
          );
        }

        const foundGroups =
          Array.isArray(
            data?.groups
          )
            ? data.groups
            : [];

        setGroups(
          foundGroups
        );

        const questionCount =
          foundGroups.reduce(
            (
              total: number,
              group: TwinPassageGroup
            ) =>
              total +
              group.questions
                .length,
            0
          );

        const assetCount =
          foundGroups.reduce(
            (
              total: number,
              group: TwinPassageGroup
            ) =>
              total +
              group.questions.reduce(
                (
                  qTotal: number,
                  question: SourceQuestion
                ) =>
                  qTotal +
                  question
                    .attachments
                    .length,
                0
              ),
            0
          );

        setStatusText(
          `${foundGroups.length}개 지문 · ${questionCount}문항 · 시각자료 ${assetCount}개 분석 완료`
        );
      } catch (
        error: any
      ) {
        setErrorMessage(
          error?.message ||
            "오류가 발생했습니다."
        );
      } finally {
        setLoading(false);
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

      await readPdf(
        file
      );

      event.target.value =
        "";
    };

  const renderVisual =
    (
      attachment:
        QuestionAttachment
    ) => {
      if (
        !attachment.imageUrl
      ) {
        return null;
      }

      return (
        <div
          key={
            attachment.id
          }
          className="my-6 flex justify-center"
        >
          <img
            src={
              attachment.imageUrl
            }
            alt={
              attachment.description
            }
            className="h-auto max-h-[520px] max-w-full object-contain"
          />
        </div>
      );
    };

  const renderQuestion =
    (
      question:
        SourceQuestion
    ) => {
      const questionAssets =
        question.attachments.filter(
          (
            item
          ) =>
            item.placement ===
            "question"
        );

      const bogiAssets =
        question.attachments.filter(
          (
            item
          ) =>
            item.placement ===
            "bogi"
        );

      const choiceAssets =
        question.attachments.filter(
          (
            item
          ) =>
            item.placement ===
            "choice"
        );

      return (
        <article
          key={
            question.number
          }
          className="rounded-2xl bg-white px-8 py-8 shadow-sm ring-1 ring-slate-200 md:px-11"
        >
          <div className="flex items-start gap-3">
            <span className="shrink-0 text-[18px] font-black leading-8 text-slate-950">
              {
                question.number
              }.
            </span>

            <p className="text-[17px] font-semibold leading-8 text-slate-950">
              {
                question.stem
              }
            </p>
          </div>

          {questionAssets.map(
            renderVisual
          )}

          {(question.bogi ||
            bogiAssets.length >
              0) && (
            <div className="mx-auto my-8 max-w-[760px] border-y border-slate-700 px-6 py-5">
              <div className="text-center text-[15px] font-bold tracking-[0.25em]">
                &lt; 보 기 &gt;
              </div>

              {question.bogi && (
                <div className="mt-5 whitespace-pre-wrap text-[15px] leading-8 text-slate-950">
                  {
                    question.bogi
                  }
                </div>
              )}

              {bogiAssets.map(
                renderVisual
              )}
            </div>
          )}

          {question.choices
            .length >
            0 && (
            <div className="mt-7 space-y-3">
              {question.choices.map(
                (
                  choice,
                  index
                ) => (
                  <div
                    key={
                      index
                    }
                    className="text-[16px] leading-7 text-slate-950"
                  >
                    {
                      choice
                    }
                  </div>
                )
              )}
            </div>
          )}

          {choiceAssets.map(
            renderVisual
          )}
        </article>
      );
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
          원본 모의고사 형식을 먼저 정확히 분석합니다.
        </p>

        <section className="mt-8 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-2xl font-black">
            원본 시험 PDF
          </h2>

          <label className="mt-6 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <div>
              <p className="text-lg font-black">
                PDF 파일 선택
              </p>

              {fileName && (
                <p className="mt-4 font-bold text-purple-600">
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
              onChange={
                handleFileChange
              }
            />
          </label>

          {statusText && (
            <div className="mt-5 rounded-2xl bg-blue-50 px-5 py-4 font-bold text-blue-700">
              {
                statusText
              }
            </div>
          )}
        </section>

        {errorMessage && (
          <div className="mt-7 rounded-2xl bg-red-50 p-5 font-bold text-red-700">
            {
              errorMessage
            }
          </div>
        )}

        {groups.length >
          0 && (
          <section className="mt-10">
            <h2 className="text-3xl font-black">
              원본 문제 구조 확인
            </h2>

            <p className="mt-2 text-slate-500">
              총{" "}
              {
                totalQuestions
              }
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
                      <p className="text-xs font-black text-purple-300">
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
                              item
                            ) =>
                              item.number
                          )
                          .join(
                            " · "
                          )}
                      </p>
                    </div>

                    <div className="px-9 py-9 md:px-12">
                      <p className="mb-5 text-xs font-black tracking-widest text-slate-400">
                        지 문
                      </p>

                      <DecoratedPassage
                        source={
                          group.source
                        }
                        markers={
                          group.markers ||
                          []
                        }
                      />
                    </div>

                    <div className="space-y-7 border-t bg-slate-50 p-7 md:p-9">
                      {group.questions.map(
                        renderQuestion
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