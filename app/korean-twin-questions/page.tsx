"use client";

import {
  useEffect,
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

type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
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

  bbox: BoundingBox | null;

  description: string;
};

type SourceQuestion = {
  number: string;
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

/*
==================================================
원본 PDF 일부를 잘라내는 컴포넌트
==================================================
*/

function PdfCrop({
  pageImage,
  bbox,
  description,
}: {
  pageImage: string;
  bbox: BoundingBox;
  description?: string;
}) {
  const [
    croppedImage,
    setCroppedImage,
  ] = useState("");

  useEffect(() => {
    let cancelled = false;

    const crop = async () => {
      try {
        const image =
          new Image();

        image.onload = () => {
          if (cancelled) return;

          const x =
            (bbox.x / 1000) *
            image.naturalWidth;

          const y =
            (bbox.y / 1000) *
            image.naturalHeight;

          const width =
            (bbox.width / 1000) *
            image.naturalWidth;

          const height =
            (bbox.height / 1000) *
            image.naturalHeight;

          const safeWidth =
            Math.max(
              1,
              Math.min(
                width,
                image.naturalWidth -
                  x
              )
            );

          const safeHeight =
            Math.max(
              1,
              Math.min(
                height,
                image.naturalHeight -
                  y
              )
            );

          const canvas =
            document.createElement(
              "canvas"
            );

          canvas.width =
            Math.round(
              safeWidth
            );

          canvas.height =
            Math.round(
              safeHeight
            );

          const ctx =
            canvas.getContext(
              "2d"
            );

          if (!ctx) {
            return;
          }

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
            x,
            y,
            safeWidth,
            safeHeight,
            0,
            0,
            canvas.width,
            canvas.height
          );

          const result =
            canvas.toDataURL(
              "image/jpeg",
              0.92
            );

          if (
            !cancelled
          ) {
            setCroppedImage(
              result
            );
          }
        };

        image.src =
          pageImage;
      } catch (
        error
      ) {
        console.error(
          "PDF CROP ERROR:",
          error
        );
      }
    };

    crop();

    return () => {
      cancelled = true;
    };
  }, [
    pageImage,
    bbox.x,
    bbox.y,
    bbox.width,
    bbox.height,
  ]);

  if (!croppedImage) {
    return (
      <div className="my-4 rounded-xl bg-slate-100 px-5 py-6 text-center text-sm font-bold text-slate-400">
        원본 자료 불러오는 중...
      </div>
    );
  }

  return (
    <figure className="my-5">
      <div className="flex justify-center">
        <img
          src={croppedImage}
          alt={
            description ||
            "원본 시험 자료"
          }
          className="max-h-[520px] max-w-full bg-white object-contain"
        />
      </div>
    </figure>
  );
}

/*
==================================================
지문 밑줄/표식 렌더링
==================================================
*/

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

  let pieces: Piece[] = [
    {
      text: source,
    },
  ];

  /*
  긴 범위부터 처리해서
  (가) 전체 범위가 잘리는 것 방지
  */

  const sortedMarkers = [
    ...markers,
  ].sort(
    (a, b) =>
      b.text.length -
      a.text.length
  );

  for (
    const marker of sortedMarkers
  ) {
    const nextPieces: Piece[] =
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
        nextPieces.push(
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
        nextPieces.push({
          text: before,
        });
      }

      nextPieces.push({
        text: matched,
        marker,
      });

      if (after) {
        nextPieces.push({
          text: after,
        });
      }
    }

    pieces =
      nextPieces;
  }

  return (
    <div className="whitespace-pre-wrap text-[16px] leading-[2.05] tracking-[-0.01em] text-slate-950">
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
                key={index}
              >
                {piece.text}
              </span>
            );
          }

          const marker =
            piece.marker;

          if (
            marker.kind ===
              "section" ||
            marker.kind ===
              "underline"
          ) {
            return (
              <span
                key={index}
                className="underline decoration-[1.5px] underline-offset-[4px]"
                title={
                  marker.label
                }
              >
                {piece.text}
              </span>
            );
          }

          if (
            marker.kind ===
            "symbol"
          ) {
            return (
              <span
                key={index}
                className="font-bold underline decoration-[1.5px] underline-offset-[4px]"
              >
                {piece.text}
              </span>
            );
          }

          if (
            marker.kind ===
            "quoted"
          ) {
            return (
              <span
                key={index}
                className="font-semibold"
              >
                {piece.text}
              </span>
            );
          }

          return (
            <span
              key={index}
            >
              {piece.text}
            </span>
          );
        }
      )}
    </div>
  );
}

