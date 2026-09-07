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

type DetectedVisual = {
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
  description: string;
  bbox: NormalizedBBox;
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

function cleanBogi(value: unknown) {
  return cleanBlock(value)
    .replace(
      /\(\s*(그림|표|도표|그래프|도식|이미지)\s*(첨부|참조|삽입)\s*\)/gi,
      ""
    )
    .replace(
      /\[\s*(그림|표|도표|그래프|도식|이미지)\s*(첨부|참조|삽입)\s*\]/gi,
      ""
    )
    .replace(
      /(그림|표|도표|그래프|도식|이미지)\s*(첨부|참조|삽입)/gi,
      ""
    )
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

  let x =
    numberValue(raw.x);

  let y =
    numberValue(raw.y);

  let width =
    numberValue(raw.width);

  let height =
    numberValue(raw.height);

  if (
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  x = clamp(
    x,
    0,
    999
  );

  y = clamp(
    y,
    0,
    999
  );

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

  return JSON.parse(
    cleaned
  );
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

  return Buffer.from(
    dataUrl.slice(
      commaIndex + 1
    ),
    "base64"
  );
}

function bufferToDataUrl(
  buffer: Buffer
) {
  return `data:image/jpeg;base64,${buffer.toString(
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

  left =
    Math.max(
      0,
      left - padding
    );

  top =
    Math.max(
      0,
      top - padding
    );

  width =
    Math.min(
      imageWidth - left,
      width +
        padding * 2
    );

  height =
    Math.min(
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
        quality: 95,
      })
      .toBuffer();

  return bufferToDataUrl(
    output
  );
}

function normalizeQuestionText(
  value: string
) {
  return value
    .replace(/\s+/g, "")
    .replace(/[．。]/g, ".")
    .trim();
}

function isQuestionNumberText(
  text: string,
  questionNumber: string
) {
  const normalized =
    normalizeQuestionText(
      text
    );

  const escaped =
    questionNumber.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  return new RegExp(
    `^${escaped}[.)]?$`
  ).test(
    normalized
  );
}

function detectQuestionNumber(
  text: string
) {
  const normalized =
    normalizeQuestionText(
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

function findQuestionPage(
  questionNumber: string,
  pageTextData: PageTextData[]
) {
  for (
    const page of pageTextData
  ) {
    const found =
      page.items.some(
        (
          item: PageTextItem
        ) =>
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
      (
        item: PageTextData
      ) =>
        item.pageNumber ===
        pageNumber
    );

  if (
    !page ||
    page.items.length === 0
  ) {
    return {
      x: 20,
      y: 0,
      width: 960,
      height: 1000,
    };
  }

  const currentNumber =
    Number(
      questionNumber
    );

  const questionNumberItems =
    page.items
      .map(
        (
          item: PageTextItem
        ) => ({
          ...item,
          detectedNumber:
            detectQuestionNumber(
              item.text
            ),
        })
      )
      .filter(
        (
          item
        ) =>
          item.detectedNumber !==
          null
      )
      .sort(
        (
          a,
          b
        ) =>
          a.y - b.y
      );

  const current =
    questionNumberItems.find(
      (
        item
      ) =>
        item.detectedNumber ===
        currentNumber
    );

  if (!current) {
    return {
      x: 20,
      y: 0,
      width: 960,
      height: 1000,
    };
  }

  const next =
    questionNumberItems.find(
      (
        item
      ) =>
        item.y >
          current.y + 15 &&
        Number(
          item.detectedNumber
        ) >
          currentNumber
    );

  const startY =
    clamp(
      current.y - 12,
      0,
      980
    );

  const endY =
    next
      ? clamp(
          next.y - 15,
          startY + 80,
          1000
        )
      : 1000;

  return {
    x: 15,
    y: startY,
    width: 970,
    height:
      endY -
      startY,
  };
}

async function detectVisualsInQuestion({
  openai,
  questionCrop,
  questionNumber,
}: {
  openai: OpenAI;
  questionCrop: string;
  questionNumber: string;
}): Promise<
  DetectedVisual[]
> {
  const prompt = `
당신은 대한민국 국어 모의고사 시험지에서
"실제 시각 자료"만 찾는 전문가입니다.

현재 이미지는 ${questionNumber}번 문항 영역만 잘라낸 것입니다.

이 문항 안에 실제로 존재하는 시각 자료를 모두 찾으세요.

==================================================
반드시 찾아야 하는 것
==================================================

- 표
- 그래프
- 차트
- 그림
- 삽화
- 사진
- 도식
- 좌표 그림
- 물체 배치 그림
- 표 형태의 선택지
- 그림이나 표가 포함된 <보기>

==================================================
시각 자료가 아닌 것
==================================================

아래는 절대 시각 자료로 판단하지 마세요.

- 문제 번호
- 발문
- 일반 문장
- 순수 텍스트 <보기>
- ①~⑤ 일반 텍스트 선택지
- <보기> 위아래의 가로선만 있는 경우
- 단순 밑줄
- 문장 강조
- 괄호
- 기호
- 문제의 빈 여백

==================================================
매우 중요
==================================================

1. 1차 분석 결과에 시각 자료 표시가 없어도
   실제 이미지에 보이면 반드시 찾아야 합니다.

2. "그림 첨부", "표 첨부" 같은 글자가 아니라
   실제 그림이나 표를 찾아야 합니다.

3. 시각 자료 위쪽이나 아래쪽의
   문제 발문·선택지를 포함하지 마세요.

4. 표라면 표 전체가 들어가야 합니다.

5. 그림이라면 그림 전체가 들어가야 합니다.

6. 위아래가 조금이라도 잘리지 않도록
   시각 자료 외곽보다 아주 조금 넓게 잡으세요.

7. 지나치게 큰 여백은 포함하지 마세요.

==================================================
PLACEMENT
==================================================

자료 위치는 다음 중 하나입니다.

question
- 발문 바로 아래 독립 자료

bogi
- <보기> 안의 자료

choice
- 선택지 자체가 표/그림 형식

passage
- 지문에 포함된 자료

==================================================
좌표
==================================================

현재 문항 이미지 전체를 0~1000 좌표로 봅니다.

왼쪽 위:
x=0
y=0

오른쪽 아래:
x=1000
y=1000

==================================================
출력
==================================================

시각 자료가 하나 있다면:

{
  "visuals": [
    {
      "type": "image",
      "placement": "bogi",
      "description": "바위, 양, 나무의 배치를 보여 주는 그림",
      "bbox": {
        "x": 200,
        "y": 250,
        "width": 600,
        "height": 220
      }
    }
  ]
}

표가 있다면 type은 "table".

여러 개라면 visuals 배열에 각각 넣으세요.

실제 시각 자료가 하나도 없다면:

{
  "visuals": []
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
    return [];
  }

  try {
    const parsed =
      parseJsonOutput(
        output
      );

    const rawVisuals: unknown[] =
      Array.isArray(
        parsed?.visuals
      )
        ? parsed.visuals
        : [];

    return rawVisuals
      .map(
        (
          raw: unknown
        ): DetectedVisual | null => {
          if (
            !raw ||
            typeof raw !==
              "object"
          ) {
            return null;
          }

          const item =
            raw as Record<
              string,
              unknown
            >;

          const rawType =
            cleanInline(
              item.type
            );

          const allowedTypes: DetectedVisual["type"][] =
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
              rawType as DetectedVisual["type"]
            )
              ? (rawType as DetectedVisual["type"])
              : "other";

          const rawPlacement =
            cleanInline(
              item.placement
            );

          const allowedPlacements: DetectedVisual["placement"][] =
            [
              "passage",
              "question",
              "bogi",
              "choice",
            ];

          const placement =
            allowedPlacements.includes(
              rawPlacement as DetectedVisual["placement"]
            )
              ? (rawPlacement as DetectedVisual["placement"])
              : "question";

          const bbox =
            parseBBox(
              item.bbox
            );

          if (!bbox) {
            return null;
          }

          return {
            type,
            placement,
            description:
              cleanInline(
                item.description
              ) ||
              "원본 시각 자료",
            bbox,
          };
        }
      )
      .filter(
        (
          item
        ): item is DetectedVisual =>
          item !== null
      );
  } catch {
    return [];
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
      rawPageTextData
        .map(
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
        )
        .filter(
          (
            page: PageTextData
          ) =>
            page.pageNumber >
            0
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
      pageImages.length ===
      0
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
당신은 대한민국 고등학교 국어 모의고사 분석 전문가입니다.

아래에는

1. PDF에서 추출한 시험지 전체 텍스트
2. 실제 시험지 페이지 이미지

가 함께 제공됩니다.

이번 단계에서는 비문학 지문과
그 지문에 딸린 원본 문제의 텍스트 구조만
정확히 추출하세요.

새 문제는 만들지 마세요.

==================================================
비문학 우선
==================================================

- 사회
- 경제
- 과학
- 기술
- 철학
- 인문
- 언어
- 독서
- 예술 이론
- 설명문
- 논설문

문학은 비문학이 충분히 있으면 제외하세요.

==================================================
SOURCE
==================================================

source에는 실제 지문만 넣습니다.

제거:

- 문제 번호
- 발문
- 선택지
- 시험 안내
- 페이지 번호
- 인쇄 정보

보존:

- 문단
- (가)
- (나)
- (다)
- ⓐ
- ⓑ
- ⓒ
- 인용
- 각주

원문을 요약하거나 바꾸지 마세요.

==================================================
MARKERS
==================================================

문제가 참조하는 지문 표식을 추출합니다.

kind:

section
underline
symbol
quoted
other

(가), (나)의 경우
해당 구간 전체 원문을 text에 넣으세요.

실제 페이지 이미지에서 밑줄이 확인되면
정확한 밑줄 원문을 넣으세요.

==================================================
QUESTIONS
==================================================

각 문제:

number
pageNumber
stem
bogi
choices

를 추출합니다.

==================================================
<보기>
==================================================

순수 텍스트 <보기>는
본문을 bogi에 넣습니다.

"<보기>" 제목 자체는 넣지 않습니다.

실제 그림이나 표가 있는 경우에도
"그림 첨부", "표 첨부" 등의 가짜 설명 문구를
bogi에 넣지 마세요.

그림이나 표 안의 내용을
억지로 줄글로 변환하지 마세요.

실제 시각 자료는 다음 단계에서
각 문항 이미지를 직접 검사해 별도로 가져옵니다.

==================================================
CHOICES
==================================================

①~⑤ 기호를 유지합니다.

일반 텍스트 선택지만 choices에 넣습니다.

==================================================
JSON
==================================================

{
  "groups": [
    {
      "id": "group-1",
      "title": "짧은 지문 제목",
      "source": "지문 원문",
      "markers": [],
      "questions": [
        {
          "number": "25",
          "pageNumber": 1,
          "stem": "문제 발문",
          "bogi": "보기 본문",
          "choices": [
            "① ...",
            "② ...",
            "③ ...",
            "④ ...",
            "⑤ ..."
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
        text:
          prompt,
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

        if (!number) {
          continue;
        }

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

        const choices =
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
            );

        const attachments: QuestionAttachment[] =
          [];

        const pageImage =
          pageImages.find(
            (
              page: PageImage
            ) =>
              page.pageNumber ===
              pageNumber
          );

        if (pageImage) {
          const questionRegion =
            findQuestionRegion(
              number,
              pageNumber,
              pageTextData
            );

          const questionCrop =
            await cropNormalizedImage(
              pageImage.imageUrl,
              questionRegion,
              10
            );

          const detectedVisuals =
            await detectVisualsInQuestion({
              openai,
              questionCrop,
              questionNumber:
                number,
            });

          for (
            let visualIndex =
              0;
            visualIndex <
            detectedVisuals.length;
            visualIndex++
          ) {
            const visual =
              detectedVisuals[
                visualIndex
              ];

            try {
              const imageUrl =
                await cropNormalizedImage(
                  questionCrop,
                  visual.bbox,
                  20
                );

              attachments.push({
                id:
                  `q${number}-visual-${visualIndex + 1}`,

                type:
                  visual.type,

                placement:
                  visual.placement,

                pageNumber,

                description:
                  visual.description,

                imageUrl,
              });
            } catch {
              //
            }
          }
        }

        questions.push({
          number,

          pageNumber,

          stem:
            cleanBlock(
              question.stem
            ),

          bogi:
            cleanBogi(
              question.bogi
            ),

          choices,

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
      groups.length ===
      0
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
        error:
          message,

        detail:
          message,
      },
      {
        status: 500,
      }
    );
  }
}