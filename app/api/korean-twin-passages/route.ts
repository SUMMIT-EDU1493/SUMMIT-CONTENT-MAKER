import OpenAI from "openai";

export const maxDuration = 300;

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
): BoundingBox | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const box =
    value as Record<string, unknown>;

  let x = numberValue(box.x);
  let y = numberValue(box.y);
  let width =
    numberValue(box.width);
  let height =
    numberValue(box.height);

  if (
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  x = clamp(x, 0, 1000);
  y = clamp(y, 0, 1000);

  width = clamp(
    width,
    1,
    1000 - x
  );

  height = clamp(
    height,
    1,
    1000 - y
  );

  return {
    x,
    y,
    width,
    height,
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

async function refineAttachmentBBox({
  openai,
  pageImage,
  questionNumber,
  attachmentType,
  placement,
  description,
}: {
  openai: OpenAI;
  pageImage: PageImage;
  questionNumber: string;
  attachmentType: QuestionAttachment["type"];
  placement: QuestionAttachment["placement"];
  description: string;
}): Promise<BoundingBox | null> {
  const prompt = `
당신은 대한민국 국어 모의고사 PDF의
"시각 자료 크롭 영역"만 매우 정밀하게 찾는 작업을 합니다.

아래 이미지는 시험지 한 페이지입니다.

찾아야 할 대상:

문항 번호: ${questionNumber}
자료 종류: ${attachmentType}
자료 위치: ${placement}
자료 설명: ${description}

==================================================
목표
==================================================

이 문제에 속한 시각 자료 하나만
정확히 잘라낼 수 있는 최소 크기의 사각형을 찾으십시오.

예:

- 표
- 그래프
- 도식
- 그림
- 사진
- 표 형태의 <보기>
- 그림이 들어간 <보기>
- 표 형태 선택지

==================================================
절대 포함하면 안 되는 것
==================================================

매우 중요합니다.

크롭 영역에 아래 내용이 딸려 들어오면 실패입니다.

- 바로 위 문항의 선택지
- 이전 문항
- 다음 문항
- 현재 문제의 발문
- 현재 문제의 일반 텍스트 선택지
- 페이지 번호
- 큰 빈 여백
- 다른 문제의 <보기>
- 다른 문제의 그림이나 표

==================================================
<보기> 자료
==================================================

placement가 bogi일 경우:

<보기> 안에 있는
표·그래프·그림·도식 자체만 찾으십시오.

단,

<보기>의 테두리 자체가 자료 구성에 반드시 필요하다면
그 테두리까지 포함할 수 있습니다.

그러나 보기 위의 발문이나
보기 아래의 선택지는 포함하지 마십시오.

==================================================
표
==================================================

표인 경우:

표의 가장 왼쪽 선부터
가장 오른쪽 선까지,

표의 가장 위쪽 선부터
가장 아래쪽 선까지

포함하십시오.

표의 맨 위 제목이나 단위 표시가
표 해석에 꼭 필요하면 포함하십시오.

그러나 문제 발문은 제외하십시오.

==================================================
그림 / 도식
==================================================

그림이나 도식은
그림의 모든 부분이 잘리지 않도록 하십시오.

위나 아래가 조금이라도 잘리면 안 됩니다.

==================================================
여백
==================================================

대상을 정확히 찾은 뒤
사방에 약간의 안전 여백만 포함하십시오.

권장:

좌우 약 8~15px 수준
위아래 약 8~15px 수준

너무 넓게 잡지 마십시오.

==================================================
좌표
==================================================

페이지 전체를 0~1000 좌표로 봅니다.

왼쪽 위:
x=0
y=0

오른쪽 아래:
x=1000
y=1000

반드시 JSON만 반환하십시오.

{
  "bbox": {
    "x": 100,
    "y": 300,
    "width": 600,
    "height": 250
  }
}

찾을 수 없으면:

{
  "bbox": null
}
`;

  const result =
    await openai.responses.create({
      model: "gpt-5-mini",

      input: [
        {
          role: "user",

          content: [
            {
              type: "input_text",
              text: prompt,
            },

            {
              type: "input_image",
              image_url:
                pageImage.imageUrl,
              detail: "high",
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

    return parseBBox(
      parsed?.bbox
    );
  } catch (error) {
    console.error(
      "BBOX REFINE ERROR:",
      error
    );

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
      body?.sourceText ??
      body?.content ??
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
            item: unknown
          ): PageImage => {
            const page =
              item &&
              typeof item ===
                "object"
                ? (item as Record<
                    string,
                    unknown
                  >)
                : {};

            return {
              pageNumber:
                numberValue(
                  page.pageNumber
                ),

              imageUrl:
                cleanInline(
                  page.imageUrl
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
당신은 대한민국 수능 및 전국연합학력평가
국어 시험지를 분석하는 전문 출제자입니다.

입력:

1. PDF 전체 텍스트
2. PDF 페이지 이미지

이번 단계에서는
비문학 지문과 해당 문제를 추출하고,
원본 시각 형식을 분석합니다.

새 문제는 절대 만들지 마십시오.

==================================================
비문학
==================================================

사회
경제
과학
기술
철학
인문
언어
독서
예술 이론
설명문
논설문

등을 우선합니다.

문학 작품은 기본적으로 제외합니다.

==================================================
SOURCE
==================================================

source에는 실제 지문 원문만 넣습니다.

다음은 삭제:

- 문제 번호
- 선택지
- 시험 안내
- 페이지 번호
- 인쇄 정보

다음은 보존:

- 문단
- (가)
- (나)
- (다)
- ⓐ
- ⓑ
- ⓒ
- 인용
- 각주
- 문제 풀이에 필요한 표식

지문을 요약하지 마십시오.

==================================================
MARKERS
==================================================

문제가 직접 참조하는 표시를 분석합니다.

kind:

section
underline
symbol
quoted
other

--------------------------------------------------
(가), (나)
--------------------------------------------------

(가)의 marker.text에는
(가) 시작부터 다음 구간 시작 직전까지의
실제 전체 원문을 넣습니다.

예:

{
  "label": "(가)",
  "text": "(가) 전체 범위 원문",
  "kind": "section"
}

--------------------------------------------------
밑줄
--------------------------------------------------

페이지 이미지에서 실제 밑줄이 확인되면
정확한 원문을 기록합니다.

{
  "label": "밑줄",
  "text": "실제로 밑줄 친 원문",
  "kind": "underline"
}

밑줄이 명확하지 않으면
만들어내지 마십시오.

--------------------------------------------------
ⓐ
--------------------------------------------------

{
  "label": "ⓐ",
  "text": "실제로 ⓐ가 표시된 표현",
  "kind": "symbol"
}

==================================================
QUESTIONS
==================================================

각 문제마다:

number
stem
bogi
choices
attachments

를 추출합니다.

==================================================
<보기>
==================================================

bogi에는
<보기>의 텍스트 본문만 넣습니다.

"<보기>"라는 제목은 넣지 않습니다.

표나 그림이 보기 안에 있으면
그 자료를 줄글로 풀지 마십시오.

==================================================
ATTACHMENTS
==================================================

다음 자료가 실제 페이지 이미지에 있으면
attachments에 기록합니다.

- table
- graph
- diagram
- image
- chart
- other

placement:

passage
question
bogi
choice

중요:

이 첫 분석에서는
bbox를 대략적으로 넣어도 됩니다.

뒤 단계에서 별도로
정밀 크롭 위치를 다시 찾습니다.

==================================================
절대 금지
==================================================

시각 자료를 줄글로 대신 쓰지 마십시오.

예를 들어 원본이 표라면:

A 10 20 B 30 40

처럼 줄글로 변환해서
그것만 남기면 안 됩니다.

반드시 attachment도 함께 생성합니다.

==================================================
JSON
==================================================

반드시 아래 구조로만 반환합니다.

{
  "groups": [
    {
      "id": "group-1",
      "title": "지문 제목",
      "source": "지문 원문",
      "markers": [
        {
          "label": "(가)",
          "text": "(가)의 실제 전체 범위",
          "kind": "section"
        }
      ],
      "questions": [
        {
          "number": "24",
          "stem": "발문",
          "bogi": "보기 본문",
          "choices": [
            "① 선택지",
            "② 선택지",
            "③ 선택지",
            "④ 선택지",
            "⑤ 선택지"
          ],
          "attachments": [
            {
              "id": "q24-table-1",
              "type": "table",
              "placement": "bogi",
              "pageNumber": 1,
              "bbox": null,
              "description": "보기 안의 표"
            }
          ]
        }
      ]
    }
  ]
}

JSON 밖의 설명은 절대 하지 마십시오.

==================================================
PDF TEXT
==================================================

${text}
`;

    const content: Array<
      | {
          type: "input_text";
          text: string;
        }
      | {
          type: "input_image";
          image_url: string;
          detail:
            | "auto"
            | "low"
            | "high";
        }
    > = [
      {
        type: "input_text",
        text: prompt,
      },
    ];

    for (
      const pageImage of pageImages
    ) {
      content.push({
        type: "input_text",

        text:
          `시험지 PDF ${pageImage.pageNumber}페이지입니다.`,
      });

      content.push({
        type: "input_image",

        image_url:
          pageImage.imageUrl,

        detail: "high",
      });
    }

    const result =
      await openai.responses.create({
        model: "gpt-5-mini",

        input: [
          {
            role: "user",
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

    let parsed: unknown;

    try {
      parsed =
        parseJsonOutput(
          output
        );
    } catch {
      throw new Error(
        "원본 문제 분석 결과를 JSON으로 읽지 못했습니다."
      );
    }

    const parsedObject =
      parsed &&
      typeof parsed ===
        "object"
        ? (parsed as Record<
            string,
            unknown
          >)
        : {};

    const rawGroups: unknown[] =
      Array.isArray(
        parsedObject.groups
      )
        ? parsedObject.groups
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

        const questionNumber =
          cleanInline(
            question.number
          );

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
          let attachmentIndex = 0;
          attachmentIndex <
          rawAttachments.length;
          attachmentIndex++
        ) {
          const rawAttachment =
            rawAttachments[
              attachmentIndex
            ];

          const attachment =
            rawAttachment &&
            typeof rawAttachment ===
              "object"
              ? (rawAttachment as Record<
                  string,
                  unknown
                >)
              : {};

          const rawType =
            cleanInline(
              attachment.type
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
              attachment.placement
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

          const pageNumber =
            numberValue(
              attachment.pageNumber
            );

          const description =
            cleanInline(
              attachment.description
            );

          let refinedBBox:
            BoundingBox | null =
            null;

          const pageImage =
            pageImages.find(
              (
                page: PageImage
              ) =>
                page.pageNumber ===
                pageNumber
            );

          if (
            pageImage &&
            questionNumber
          ) {
            refinedBBox =
              await refineAttachmentBBox({
                openai,
                pageImage,
                questionNumber,
                attachmentType:
                  type,
                placement,
                description,
              });
          }

          attachments.push({
            id:
              cleanInline(
                attachment.id
              ) ||
              `q${questionNumber || questionIndex + 1}-asset-${attachmentIndex + 1}`,

            type,

            placement,

            pageNumber,

            bbox:
              refinedBBox,

            description,
          });
        }

        questions.push({
          number:
            questionNumber,

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

          attachments:
            attachments.filter(
              (
                attachment: QuestionAttachment
              ) =>
                attachment.pageNumber >
                  0 &&
                Boolean(
                  attachment.bbox
                )
            ),
        });
      }

      const cleanGroup: TwinPassageGroup =
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
        cleanGroup.source
          .length > 100 &&
        cleanGroup.questions
          .length > 0
      ) {
        groups.push(
          cleanGroup
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

    const questionCount =
      groups.reduce(
        (
          sum: number,
          group: TwinPassageGroup
        ) =>
          sum +
          group.questions.length,
        0
      );

    const assetCount =
      groups.reduce(
        (
          total: number,
          group: TwinPassageGroup
        ) =>
          total +
          group.questions.reduce(
            (
              questionTotal: number,
              question: SourceQuestion
            ) =>
              questionTotal +
              question.attachments
                .length,
            0
          ),
        0
      );

    return Response.json({
      groups,

      stats: {
        groupCount:
          groups.length,

        questionCount,

        assetCount,
      },
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "KOREAN TWIN PASSAGES ERROR:",
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