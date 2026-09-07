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
    value as Record<
      string,
      unknown
    >;

  const x =
    numberValue(box.x);

  const y =
    numberValue(box.y);

  const width =
    numberValue(box.width);

  const height =
    numberValue(box.height);

  if (
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return {
    x: Math.max(
      0,
      Math.min(1000, x)
    ),

    y: Math.max(
      0,
      Math.min(1000, y)
    ),

    width: Math.max(
      1,
      Math.min(1000, width)
    ),

    height: Math.max(
      1,
      Math.min(1000, height)
    ),
  };
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

    /*
    ==================================================
    TEXT
    ==================================================
    */

    const rawText =
      body?.text ??
      body?.pdfText ??
      body?.sourceText ??
      body?.content ??
      "";

    const text =
      typeof rawText === "string"
        ? rawText.trim()
        : "";

    /*
    ==================================================
    PAGE IMAGES
    ==================================================
    */

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

    console.log(
      "TWIN TEXT LENGTH:",
      text.length
    );

    console.log(
      "TWIN PAGE IMAGES:",
      pageImages.length
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

    /*
    ==================================================
    PROMPT
    ==================================================
    */

    const prompt = `
당신은 대한민국 수능 및 전국연합학력평가
국어 시험지의 문제 내용과 편집 형식을 함께 분석하는
전문 국어 출제자입니다.

입력 자료는 두 종류입니다.

1. PDF에서 추출한 시험지 전체 텍스트
2. 실제 시험지 PDF 각 페이지의 이미지

반드시 둘을 함께 사용하십시오.

이 작업의 목적은
쌍둥이 문제 제작 전에

"원본 모의고사의 내용 구조와 시각 형식을
정확하게 보존한 데이터"

를 만드는 것입니다.

새 문제는 절대로 만들지 마십시오.

==================================================
가장 중요한 원칙
==================================================

PDF 텍스트 추출 과정에서는 다음 정보가
사라질 수 있습니다.

- 밑줄
- 표
- 그래프
- 도식
- 그림
- <보기> 박스
- 표 형태의 선택지
- (가), (나)의 시각적 범위
- ⓐ, ⓑ 등의 실제 강조
- 문단 및 여백 구조

이러한 정보는 반드시
함께 제공된 실제 페이지 이미지를 확인해서
판단하십시오.

텍스트만 보고 존재하지 않는 형식을
임의로 추측하지 마십시오.

==================================================
비문학 지문
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

등의 독립적인 비문학 지문을 추출하십시오.

각 지문에 딸린 문제를 정확하게 연결하십시오.

문학은 비문학이 충분히 존재하는 경우
기본적으로 제외합니다.

==================================================
SOURCE
==================================================

source에는 실제 지문 원문을 넣습니다.

삭제:

- 문제 번호
- 선택지
- 시험 안내문
- 페이지 번호
- 머리말
- 인쇄 정보

보존:

- 문단 구분
- (가)
- (나)
- (다)
- ⓐ
- ⓑ
- ⓒ
- 인용
- 각주
- 문제 풀이에 필요한 표식

문단 사이는 가능하면
\\n\\n 으로 구분하십시오.

원문을 요약하거나 바꾸지 마십시오.

==================================================
MARKERS
==================================================

문제가 직접 참조하는 지문 표시를
markers에 기록합니다.

kind:

section
underline
symbol
quoted
other

--------------------------------------------------
SECTION
--------------------------------------------------

(가), (나), (다)처럼
지문의 일정 범위를 가리키는 경우입니다.

예를 들어

(가) 첫 문장
두 번째 문장
세 번째 문장

(나) 첫 문장

이라면

(가)의 marker.text에는
(가) 시작부터 (나) 직전까지의
실제 전체 원문을 넣으십시오.

단순히 "(가)"만 넣으면 안 됩니다.

예:

{
  "label": "(가)",
  "text": "(가) 첫 문장 ... 마지막 문장",
  "kind": "section"
}

--------------------------------------------------
UNDERLINE
--------------------------------------------------

실제 페이지 이미지에서 밑줄이 확인되는
어절, 구, 문장의 정확한 원문을 기록합니다.

{
  "label": "밑줄",
  "text": "실제로 밑줄 친 정확한 표현",
  "kind": "underline"
}

밑줄이 이미지에서 보이지 않는다면
억지로 만들어내지 마십시오.

--------------------------------------------------
SYMBOL
--------------------------------------------------

ⓐ, ⓑ 등의 기호가 특정 표현을
가리키는 경우:

{
  "label": "ⓐ",
  "text": "실제로 ⓐ가 표시된 표현",
  "kind": "symbol"
}

==================================================
표 / 그래프 / 도식 / 그림
==================================================

원본 페이지 이미지에서 다음 자료가 보이면
줄글로 풀지 마십시오.

- 표
- 그래프
- 차트
- 도식
- 그림
- 좌표
- 데이터 박스
- 표 형태의 <보기>
- 표 형태의 선택지

해당 시각자료는 attachments에 넣습니다.

==================================================
BBOX
==================================================

시각자료의 위치는
페이지 전체를 기준으로

왼쪽 위:
x=0
y=0

오른쪽 아래:
x=1000
y=1000

좌표계로 반환하십시오.

예:

{
  "x": 180,
  "y": 420,
  "width": 580,
  "height": 220
}

중요:

bbox에는 가능하면
시각자료 자체만 포함하십시오.

다른 문제의 번호나 발문,
선택지까지 함께 들어가지 않도록 합니다.

==================================================
PLACEMENT
==================================================

attachment가 위치하는 영역도 판단합니다.

passage
- 지문 속 자료

question
- 발문과 연결된 자료

bogi
- <보기> 내부 자료

choice
- 선택지 자체가 표나 그림인 경우

==================================================
<보기>
==================================================

<보기>의 본문은 bogi에 넣습니다.

bogi에는 "<보기>"라는 제목을
반복해서 넣지 마십시오.

보기의 문단과 줄바꿈은
가능하면 보존하십시오.

<보기> 안에 표/그래프/도식이 있다면
그 부분을 줄글로 변환하지 말고
attachment로 분리합니다.

==================================================
QUESTIONS
==================================================

questions에는 원문의 문제를
번호 순서대로 넣습니다.

number
- 문제 번호

stem
- 발문 전체

bogi
- 보기 본문
- 없으면 ""

choices
- 텍스트형 선택지

attachments
- 표/그래프/도식/이미지 등의 원본 시각자료

정답은 추측하지 마십시오.

==================================================
CHOICES
==================================================

원본 기호를 그대로 유지합니다.

① ...
② ...
③ ...
④ ...
⑤ ...

선택지 자체가 복잡한 표라면
억지로 텍스트로 바꾸지 않고
placement="choice" attachment로 기록할 수 있습니다.

==================================================
JSON
==================================================

반드시 JSON만 출력하십시오.

{
  "groups": [
    {
      "id": "group-1",
      "title": "짧은 지문 제목",
      "source": "실제 지문 원문",
      "markers": [
        {
          "label": "(가)",
          "text": "(가)의 전체 원문 범위",
          "kind": "section"
        },
        {
          "label": "밑줄",
          "text": "실제로 밑줄 친 표현",
          "kind": "underline"
        }
      ],
      "questions": [
        {
          "number": "24",
          "stem": "원문 발문",
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
              "bbox": {
                "x": 100,
                "y": 400,
                "width": 700,
                "height": 250
              },
              "description": "보기 안의 원본 표"
            }
          ]
        }
      ]
    }
  ]
}

JSON 밖의 설명은 절대 쓰지 마십시오.

==================================================
PDF TEXT
==================================================

${text}
`;

    /*
    ==================================================
    MULTIMODAL CONTENT

    중요:
    input_image에는 detail이 필수
    ==================================================
    */

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
          `다음 이미지는 시험지 PDF ${pageImage.pageNumber}페이지입니다.`,
      });

      content.push({
        type: "input_image",

        image_url:
          pageImage.imageUrl,

        /*
        밑줄 / 표 / 도식 / 작은 기호까지
        봐야 하므로 high
        */
        detail: "high",
      });
    }

    /*
    ==================================================
    OPENAI
    ==================================================
    */

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

    /*
    ==================================================
    JSON CLEAN
    ==================================================
    */

    const cleanedOutput =
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

    let parsed: unknown;

    try {
      parsed =
        JSON.parse(
          cleanedOutput
        );
    } catch {
      console.error(
        "TWIN JSON:",
        cleanedOutput
      );

      throw new Error(
        "원본 문제 분석 결과를 JSON으로 읽지 못했습니다."
      );
    }

    /*
    ==================================================
    PARSED ROOT
    ==================================================
    */

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

    /*
    ==================================================
    GROUPS
    ==================================================
    */

    const groups: TwinPassageGroup[] =
      rawGroups
        .map(
          (
            rawGroup: unknown,
            groupIndex: number
          ): TwinPassageGroup => {
            const group =
              rawGroup &&
              typeof rawGroup ===
                "object"
                ? (rawGroup as Record<
                    string,
                    unknown
                  >)
                : {};

            /*
            ==========================================
            MARKERS
            ==========================================
            */

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

                    const kind:
                      PassageMarker["kind"] =
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

            /*
            ==========================================
            QUESTIONS
            ==========================================
            */

            const rawQuestions: unknown[] =
              Array.isArray(
                group.questions
              )
                ? group.questions
                : [];

            const questions: SourceQuestion[] =
              rawQuestions
                .map(
                  (
                    rawQuestion: unknown,
                    questionIndex: number
                  ): SourceQuestion => {
                    const question =
                      rawQuestion &&
                      typeof rawQuestion ===
                        "object"
                        ? (rawQuestion as Record<
                            string,
                            unknown
                          >)
                        : {};

                    /*
                    CHOICES
                    */

                    const rawChoices: unknown[] =
                      Array.isArray(
                        question.choices
                      )
                        ? question.choices
                        : [];

                    /*
                    ATTACHMENTS
                    */

                    const rawAttachments: unknown[] =
                      Array.isArray(
                        question.attachments
                      )
                        ? question.attachments
                        : [];

                    const attachments: QuestionAttachment[] =
                      rawAttachments
                        .map(
                          (
                            rawAttachment: unknown,
                            attachmentIndex: number
                          ): QuestionAttachment => {
                            const attachment =
                              rawAttachment &&
                              typeof rawAttachment ===
                                "object"
                                ? (rawAttachment as Record<
                                    string,
                                    unknown
                                  >)
                                : {};

                            /*
                            TYPE
                            */

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

                            const type:
                              QuestionAttachment["type"] =
                              allowedTypes.includes(
                                rawType as QuestionAttachment["type"]
                              )
                                ? (rawType as QuestionAttachment["type"])
                                : "other";

                            /*
                            PLACEMENT
                            */

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

                            const placement:
                              QuestionAttachment["placement"] =
                              allowedPlacements.includes(
                                rawPlacement as QuestionAttachment["placement"]
                              )
                                ? (rawPlacement as QuestionAttachment["placement"])
                                : "question";

                            return {
                              id:
                                cleanInline(
                                  attachment.id
                                ) ||
                                `q${questionIndex + 1}-asset-${attachmentIndex + 1}`,

                              type,

                              placement,

                              pageNumber:
                                numberValue(
                                  attachment.pageNumber
                                ),

                              bbox:
                                parseBBox(
                                  attachment.bbox
                                ),

                              description:
                                cleanInline(
                                  attachment.description
                                ),
                            };
                          }
                        )
                        .filter(
                          (
                            attachment: QuestionAttachment
                          ) =>
                            attachment.pageNumber >
                              0 &&
                            Boolean(
                              attachment.bbox
                            )
                        );

                    return {
                      number:
                        cleanInline(
                          question.number
                        ),

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
                    };
                  }
                )
                .filter(
                  (
                    question: SourceQuestion
                  ) =>
                    Boolean(
                      question.number
                    ) &&
                    Boolean(
                      question.stem
                    )
                );

            return {
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

              questions,
            };
          }
        )
        .filter(
          (
            group: TwinPassageGroup
          ) =>
            group.source.length >
              100 &&
            group.questions.length >
              0
        );

    /*
    ==================================================
    VALIDATE
    ==================================================
    */

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

    const markerCount =
      groups.reduce(
        (
          sum: number,
          group: TwinPassageGroup
        ) =>
          sum +
          group.markers.length,
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
              question.attachments.length,
            0
          ),
        0
      );

    console.log(
      "TWIN GROUP COUNT:",
      groups.length
    );

    console.log(
      "TWIN QUESTION COUNT:",
      questionCount
    );

    console.log(
      "TWIN MARKER COUNT:",
      markerCount
    );

    console.log(
      "TWIN ASSET COUNT:",
      assetCount
    );

    /*
    ==================================================
    RESPONSE
    ==================================================
    */

    return Response.json({
      groups,

      stats: {
        groupCount:
          groups.length,

        questionCount,

        markerCount,

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
        error:
          message ||
          "쌍둥이 문제 원본 분석 중 오류가 발생했습니다.",

        detail:
          message,
      },
      {
        status: 500,
      }
    );
  }
}