/*
==================================================
메인
==================================================
*/

export default function KoreanTwinQuestionsPage() {
  const [
    fileName,
    setFileName,
  ] = useState("");

  const [
    pdfText,
    setPdfText,
  ] = useState("");

  const [
    pageImages,
    setPageImages,
  ] = useState<PageImage[]>(
    []
  );

  const [
    groups,
    setGroups,
  ] = useState<
    TwinPassageGroup[]
  >([]);

  const [
    loadingPdf,
    setLoadingPdf,
  ] = useState(false);

  const [
    loadingAnalyze,
    setLoadingAnalyze,
  ] = useState(false);

  const [
    statusText,
    setStatusText,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  /*
  ==================================================
  PDF TEXT + IMAGE
  ==================================================
  */

  const readPdf = async (
    file: File
  ) => {
    try {
      setLoadingPdf(true);

      setErrorMessage("");
      setGroups([]);
      setPdfText("");
      setPageImages([]);

      setFileName(
        file.name
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

      const renderedPages: PageImage[] =
        [];

      for (
        let pageNumber = 1;
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

        /*
        ------------------------------
        TEXT
        ------------------------------
        */

        const content =
          await page.getTextContent();

        const pageText =
          content.items
            .map(
              (
                item: any
              ) => {
                if (
                  "str" in item
                ) {
                  return item.str;
                }

                return "";
              }
            )
            .join(" ");

        fullText += `

--- ${pageNumber}페이지 ---

${pageText}
`;

        /*
        ------------------------------
        PAGE IMAGE
        ------------------------------
        */

        setStatusText(
          `${pageNumber}/${pdf.numPages} 페이지 화면 분석 준비 중...`
        );

        const viewport =
          page.getViewport({
            scale: 1.45,
          });

        const canvas =
          document.createElement(
            "canvas"
          );

        const context =
          canvas.getContext(
            "2d",
            {
              alpha: false,
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

        await page
          .render({
            canvasContext:
              context,
            viewport,
          } as any)
          .promise;

        /*
        JPEG로 압축해서
        API 요청 크기를 줄임
        */

        const imageUrl =
          canvas.toDataURL(
            "image/jpeg",
            0.72
          );

        renderedPages.push({
          pageNumber,
          imageUrl,
        });
      }

      const cleanedText =
        fullText.trim();

      if (
        !cleanedText
      ) {
        throw new Error(
          "PDF에서 텍스트를 읽지 못했습니다."
        );
      }

      setPdfText(
        cleanedText
      );

      setPageImages(
        renderedPages
      );

      await analyzeTwinSource(
        cleanedText,
        renderedPages
      );
    } catch (
      error: any
    ) {
      console.error(
        "PDF READ ERROR:",
        error
      );

      setErrorMessage(
        error?.message ||
          "PDF를 읽는 중 오류가 발생했습니다."
      );
    } finally {
      setLoadingPdf(false);
    }
  };

  /*
  ==================================================
  API ANALYSIS
  ==================================================
  */

  const analyzeTwinSource =
    async (
      text: string,
      images: PageImage[]
    ) => {
      try {
        setLoadingAnalyze(
          true
        );

        setErrorMessage("");

        if (!text.trim()) {
          throw new Error(
            "분석할 텍스트가 없습니다."
          );
        }

        if (
          images.length === 0
        ) {
          throw new Error(
            "분석할 시험지 이미지가 없습니다."
          );
        }

        setStatusText(
          "원본 모의고사 형식까지 분석하는 중..."
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
                  pageImages:
                    images,
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

        const foundGroups:
          TwinPassageGroup[] =
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

        setGroups(
          foundGroups
        );

        const questionCount =
          foundGroups.reduce(
            (
              sum,
              group
            ) =>
              sum +
              group.questions
                .length,
            0
          );

        const assetCount =
          foundGroups.reduce(
            (
              groupTotal,
              group
            ) =>
              groupTotal +
              group.questions.reduce(
                (
                  total,
                  question
                ) =>
                  total +
                  (
                    question.attachments ||
                    []
                  ).length,
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
        console.error(
          "TWIN ANALYZE ERROR:",
          error
        );

        setErrorMessage(
          error?.message ||
            "원본 문제 분석 중 오류가 발생했습니다."
        );
      } finally {
        setLoadingAnalyze(
          false
        );
      }
    };

  /*
  ==================================================
  FILE
  ==================================================
  */

  const handleFileChange =
    async (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        event.target.files?.[0];

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

      /*
      같은 PDF를 다시 선택해도
      onChange가 작동하도록 초기화
      */

      event.target.value =
        "";
    };

  /*
  ==================================================
  PAGE IMAGE FINDER
  ==================================================
  */

  const findPageImage = (
    pageNumber: number
  ) => {
    return (
      pageImages.find(
        (page) =>
          page.pageNumber ===
          pageNumber
      )?.imageUrl || ""
    );
  };

  /*
  ==================================================
  ATTACHMENT
  ==================================================
  */

  const renderAttachment = (
    attachment:
      QuestionAttachment
  ) => {
    if (
      !attachment.bbox
    ) {
      return null;
    }

    const pageImage =
      findPageImage(
        attachment.pageNumber
      );

    if (!pageImage) {
      return null;
    }

    return (
      <PdfCrop
        key={
          attachment.id
        }
        pageImage={
          pageImage
        }
        bbox={
          attachment.bbox
        }
        description={
          attachment.description
        }
      />
    );
  };

  /*
  ==================================================
  QUESTION
  ==================================================
  */

  const renderQuestion = (
    question:
      SourceQuestion
  ) => {
    const attachments =
      Array.isArray(
        question.attachments
      )
        ? question.attachments
        : [];

    const questionAssets =
      attachments.filter(
        (item) =>
          item.placement ===
          "question"
      );

    const bogiAssets =
      attachments.filter(
        (item) =>
          item.placement ===
          "bogi"
      );

    const choiceAssets =
      attachments.filter(
        (item) =>
          item.placement ===
          "choice"
      );

    return (
      <article
        key={
          question.number
        }
        className="rounded-2xl bg-white px-7 py-8 shadow-sm ring-1 ring-slate-200 md:px-10"
      >
        {/* 발문 */}

        <div className="flex items-start gap-3">
          <span className="shrink-0 pt-[1px] text-[18px] font-black leading-8 text-slate-950">
            {question.number}.
          </span>

          <p className="text-[17px] font-semibold leading-8 tracking-[-0.01em] text-slate-950">
            {question.stem}
          </p>
        </div>

        {/* 발문 밑 자료 */}

        {questionAssets.length >
          0 && (
          <div className="mx-auto mt-5 max-w-[720px]">
            {questionAssets.map(
              renderAttachment
            )}
          </div>
        )}

        {/* 보기 */}

        {(question.bogi ||
          bogiAssets.length >
            0) && (
          <div className="mx-auto my-8 max-w-[760px]">
            <div className="border-y-[1.5px] border-slate-700 px-6 pb-6 pt-4">
              <div className="text-center text-[15px] font-bold tracking-[0.24em] text-slate-900">
                &lt; 보 기 &gt;
              </div>

              {question.bogi && (
                <div className="mt-5 whitespace-pre-wrap text-[15px] leading-7 tracking-[-0.01em] text-slate-950">
                  {
                    question.bogi
                  }
                </div>
              )}

              {bogiAssets.map(
                renderAttachment
              )}
            </div>
          </div>
        )}

        {/* 선택지 */}

        {question.choices
          .length > 0 && (
          <div className="mt-7 space-y-[10px] pl-1">
            {question.choices.map(
              (
                choice,
                index
              ) => (
                <div
                  key={`${question.number}-${index}`}
                  className="text-[16px] leading-7 tracking-[-0.01em] text-slate-950"
                >
                  {choice}
                </div>
              )
            )}
          </div>
        )}

        {/* 표형 선택지 */}

        {choiceAssets.length >
          0 && (
          <div className="mx-auto mt-6 max-w-[760px]">
            {choiceAssets.map(
              renderAttachment
            )}
          </div>
        )}
      </article>
    );
  };

  const totalQuestions =
    groups.reduce(
      (
        sum,
        group
      ) =>
        sum +
        group.questions.length,
      0
    );

  const totalAssets =
    groups.reduce(
      (
        total,
        group
      ) =>
        total +
        group.questions.reduce(
          (
            questionTotal,
            question
          ) =>
            questionTotal +
            (
              question.attachments ||
              []
            ).length,
          0
        ),
      0
    );

  /*
  ==================================================
  UI
  ==================================================
  */

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-10">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}

        <div>
          <p className="text-sm font-black tracking-widest text-purple-600">
            SUMMIT VISUAL LAB
          </p>

          <h1 className="mt-2 text-4xl font-black text-slate-950">
            국어 쌍둥이 문제
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            원본 모의고사의
            지문·발문·보기·선택지뿐 아니라
            밑줄과 표·도식까지 함께 분석합니다.
          </p>
        </div>

        {/* UPLOAD */}

        <section className="mt-8 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black text-blue-600">
            STEP 1
          </p>

          <h2 className="mt-2 text-2xl font-black text-slate-950">
            원본 국어 시험 PDF
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            PDF를 텍스트와 페이지 이미지 두 방식으로
            동시에 읽습니다.
          </p>

          <label className="mt-6 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-purple-400 hover:bg-purple-50">
            <div>
              <p className="text-lg font-black text-slate-800">
                PDF 파일 선택
              </p>

              <p className="mt-2 text-sm text-slate-500">
                고등 국어 모의고사 PDF
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

          {(loadingPdf ||
            loadingAnalyze) && (
            <div className="mt-5 rounded-2xl bg-blue-50 px-5 py-4 font-bold text-blue-700">
              {statusText}
            </div>
          )}

          {!loadingPdf &&
            !loadingAnalyze &&
            groups.length >
              0 && (
              <div className="mt-5 rounded-2xl bg-emerald-50 px-5 py-4 font-bold text-emerald-700">
                {groups.length}
                개 지문 ·{" "}
                {totalQuestions}
                문항 · 시각자료{" "}
                {totalAssets}
                개 분석 완료
              </div>
            )}
        </section>

        {/* ERROR */}

        {errorMessage && (
          <div className="mt-8 rounded-2xl bg-red-50 p-5 font-bold text-red-700 ring-1 ring-red-200">
            {
              errorMessage
            }
          </div>
        )}

        {/* RESULT */}

        {groups.length >
          0 && (
          <section className="mt-10">
            <p className="text-sm font-black tracking-widest text-purple-600">
              SOURCE FORMAT CHECK
            </p>

            <h2 className="mt-2 text-3xl font-black text-slate-950">
              원본 모의고사 구조 확인
            </h2>

            <p className="mt-3 text-slate-600">
              지금은 쌍둥이 문제를 만들기 전,
              원본 형식을 제대로 읽었는지 확인하는 단계야.
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
                    {/* HEADER */}

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

                    {/* PASSAGE */}

                    <div className="bg-white px-8 py-9 md:px-12">
                      <div className="mx-auto max-w-[900px]">
                        <p className="mb-5 text-xs font-black tracking-[0.2em] text-slate-400">
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
                    </div>

                    {/* QUESTIONS */}

                    <div className="space-y-7 border-t border-slate-200 bg-slate-50 p-6 md:p-9">
                      {group.questions.map(
                        (
                          question
                        ) =>
                          renderQuestion(
                            question
                          )
                      )}
                    </div>
                  </section>
                )
              )}
            </div>
          </section>
        )}

        {/* 상태 보존용 */}

        <div className="hidden">
          {pdfText.length}
          {pageImages.length}
        </div>
      </div>
    </main>
  );
}