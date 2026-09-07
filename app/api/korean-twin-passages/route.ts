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

type QuestionAttachment = {
  type:
    | "table"
    | "graph"
    | "diagram"
    | "image"
    | "chart"
    | "other";
  description: string;
  relatedQuestion: string;
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

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

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

    const body = await request.json();

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

    console.log(
      "KOREAN TWIN INPUT LENGTH:",
      text.length
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

    if (text.length < 100) {
      return Response.json(
        {
          error:
            "분석할 텍스트가 너무 짧습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const openai = new OpenAI({
      apiKey,
    });

    const prompt = `
당신은 대한민국 고등학교 국어 모의고사와
수능형 국어 문제를 분석하는 전문 출제 교사입니다.

아래 입력은 국어 시험 PDF에서 추출된
전체 텍스트입니다.

이번 단계의 목적은
"쌍둥이 문제 제작을 위한 원본 형식 분석"입니다.

절대로 새 문제를 만들지 마세요.

이번에는 단순히 지문과 문제만 추출하는 것이 아니라,
실제 모의고사 형식을 재현하는 데 필요한 정보까지
구조화해서 추출해야 합니다.

==================================================
핵심 추출 대상
==================================================

각 비문학 지문마다 반드시 추출:

1. 지문 원문
2. 해당 지문에 딸린 원본 문제
3. 발문
4. <보기>
5. 선택지
6. (가), (나), (다) 같은 지문 구간
7. ⓐ, ⓑ, ⓒ 같은 지문 표식
8. 밑줄 친 부분
9. 따옴표로 강조된 부분
10. 표
11. 그래프
12. 도식
13. 그림 자료
14. 문항별 부속 자료

==================================================
비문학 우선
==================================================

다음 유형을 우선 추출하세요.

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

시, 소설, 고전문학 등은
비문학이 있다면 기본적으로 제외합니다.

==================================================
지문 분리
==================================================

예:

[24~27]
지문 A
24번
25번
26번
27번

[28~32]
문학

[33~35]
지문 B
33번
34번
35번

이라면:

group-1
- 지문 A
- 24~27번

group-2
- 지문 B
- 33~35번

으로 분리하세요.

==================================================
지문 원문 보존
==================================================

source에는 실제 지문 내용만 넣으세요.

제거:

- 페이지 번호
- 시험지 제목
- 영역 표시
- 문제 번호
- 선택지
- "다음 글을 읽고 물음에 답하시오"
- 반복되는 머리말
- 불필요한 인쇄 정보

하지만 다음은 보존해야 합니다.

- (가)
- (나)
- (다)
- ⓐ
- ⓑ
- ⓒ
- 지문 안의 번호 표식
- 인용 기호
- 문제 풀이에 필요한 각주
- 용어 설명

지문 내용을 요약하거나 바꾸지 마세요.

==================================================
markers 추출 규칙
==================================================

markers는 지문 안에서
문항이 직접 참조하는 표시를 추출합니다.

예:

문제:
"(가)에 대한 설명으로 적절하지 않은 것은?"

지문:
(가) 어떤 정책은 모든 사람에게...

이 경우:

{
  "label": "(가)",
  "text": "(가)에 해당하는 실제 지문 범위",
  "kind": "section"
}

==================================================

문제:
"밑줄 친 ⓐ의 의미로 가장 적절한 것은?"

지문:
... ⓐ효율성이 증가한다 ...

이 경우:

{
  "label": "ⓐ",
  "text": "효율성이 증가한다",
  "kind": "symbol"
}

==================================================

문제:
"밑줄 친 부분의 의미로 적절한 것은?"

PDF 텍스트만으로 밑줄 범위를
완전히 판단할 수 없다면

억지로 추측하지 말고,
확실히 식별 가능한 텍스트만 넣으세요.

==================================================
중요: (가), (나) 범위
==================================================

(가), (나)가 등장한다면
단순히 "(가)" 표시만 저장하지 마세요.

반드시 해당 범위의 본문 전체를
text에 넣으세요.

예:

(가) 시작 문장...
중간 문장...
마지막 문장...

(나) 시작...

이 경우 (가)의 marker.text는
(가) 시작부터 (나) 직전까지입니다.

==================================================
강조/밑줄
==================================================

PDF 추출 텍스트에서 밑줄이 사라질 수 있습니다.

이 경우 문제 발문을 활용해
가능한 범위를 찾으세요.

하지만 명확하지 않다면
허위로 생성하지 마세요.

확실하지 않으면 markers에서 제외하세요.

==================================================
표 / 그래프 / 도식 / 그림
==================================================

PDF 텍스트에는 표나 도식이
줄글처럼 섞여 나올 수 있습니다.

예:

A 10 20
B 30 40

처럼 보이거나,

열 구조가 깨져 있어도
문제 발문에서

"위 표"
"표에 대한 설명"
"그래프"
"자료"
"그림"
"도식"

등을 참조한다면 attachments에 기록하세요.

==================================================
attachments
==================================================

문항마다 부속 자료가 있다면:

{
  "type": "table",
  "description": "A와 B의 수치를 비교하는 2열 표",
  "relatedQuestion": "26"
}

처럼 넣습니다.

가능한 type:

- table
- graph
- diagram
- image
- chart
- other

==================================================
중요
==================================================

현재 단계에서는 실제 이미지를 생성하지 않습니다.

attachments는
"원문 PDF에 시각 자료가 있었음을 감지하고
다음 단계에서 PDF 페이지 이미지에서 잘라낼 수 있도록
표시하는 메타데이터"입니다.

==================================================
문제
==================================================

questions 배열에는
원본 문제를 번호 순서대로 넣습니다.

number:
문제 번호

stem:
문제 발문 전체

bogi:
<보기> 전체
없으면 ""

choices:
선택지 배열

attachments:
표/그래프/도식 등이 있으면 배열
없으면 []

==================================================
선택지
==================================================

가능하면 원본 기호를 유지하세요.

[
  "① ...",
  "② ...",
  "③ ...",
  "④ ...",
  "⑤ ..."
]

표 형식 선택지라도
의미를 깨뜨리지 마세요.

==================================================
정답 추측 금지
==================================================

정답을 추측하거나 추가하지 마세요.

==================================================
JSON 형식
==================================================

반드시 아래 구조로만 반환하세요.

{
  "groups": [
    {
      "id": "group-1",
      "title": "짧은 제목",
      "source": "지문 원문",
      "markers": [
        {
          "label": "(가)",
          "text": "해당 범위의 원문",
          "kind": "section"
        }
      ],
      "questions": [
        {
          "number": "24",
          "stem": "문제 발문",
          "bogi": "",
          "choices": [
            "① 선택지",
            "② 선택지",
            "③ 선택지",
            "④ 선택지",
            "⑤ 선택지"
          ],
          "attachments": []
        }
      ]
    }
  ]
}

JSON 밖의 설명은 절대 쓰지 마세요.

==================================================
분석할 시험지
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

    let parsed: any;

    try {
      parsed =
        JSON.parse(
          cleanedOutput
        );
    } catch {
      console.error(
        "TWIN PASSAGE JSON PARSE ERROR:",
        cleanedOutput
      );

      throw new Error(
        "원본 문제 분석 결과를 읽지 못했습니다."
      );
    }

    const rawGroups =
      Array.isArray(
        parsed?.groups
      )
        ? parsed.groups
        : [];

    const groups: TwinPassageGroup[] =
      rawGroups
        .map(
          (
            group: any,
            groupIndex: number
          ) => {
            const rawMarkers =
              Array.isArray(
                group?.markers
              )
                ? group.markers
                : [];

            const markers: PassageMarker[] =
              rawMarkers
                .map(
                  (
                    marker: any
                  ): PassageMarker => {
                    const rawKind =
                      cleanText(
                        marker?.kind
                      );

                    const allowedKinds = [
                      "section",
                      "underline",
                      "symbol",
                      "quoted",
                      "other",
                    ];

                    const kind =
                      allowedKinds.includes(
                        rawKind
                      )
                        ? rawKind
                        : "other";

                    return {
                      label:
                        cleanText(
                          marker?.label
                        ),

                      text:
                        cleanText(
                          marker?.text
                        ),

                      kind:
                        kind as PassageMarker["kind"],
                    };
                  }
                )
                .filter(
                  (
                    marker:
                      PassageMarker
                  ) =>
                    Boolean(
                      marker.label
                    ) &&
                    Boolean(
                      marker.text
                    )
                );

            const rawQuestions =
              Array.isArray(
                group?.questions
              )
                ? group.questions
                : [];

            const questions: SourceQuestion[] =
              rawQuestions
                .map(
                  (
                    question: any
                  ): SourceQuestion => {
                    const rawChoices =
                      Array.isArray(
                        question?.choices
                      )
                        ? question.choices
                        : [];

                    const rawAttachments =
                      Array.isArray(
                        question?.attachments
                      )
                        ? question.attachments
                        : [];

                    const attachments: QuestionAttachment[] =
                      rawAttachments
                        .map(
                          (
                            attachment: any
                          ): QuestionAttachment => {
                            const rawType =
                              cleanText(
                                attachment?.type
                              );

                            const allowedTypes = [
                              "table",
                              "graph",
                              "diagram",
                              "image",
                              "chart",
                              "other",
                            ];

                            const type =
                              allowedTypes.includes(
                                rawType
                              )
                                ? rawType
                                : "other";

                            return {
                              type:
                                type as QuestionAttachment["type"],

                              description:
                                cleanText(
                                  attachment?.description
                                ),

                              relatedQuestion:
                                cleanText(
                                  attachment?.relatedQuestion
                                ) ||
                                cleanText(
                                  question?.number
                                ),
                            };
                          }
                        )
                        .filter(
                          (
                            attachment:
                              QuestionAttachment
                          ) =>
                            Boolean(
                              attachment.description
                            )
                        );

                    return {
                      number:
                        cleanText(
                          question?.number
                        ),

                      stem:
                        cleanText(
                          question?.stem
                        ),

                      bogi:
                        cleanText(
                          question?.bogi
                        ),

                      choices:
                        rawChoices
                          .map(
                            (
                              choice: any
                            ) =>
                              cleanText(
                                choice
                              )
                          )
                          .filter(
                            Boolean
                          ),

                      attachments,
                    };
                  }
                )
                .filter(
                  (
                    question:
                      SourceQuestion
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
                cleanText(
                  group?.id
                ) ||
                `group-${groupIndex + 1}`,

              title:
                cleanText(
                  group?.title
                ) ||
                `비문학 지문 ${groupIndex + 1}`,

              source:
                cleanText(
                  group?.source
                ),

              markers,

              questions,
            };
          }
        )
        .filter(
          (
            group:
              TwinPassageGroup
          ) =>
            group.source.length >
              100 &&
            group.questions.length >
              0
        );

    if (groups.length === 0) {
      throw new Error(
        "지문과 원본 문제 세트를 찾지 못했습니다."
      );
    }

    console.log(
      "KOREAN TWIN GROUPS:",
      groups.length
    );

    console.log(
      "KOREAN TWIN QUESTIONS:",
      groups.reduce(
        (sum, group) =>
          sum +
          group.questions.length,
        0
      )
    );

    console.log(
      "KOREAN TWIN MARKERS:",
      groups.reduce(
        (sum, group) =>
          sum +
          group.markers.length,
        0
      )
    );

    return Response.json({
      groups,
    });
  } catch (error: any) {
    console.error(
      "KOREAN TWIN PASSAGES ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "쌍둥이 문제 원본 분석 중 오류가 발생했습니다.",

        detail:
          error?.message ||
          "알 수 없는 오류",
      },
      {
        status: 500,
      }
    );
  }
}