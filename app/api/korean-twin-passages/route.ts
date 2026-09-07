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

type VisualType =
  | "table"
  | "graph"
  | "diagram"
  | "image"
  | "chart"
  | "other";

type VisualPlacement =
  | "passage"
  | "question"
  | "bogi"
  | "choice";

type QuestionAttachment = {
  id: string;
  type: VisualType;
  placement: VisualPlacement;
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
  type: VisualType;
  placement: VisualPlacement;
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
      (bbox.width / 1000) *
        imageWidth
    );

  let height =
    Math.round(
      (bbox.height / 1000) *
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
        quality: 96,
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
      x: 10,
      y: 0,
      width: 980,
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
      x: 10,
      y: 0,
      width: 980,
      height: 1000,
    };
  }

  const next =
    questionNumberItems.find(
      (
        item
      ) =>
        item.y >
          current.y + 12 &&
        Number(
          item.detectedNumber
        ) >
          currentNumber
    );

  const startY =
    clamp(
      current.y - 10,
      0,
      980
    );

  const endY =
    next
      ? clamp(
          next.y - 8,
          startY + 100,
          1000
        )
      : 1000;

  return {
    x: 10,
    y: startY,
    width: 980,
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
이 이미지는 대한민국 국어 모의고사의
${questionNumber}번 문항 영역입니다.

이 문항 안에서 실제 시각 자료만 모두 찾으세요.

==================================================
시각 자료
==================================================

- 표
- 그래프
- 차트
- 그림
- 삽화
- 사진
- 도식
- 좌표 그림
- 사물 배치 그림
- 표 형태 선택지
- 그림/표가 포함된 <보기>

==================================================
시각 자료가 아님
==================================================

- 문제 번호
- 발문
- 일반 문장
- 순수 텍스트 <보기>
- 일반 선택지
- 밑줄
- <보기>의 가로선만 있는 경우
- 문장 강조

==================================================
중요
==================================================

표 안의 글자가 많아도 표입니다.

표를 단순 텍스트라고 판단하면 안 됩니다.

가로선과 세로선으로
행과 열이 나뉘어 있으면 반드시 표입니다.

그림과 표가 한 문제에 둘 다 있으면
둘을 각각 별개의 visual로 반환하세요.

==================================================
PLACEMENT
==================================================

question
bogi
choice
passage

중 하나로 반환하세요.

==================================================
좌표
==================================================

현재 문항 이미지 전체가
0~1000 좌표입니다.

시각 자료의 대략적인 위치를 반환하세요.

너무 좁게 잡지 말고
자료 전체가 들어가도록 약간 넉넉히 잡으세요.

==================================================
JSON
==================================================

{
  "visuals": [
    {
      "type": "image",
      "placement": "bogi",
      "description": "바위, 양, 나무 그림",
      "bbox": {
        "x": 150,
        "y": 220,
        "width": 700,
        "height": 250
      }
    },
    {
      "type": "table",
      "placement": "bogi",
      "description": "㉠과 ㉡에 대한 답을 정리한 표",
      "bbox": {
        "x": 160,
        "y": 520,
        "width": 680,
        "height": 370
      }
    }
  ]
}

없으면:

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
          role:
            "user",

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

          const allowedTypes: VisualType[] =
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
              rawType as VisualType
            )
              ? (rawType as VisualType)
              : "other";

          const rawPlacement =
            cleanInline(
              item.placement
            );

          const allowedPlacements: VisualPlacement[] =
            [
              "passage",
              "question",
              "bogi",
              "choice",
            ];

          const placement =
            allowedPlacements.includes(
              rawPlacement as VisualPlacement
            )
              ? (rawPlacement as VisualPlacement)
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

async function refineVisualBBox({
  openai,
  questionCrop,
  questionNumber,
  visual,
}: {
  openai: OpenAI;
  questionCrop: string;
  questionNumber: string;
  visual: DetectedVisual;
}): Promise<
  NormalizedBBox
