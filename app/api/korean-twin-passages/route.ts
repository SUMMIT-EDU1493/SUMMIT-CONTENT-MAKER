import OpenAI from "openai";

export const maxDuration = 300;

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

function parseJsonOutput(
  output: string
) {
  const cleaned = output
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned);
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
      typeof rawText === "string"
        ? rawText.trim()
        : "";

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

    const openai =
      new OpenAI({
        apiKey,
      });

    const prompt = `
당신은 대한민국 고등학교 국어 모의고사 및
수능형 국어 시험을 분석하는 전문 출제 교사입니다.

아래 입력은 PDF에서 추출한 시험지 전체 텍스트입니다.

텍스트에는 다음과 같은 페이지 구분이 포함되어 있습니다.

--- 1페이지 ---
--- 2페이지 ---
--- 3페이지 ---

따라서 각 문항이 실제로 어느 페이지에 있는지
반드시 정확하게 판단할 수 있습니다.

이번 작업의 목적은
"쌍둥이 문제 제작을 위한 원본 문제 구조 추출"입니다.

새 문제를 만들지 마십시오.

==================================================
비문학 지문
==================================================

다음 유형의 독립적인 비문학 지문을 우선 추출합니다.

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

시, 소설, 고전문학 등의 문학 작품은
비문학이 충분히 존재한다면 기본적으로 제외합니다.

==================================================
지문 그룹
==================================================

예:

[24~27]
비문학 지문 A
24번
25번
26번
27번

[28~32]
문학

[33~35]
비문학 지문 B
33번
34번
35번

이라면 반드시:

group-1
지문 A + 24~27번

group-2
지문 B + 33~35번

으로 분리하십시오.

==================================================
SOURCE
==================================================

source에는 실제 지문 원문을 넣습니다.

삭제:

- 문제 번호
- 문제 발문
- 선택지
- 시험 안내
- 페이지 번호
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
- 용어 설명
- 문제 풀이에 필요한 표식

원문을 요약하거나 새로 쓰지 마십시오.

==================================================
MARKERS
==================================================

문제가 직접 참조하는 지문의 표식을 추출합니다.

kind:

section
underline
symbol
quoted
other

예:

{
  "label": "(가)",
  "text": "(가) 구간 전체 원문",
  "kind": "section"
}

{
  "label": "ⓐ",
  "text": "ⓐ가 붙은 실제 표현",
  "kind": "symbol"
}

PDF 텍스트만으로 밑줄 여부를
확실하게 알 수 없다면
밑줄을 임의로 만들어내지 마십시오.

==================================================
QUESTIONS
==================================================

각 문제에는 다음만 추출합니다.

number
pageNumber
stem
bogi
choices

중요:

표, 그림, 그래프, 도식의 모양을
텍스트로 재구성하려 하지 마십시오.

원본 문제의 실제 디자인은
클라이언트에서 PDF 원본 이미지를
직접 잘라서 사용합니다.

==================================================
PAGE NUMBER
==================================================

각 문제의 pageNumber는
반드시 실제 PDF 페이지 번호입니다.

예:

25번이

--- 2페이지 ---

아래에 있다면:

"pageNumber": 2

로 반환하십시오.

==================================================
BOGI
==================================================

순수 텍스트 <보기>가 있다면
bogi에 원문 텍스트를 넣습니다.

표나 그림 자체를
줄글로 변환해서 bogi에 넣지 마십시오.

==================================================
CHOICES
==================================================

선택지의 기호를 유지합니다.

①
②
③
④
⑤

==================================================
JSON
==================================================

반드시 아래 형식의 JSON만 출력합니다.

{
  "groups": [
    {
      "id": "group-1",
      "title": "짧은 지문 제목",
      "source": "지문 원문",
      "markers": [],
      "questions": [
        {
          "number": "24",
          "pageNumber": 1,
          "stem": "원본 발문",
          "bogi": "",
          "choices": [
            "① 선택지",
            "② 선택지",
            "③ 선택지",
            "④ 선택지",
            "⑤ 선택지"
          ]
        }
      ]
    }
  ]
}

JSON 밖의 설명은 절대 쓰지 마십시오.

==================================================
시험지 전체 텍스트
==================================================

${text}
`;

    const result =
      await openai.responses.create({
        model: "gpt-5-mini",
        input: prompt,
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
              rawQuestions
                .map(
                  (
                    rawQuestion: unknown
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

                    const rawChoices: unknown[] =
                      Array.isArray(
                        question.choices
                      )
                        ? question.choices
                        : [];

                    return {
                      number:
                        cleanInline(
                          question.number
                        ),

                      pageNumber:
                        numberValue(
                          question.pageNumber
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