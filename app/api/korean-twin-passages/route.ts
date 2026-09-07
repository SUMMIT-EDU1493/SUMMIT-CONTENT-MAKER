import OpenAI from "openai";
import sharp from "sharp";

export const maxDuration = 300;

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

type NormalizedBBox = {
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

function cleanInline(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function cleanBlock(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function numberValue(
  value: unknown,
  fallback = 0
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

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

function parseBBox(
  value: unknown
): NormalizedBBox | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const raw =
    value as Record<
      string,
      unknown
    >;

  const x =
    numberValue(raw.x);

  const y =
    numberValue(raw.y);

  const width =
    numberValue(raw.width);

  const height =
    numberValue(raw.height);

  if (
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return {
    x: clamp(x, 0, 1000),
    y: clamp(y, 0, 1000),
    width: clamp(
      width,
      1,
      1000
    ),
    height: clamp(
      height,
      1,
      1000
    ),
  };
}

function parseJsonOutput(
  output: string
) {
  const cleaned =
    output
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /```$/i,
        ""
      )
      .trim();

  return JSON.parse(cleaned);
}

function dataUrlToBuffer(
  dataUrl: string
) {
  const commaIndex =
    dataUrl.indexOf(",");

  if (
    commaIndex === -1
  ) {
    throw new Error(
      "이미지 데이터 형식이 올바르지 않습니다."
    );
  }

  const base64 =
    dataUrl.slice(
      commaIndex + 1
    );

  return Buffer.from(
    base64,
    "base64"
  );
}

function bufferToDataUrl(
  buffer: Buffer,
  mimeType = "image/jpeg"
) {
  return `data:${mimeType};base64,${buffer.toString(
    "base64"
  )}`;
}

async function cropNormalizedImage(
  imageUrl: string,
  bbox: NormalizedBBox,
  padding = 0
) {
  const input =
    dataUrlToBuffer(
      imageUrl
    );

  const image =
    sharp(input);

  const metadata =
    await image.metadata();

  const imageWidth =
    metadata.width || 1;

  const imageHeight =
    metadata.height || 1;

  let left =
    Math.round(
      (bbox.x / 1000) *
        imageWidth
    );

  let top =
    Math.round(
      (bbox.y / 1000) *
        imageHeight
    );

  let width =
    Math.round(
      (bbox.width /
        1000) *
        imageWidth
    );

  let height =
    Math.round(
      (bbox.height /
        1000) *
        imageHeight
    );

  left = Math.max(
    0,
    left - padding
  );

  top = Math.max(
    0,
    top - padding
  );

  width = Math.min(
    imageWidth - left,
    width +
      padding * 2
  );

  height = Math.min(
    imageHeight - top,
    height +
      padding * 2
  );

  if (
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      "이미지 크롭 범위가 올바르지 않습니다."
    );
  }

  const output =
    await image
      .extract({
        left,
        top,
        width,
        height,
      })
      .jpeg({
        quality: 94,
      })
      .toBuffer();

  return bufferToDataUrl(
    output
  );
}

function isQuestionNumberText(
  text: string,
  number: string
) {
  const cleaned =
    text
      .replace(/\s+/g, "")
      .trim();

  const escaped =
    number.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  const regex =
    new RegExp(
      `^${escaped}[\\.\\)]?$`
    );

  return regex.test(
    cleaned
  );
}

function findQuestionPage(
  questionNumber: string,
  pageTextData: PageTextData[]
) {
  for (
    const page of pageTextData
  ) {
    const found =
      page.items.some(
        (item) =>
          isQuestionNumberText(
            item.text,
            questionNumber
          )
      );

    if (found) {
      return page.pageNumber;
    }
  }

  return 0;
}

function findQuestionRegion(
  questionNumber: string,
  pageNumber: number,
  pageTextData: PageTextData[]
): NormalizedBBox {
  const page =
    pageTextData.find(
      (item) =>
        item.pageNumber ===
        pageNumber
    );

  if (
    !page ||
    page.items.length === 0
  ) {
    return {
      x: 30,
      y: 0,
      width: 940,
      height: 1000,
    };
  }

  const sorted =
    [...page.items].sort(
      (a, b) => {
        if (
          Math.abs(
            a.y - b.y
          ) < 4
        ) {
          return (
            a.x - b.x
          );
        }

        return (
          a.y - b.y
        );
      }
    );

  const current =
    sorted.find(
      (item) =>
        isQuestionNumberText(
          item.text,
          questionNumber
        )
    );

  if (!current) {
    return {
      x: 30,
      y: 0,
      width: 940,
      height: 1000,
    };
  }

  const currentNumber =
    Number(
      questionNumber
    );

  let nextY = 990;

  if (
    Number.isFinite(
      currentNumber
    )
  ) {
    const nextCandidates =
      sorted.filter(
        (item) => {
          const value =
            item.text
              .replace(
                /\s+/g,
                ""
              )
              .match(
                /^(\d+)[\.\)]?$/
              );

          if (!value) {
            return false;
          }

          const number =
            Number(
              value[1]
            );

          return (
            number >
              currentNumber &&
            item.y >
              current.y + 10
          );
        }
      );

    if (
      nextCandidates.length >
      0
    ) {
      nextY =
        nextCandidates[0].y -
        8;
    }
  }

  const startY =
    clamp(
      current.y - 12,
      0,
      990
    );

  const endY =
    clamp(
      nextY,
      startY + 50,
      1000
    );

  return {
    x: 25,
    y: startY,
    width: 950,
    height:
      endY - startY,
  };
}

async function findVisualInsideQuestion({
  openai,
  questionCrop,
  questionNumber,
  type,
  placement,
  description,
}: {
  openai: OpenAI;
  questionCrop: string;
  questionNumber: string;
  type: QuestionAttachment["type"];
  placement: QuestionAttachment["placement"];
  description: string;
}) {
  const prompt = `
이 이미지는 국어 모의고사의 ${questionNumber}번 문항 영역만 잘라낸 이미지입니다.

이 안에서 "텍스트 발문이나 일반 선택지"가 아니라
실제 시각 자료만 정확히 찾으세요.

찾는 자료:

종류: ${type}
위치: ${placement}
설명: ${description}

==================================================
시각 자료로 인정
==================================================

다음은 시각 자료입니다.

- 표
- 그래프
- 도식
- 그림
- 사진
- 좌표 그림
- 표 형태 선택지
- 그림이 포함된 <보기>
- 표가 포함된 <보기>

==================================================
시각 자료가 아님
==================================================

다음은 크롭하면 안 됩니다.

- 일반 발문
- 일반 줄글
- 순수 텍스트 <보기>
- 일반 선택지 ①~⑤
- 문제 번호
- 앞뒤 설명 문장

==================================================
중요
==================================================

표라면 표 전체를 포함하세요.

표 제목이나 단위가
표 해석에 필요하면 함께 포함하세요.

그림이라면 그림 전체가
위아래 좌우 어느 쪽도 잘리지 않게 하세요.

<보기> 안에 그림이나 표가 있는 경우
그 시각 자료만 포함하세요.

발문이나 선택지는 제외하세요.

==================================================
좌표
==================================================

현재 잘라낸 문항 이미지 전체를
0~1000 좌표로 봅니다.

왼쪽 위:
x=0
y=0

오른쪽 아래:
x=1000
y=1000

자료를 찾았으면:

{
  "found": true,
  "bbox": {
    "x": 100,
    "y": 250,
    "width": 700,
    "height": 300
  }
}

실제 시각 자료가 없고
순수 텍스트만 있다면:

{
  "found": false,
  "bbox": null
}

반드시 JSON만 출력하세요.
`;

  const result =
    await openai.responses.create({
      model:
        "gpt-5-mini",

      input: [
        {
          role: "user",

          content: [
            {
              type:
                "input_text",
              text:
                prompt,
            },

            {
              type:
                "input_image",
              image_url:
                questionCrop,
              detail:
                "high",
            },
          ],
        },
      ],
    });

  const output =
    result.output_text?.trim() ??
    "";

  if (!output) {
    return null;
  }

  try {
    const parsed =
      parseJsonOutput(
        output
      );

    if (
      parsed?.found !==
      true
    ) {
      return null;
    }

    return parseBBox(
      parsed?.bbox
    );
  } catch {
    return null;
  }
}

export async function POST(
  request: Request
) {
  try {
    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "OPENAI_API_KEY가 설정되어 있지 않습니다.",
        },
        {
          status: 500,
        }
      );
    }

    const body =
      await request.json();

    const rawText =
      body?.text ??
      body?.pdfText ??
      "";

    const text =
      typeof rawText ===
      "string"
        ? rawText.trim()
        : "";

    const rawPageImages: unknown[] =
      Array.isArray(
        body?.pageImages
      )
        ? body.pageImages
        : [];

    const pageImages: PageImage[] =
      rawPageImages
        .map(
          (
            raw: unknown
          ): PageImage => {
            const item =
              raw &&
              typeof raw ===
                "object"
                ? (raw as Record<
                    string,
                    unknown
                  >)
                : {};

            return {
              pageNumber:
                numberValue(
                  item.pageNumber
                ),

              imageUrl:
                cleanInline(
                  item.imageUrl
                ),
            };
          }
        )
        .filter(
          (
            item: PageImage
          ) =>
            item.pageNumber >
              0 &&
            item.imageUrl.startsWith(
              "data:image"
            )
        );

    const rawPageTextData: unknown[] =
      Array.isArray(
        body?.pageTextData
      )
        ? body.pageTextData
        : [];

    const pageTextData: PageTextData[] =
      rawPageTextData.map(
        (
          raw: unknown
        ): PageTextData => {
          const page =
            raw &&
            typeof raw ===
              "object"
              ? (raw as Record<
                  string,
                  unknown
                >)
              : {};

          const rawItems: unknown[] =
            Array.isArray(
              page.items
            )
              ? page.items
              : [];

          const items: PageTextItem[] =
            rawItems
              .map(
                (
                  rawItem: unknown
                ): PageTextItem => {
                  const item =
                    rawItem &&
                    typeof rawItem ===
                      "object"
                      ? (rawItem as Record<
                          string,
                          unknown
                        >)
                      : {};

                  return {
                    text:
                      cleanInline(
                        item.text
                      ),

                    x:
                      numberValue(
                        item.x
                      ),

                    y:
                      numberValue(
                        item.y
                      ),

                    width:
                      numberValue(
                        item.width
                      ),

                    height:
                      numberValue(
                        item.height
                      ),
                  };
                }
              )
              .filter(
                (
                  item: PageTextItem
                ) =>
                  Boolean(
                    item.text
                  )
              );

          return {
            pageNumber:
              numberValue(
                page.pageNumber
              ),

            items,
          };
        }
      );

    if (!text) {
      return Response.json(
        {
          error:
            "분석할 텍스트가 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      pageImages.length === 0
    ) {
      return Response.json(
        {
          error:
            "시험지 페이지 이미지를 읽지 못했습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const openai =
      new OpenAI({
        apiKey,
      });

    const prompt = `
당신은 대한민국 국어 모의고사 분석 전문가입니다.

PDF 전체 텍스트와 실제 시험지 페이지 이미지를 함께 보고
비문학 지문과 해당 문제를 추출하세요.

새 문제는 만들지 마세요.

==================================================
중요
==================================================

이번 출력에서는
"실제 시각 자료가 존재하는지"를 매우 엄격하게 판단합니다.

시각 자료:

- 표
- 그래프
- 그림
- 도식
- 사진
- 표 형태 선택지
- 그림/표가 포함된 <보기>

시각 자료가 아닌 것:

- 순수 텍스트 <보기>
- 일반 줄글
- 일반 발문
- 일반 선택지

순수 텍스트 <보기>를
attachment로 만들면 안 됩니다.

==================================================
지문
==================================================

source에는 원문 지문만 넣으세요.

문제 번호, 발문, 선택지는 제거하세요.

다음은 보존하세요.

- 문단
- (가)
- (나)
- (다)
- ⓐ
- ⓑ
- ⓒ
- 인용
- 각주

==================================================
MARKERS
==================================================

문제가 참조하는 지문 표식을 추출하세요.

kind:

section
underline
symbol
quoted
other

(가), (나)의 경우
해당 구간 전체 원문을 text에 넣으세요.

실제 페이지 이미지에 밑줄이 있으면
그 정확한 원문을 underline marker로 넣으세요.

==================================================
문제
==================================================

각 문제:

number
pageNumber
stem
bogi
choices
attachments

==================================================
BOGI
==================================================

순수 텍스트 <보기>:

bogi에 텍스트만 넣으세요.
attachment는 만들지 마세요.

표나 그림이 포함된 <보기>:

텍스트 설명은 bogi에,
실제 표나 그림은 attachment로 분리하세요.

표 자체의 셀 내용을
bogi에서 줄글로 반복하지 마세요.

==================================================
ATTACHMENTS
==================================================

실제 표/그래프/그림/도식이 있을 때만 만드세요.

bbox는 여기서 만들지 않습니다.

다음 정보만 반환하세요.

id
type
placement
pageNumber
description

==================================================
JSON
==================================================

{
  "groups": [
    {
      "id": "group-1",
      "title": "지문 제목",
      "source": "지문 원문",
      "markers": [],
      "questions": [
        {
          "number": "25",
          "pageNumber": 1,
          "stem": "발문",
          "bogi": "순수 텍스트 보기라면 여기",
          "choices": [
            "① ...",
            "② ...",
            "③ ...",
            "④ ...",
            "⑤ ..."
          ],
          "attachments": [
            {
              "id": "q25-table-1",
              "type": "table",
              "placement": "bogi",
              "pageNumber": 1,
              "description": "가구별 소득을 나타낸 표"
            }
          ]
        }
      ]
    }
  ]
}

반드시 JSON만 출력하세요.

==================================================
PDF TEXT
==================================================

${text}
`;

    const content: Array<
      | {
          type:
            "input_text";
          text: string;
        }
      | {
          type:
            "input_image";
          image_url: string;
          detail:
            | "low"
            | "high"
            | "auto";
        }
    > = [
      {
        type:
          "input_text",
        text: prompt,
      },
    ];

    for (
      const page of pageImages
    ) {
      content.push({
        type:
          "input_text",

        text:
          `PDF ${page.pageNumber}페이지`,
      });

      content.push({
        type:
          "input_image",

        image_url:
          page.imageUrl,

        detail:
          "high",
      });
    }

    const result =
      await openai.responses.create({
        model:
          "gpt-5-mini",

        input: [
          {
            role:
              "user",
            content,
          },
        ],
      });

    const output =
      result.output_text?.trim() ??
      "";

    if (!output) {
      throw new Error(
        "원본 문제 분석 결과가 비어 있습니다."
      );
    }

    const parsed =
      parseJsonOutput(
        output
      );

    const rawGroups: unknown[] =
      Array.isArray(
        parsed?.groups
      )
        ? parsed.groups
        : [];

    const groups: TwinPassageGroup[] =
      [];

    for (
      let groupIndex = 0;
      groupIndex <
      rawGroups.length;
      groupIndex++
    ) {
      const rawGroup =
        rawGroups[
          groupIndex
        ];

      const group =
        rawGroup &&
        typeof rawGroup ===
          "object"
          ? (rawGroup as Record<
              string,
              unknown
            >)
          : {};

      const rawMarkers: unknown[] =
        Array.isArray(
          group.markers
        )
          ? group.markers
          : [];

      const markers: PassageMarker[] =
        rawMarkers
          .map(
            (
              rawMarker: unknown
            ): PassageMarker => {
              const marker =
                rawMarker &&
                typeof rawMarker ===
                  "object"
                  ? (rawMarker as Record<
                      string,
                      unknown
                    >)
                  : {};

              const rawKind =
                cleanInline(
                  marker.kind
                );

              const allowedKinds: PassageMarker["kind"][] =
                [
                  "section",
                  "underline",
                  "symbol",
                  "quoted",
                  "other",
                ];

              const kind =
                allowedKinds.includes(
                  rawKind as PassageMarker["kind"]
                )
                  ? (rawKind as PassageMarker["kind"])
                  : "other";

              return {
                label:
                  cleanInline(
                    marker.label
                  ),

                text:
                  cleanBlock(
                    marker.text
                  ),

                kind,
              };
            }
          )
          .filter(
            (
              marker: PassageMarker
            ) =>
              Boolean(
                marker.label
              ) &&
              Boolean(
                marker.text
              )
          );

      const rawQuestions: unknown[] =
        Array.isArray(
          group.questions
        )
          ? group.questions
          : [];

      const questions: SourceQuestion[] =
        [];

      for (
        let questionIndex = 0;
        questionIndex <
        rawQuestions.length;
        questionIndex++
      ) {
        const rawQuestion =
          rawQuestions[
            questionIndex
          ];

        const question =
          rawQuestion &&
          typeof rawQuestion ===
            "object"
            ? (rawQuestion as Record<
                string,
                unknown
              >)
            : {};

        const number =
          cleanInline(
            question.number
          );

        let pageNumber =
          numberValue(
            question.pageNumber
          );

        if (
          pageNumber <= 0
        ) {
          pageNumber =
            findQuestionPage(
              number,
              pageTextData
            );
        }

        const rawChoices: unknown[] =
          Array.isArray(
            question.choices
          )
            ? question.choices
            : [];

        const rawAttachments: unknown[] =
          Array.isArray(
            question.attachments
          )
            ? question.attachments
            : [];

        const attachments: QuestionAttachment[] =
          [];

        for (
          let assetIndex = 0;
          assetIndex <
          rawAttachments.length;
          assetIndex++
        ) {
          const rawAsset =
            rawAttachments[
              assetIndex
            ];

          const asset =
            rawAsset &&
            typeof rawAsset ===
              "object"
              ? (rawAsset as Record<
                  string,
                  unknown
                >)
              : {};

          const rawType =
            cleanInline(
              asset.type
            );

          const allowedTypes: QuestionAttachment["type"][] =
            [
              "table",
              "graph",
              "diagram",
              "image",
              "chart",
              "other",
            ];

          const type =
            allowedTypes.includes(
              rawType as QuestionAttachment["type"]
            )
              ? (rawType as QuestionAttachment["type"])
              : "other";

          const rawPlacement =
            cleanInline(
              asset.placement
            );

          const allowedPlacements: QuestionAttachment["placement"][] =
            [
              "passage",
              "question",
              "bogi",
              "choice",
            ];

          const placement =
            allowedPlacements.includes(
              rawPlacement as QuestionAttachment["placement"]
            )
              ? (rawPlacement as QuestionAttachment["placement"])
              : "question";

          const assetPageNumber =
            numberValue(
              asset.pageNumber,
              pageNumber
            );

          const pageImage =
            pageImages.find(
              (
                item: PageImage
              ) =>
                item.pageNumber ===
                assetPageNumber
            );

          if (!pageImage) {
            continue;
          }

          const questionRegion =
            findQuestionRegion(
              number,
              assetPageNumber,
              pageTextData
            );

          const questionCrop =
            await cropNormalizedImage(
              pageImage.imageUrl,
              questionRegion,
              8
            );

          const visualBBox =
            await findVisualInsideQuestion({
              openai,
              questionCrop,
              questionNumber:
                number,
              type,
              placement,
              description:
                cleanInline(
                  asset.description
                ),
            });

          if (!visualBBox) {
            continue;
          }

          const finalImage =
            await cropNormalizedImage(
              questionCrop,
              visualBBox,
              14
            );

          attachments.push({
            id:
              cleanInline(
                asset.id
              ) ||
              `q${number}-asset-${assetIndex + 1}`,

            type,

            placement,

            pageNumber:
              assetPageNumber,

            description:
              cleanInline(
                asset.description
              ),

            imageUrl:
              finalImage,
          });
        }

        questions.push({
          number,

          pageNumber,

          stem:
            cleanBlock(
              question.stem
            ),

          bogi:
            cleanBlock(
              question.bogi
            ),

          choices:
            rawChoices
              .map(
                (
                  choice: unknown
                ) =>
                  cleanBlock(
                    choice
                  )
              )
              .filter(
                (
                  choice: string
                ) =>
                  Boolean(
                    choice
                  )
              ),

          attachments,
        });
      }

      const resultGroup: TwinPassageGroup =
        {
          id:
            cleanInline(
              group.id
            ) ||
            `group-${groupIndex + 1}`,

          title:
            cleanInline(
              group.title
            ) ||
            `비문학 지문 ${groupIndex + 1}`,

          source:
            cleanBlock(
              group.source
            ),

          markers,

          questions:
            questions.filter(
              (
                question: SourceQuestion
              ) =>
                Boolean(
                  question.number
                ) &&
                Boolean(
                  question.stem
                )
            ),
        };

      if (
        resultGroup.source
          .length >
          100 &&
        resultGroup.questions
          .length >
          0
      ) {
        groups.push(
          resultGroup
        );
      }
    }

    if (
      groups.length === 0
    ) {
      throw new Error(
        "지문과 원본 문제 세트를 찾지 못했습니다."
      );
    }

    return Response.json({
      groups,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "KOREAN TWIN ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류";

    return Response.json(
      {
        error: message,
        detail: message,
      },
      {
        status: 500,
      }
    );
  }
}