> {
  const prompt = `
이 이미지는 국어 모의고사 ${questionNumber}번
문항 전체 영역입니다.

아래 시각 자료를 최종적으로
정확히 크롭하려고 합니다.

종류:
${visual.type}

위치:
${visual.placement}

설명:
${visual.description}

현재 대략적인 위치:

x=${visual.bbox.x}
y=${visual.bbox.y}
width=${visual.bbox.width}
height=${visual.bbox.height}

==================================================
목표
==================================================

시각 자료의 최종 경계를 다시 정확히 찾으세요.

이번 단계에서는
"시각 자료 전체가 안 잘리는 것"이 가장 중요합니다.

==================================================
표일 경우
==================================================

반드시 포함:

- 표의 맨 위
- 표의 맨 아래
- 표의 왼쪽
- 표의 오른쪽
- 모든 행
- 모든 열
- 모든 셀
- ①~⑤ 또는 ㄱ~ㅁ 등 표 내부 항목
- 표와 직접 붙어 있는 단위
- 표 자체의 제목

절대 표의 마지막 행이 잘리면 안 됩니다.

절대 표의 첫 행이 잘리면 안 됩니다.

==================================================
그림일 경우
==================================================

반드시 그림 전체를 포함합니다.

예:

늑대
바위
양
나무

가 하나의 그림을 구성한다면
어느 하나도 잘리면 안 됩니다.

그림 아래의 직접적인 명칭도
그림 해석에 필요한 경우 포함하세요.

==================================================
제외
==================================================

- 문제 번호
- 문제 발문
- 이전 선택지
- 다음 선택지
- 다른 문제
- 순수 텍스트 문장
- 큰 빈 공간

==================================================
안전 여백
==================================================

자료 경계를 찾은 후
사방에 아주 조금만 여유를 주세요.

표/그림이 잘리는 것보다
조금의 흰 여백이 있는 것이 낫습니다.

==================================================
좌표
==================================================

현재 문항 이미지 기준 0~1000.

반드시 JSON:

{
  "bbox": {
    "x": 100,
    "y": 300,
    "width": 700,
    "height": 400
  }
}
`;

  const result =
    await openai.responses.create({
      model:
        "gpt-5-mini",

      input: [
        {
          role:
            "user",

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
    return visual.bbox;
  }

  try {
    const parsed =
      parseJsonOutput(
        output
      );

    return (
      parseBBox(
        parsed?.bbox
      ) ??
      visual.bbox
    );
  } catch {
    return visual.bbox;
  }
}

async function cleanQuestionBogi({
  openai,
  questionCrop,
  questionNumber,
  bogi,
  hasVisual,
}: {
  openai: OpenAI;
  questionCrop: string;
  questionNumber: string;
  bogi: string;
  hasVisual: boolean;
}) {
  if (!hasVisual) {
    return cleanBogi(
      bogi
    );
  }

  const prompt = `
이 이미지는 국어 모의고사 ${questionNumber}번
문항 전체입니다.

현재 추출된 <보기> 텍스트는 다음과 같습니다.

-----
${bogi}
-----

이 문제의 <보기> 안에는
표, 그림, 그래프 또는 도식 같은
시각 자료가 존재합니다.

시각 자료는 별도의 원본 이미지로
이미 삽입할 예정입니다.

따라서 bogi 텍스트에는
"순수한 설명 문장"만 남겨야 합니다.

==================================================
삭제해야 하는 것
==================================================

- 표의 행/열 데이터
- 표의 숫자
- 표의 항목명
- 표를 줄글로 풀어쓴 내용
- 그림의 객체 이름 나열
- 그래프 수치
- 도식의 구조를 텍스트로 옮긴 내용
- "그림 첨부"
- "표 첨부"
- 이미지에 이미 들어 있는 정보

==================================================
남겨야 하는 것
==================================================

시각 자료 앞이나 뒤에 실제로 인쇄된
독립적인 설명 문장만 남깁니다.

예:

"모든 물체들은 일직선상에 위치하고 있으며,
양과 늑대는 움직이지 않는다."

이런 문장은 남깁니다.

==================================================
특별 규칙
==================================================

<보기>가 사실상 표 하나로만 구성되어 있고
별도 설명 문장이 없다면
빈 문자열을 반환하세요.

표의 "단위: 만 원" 같은 것은
원본 표 이미지에 있으므로
텍스트로 반복하지 마세요.

==================================================
JSON
==================================================

{
  "bogi": "남겨야 할 순수 설명 문장"
}

아무것도 남길 필요가 없으면:

{
  "bogi": ""
}

반드시 JSON만 출력하세요.
`;

  try {
    const result =
      await openai.responses.create({
        model:
          "gpt-5-mini",

        input: [
          {
            role:
              "user",

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
      return cleanBogi(
        bogi
      );
    }

    const parsed =
      parseJsonOutput(
        output
      );

    return cleanBogi(
      parsed?.bogi
    );
  } catch {
    return cleanBogi(
      bogi
    );
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
당신은 대한민국 고등학교 국어 모의고사
전문 분석가입니다.

PDF 전체 텍스트와 실제 시험지 페이지 이미지를 보고
비문학 지문과 원본 문제를 추출하세요.

새 문제는 만들지 마세요.

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

을 우선합니다.

==================================================
SOURCE
==================================================

지문 원문만 넣습니다.

문제 번호
발문
선택지
시험 안내
페이지 번호
인쇄 정보

는 제외합니다.

(가)
(나)
ⓐ
ⓑ
각주
문단
인용

은 보존합니다.

==================================================
MARKERS
==================================================

문항이 참조하는 지문 표시를 추출합니다.

kind:

section
underline
symbol
quoted
other

페이지 이미지에서 실제 밑줄이 보이면
정확한 원문을 marker.text에 넣습니다.

==================================================
QUESTIONS
==================================================

number
pageNumber
stem
bogi
choices

를 추출합니다.

==================================================
보기
==================================================

순수 텍스트 보기의 문장만 bogi에 넣습니다.

표, 그림, 그래프, 도식 내부의 내용을
줄글로 변환하지 마세요.

특히 표의 행/열/숫자를
bogi에 나열하지 마세요.

시각 자료는 이 이후 별도 이미지 분석 단계에서
원본 그대로 추출합니다.

==================================================
JSON
==================================================

{
  "groups": [
    {
      "id": "group-1",
      "title": "짧은 제목",
      "source": "지문 원문",
      "markers": [],
      "questions": [
        {
          "number": "25",
          "pageNumber": 1,
          "stem": "발문",
          "bogi": "",
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

        const pageImage =
          pageImages.find(
            (
              page: PageImage
            ) =>
              page.pageNumber ===
              pageNumber
          );

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

        let bogi =
          cleanBogi(
            question.bogi
          );

        const attachments: QuestionAttachment[] =
          [];

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
              6
            );

          const visuals =
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
            visuals.length;
            visualIndex++
          ) {
            const visual =
              visuals[
                visualIndex
              ];

            const refinedBBox =
              await refineVisualBBox({
                openai,
                questionCrop,
                questionNumber:
                  number,
                visual,
              });

            try {
              const imageUrl =
                await cropNormalizedImage(
                  questionCrop,
                  refinedBBox,
                  8
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

          const hasBogiVisual =
            attachments.some(
              (
                item: QuestionAttachment
              ) =>
                item.placement ===
                "bogi"
            );

          bogi =
            await cleanQuestionBogi({
              openai,
              questionCrop,
              questionNumber:
                number,
              bogi,
              hasVisual:
                hasBogiVisual,
            });
        }

        questions.push({
          number,

          pageNumber,

          stem:
            cleanBlock(
              question.stem
            ),

          bogi,

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