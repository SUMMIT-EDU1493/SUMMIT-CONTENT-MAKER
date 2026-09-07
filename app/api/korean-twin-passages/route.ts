import OpenAI from "openai";

export const maxDuration = 300;

type SourceQuestion = {
  number: string;
  stem: string;
  bogi: string;
  choices: string[];
};

type TwinPassageGroup = {
  id: string;
  title: string;
  source: string;
  questions: SourceQuestion[];
};

function cleanText(value: unknown) {
  return String(value ?? "")
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

    /*
    ==================================================
    입력 호환
    text / pdfText 둘 다 허용
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

    /*
    ==================================================
    핵심 프롬프트
    ==================================================
    */

    const prompt = `
당신은 대한민국 고등학교 국어 시험 문제를
분석하는 전문 출제 교사입니다.

아래 입력은 고등학교 국어 시험 PDF에서
추출한 전체 텍스트입니다.

이번 작업의 목적은
"쌍둥이 문제 제작을 위한 원본 문제 세트 추출"
입니다.

절대로 새 문제를 만들지 마세요.

지금 단계에서는 오직

1. 비문학 지문
2. 그 지문에 딸린 원본 문제
3. 각 문제의 선택지
4. 문제에 포함된 <보기>

를 정확하게 묶어서 반환하세요.

==================================================
가장 중요한 원칙
==================================================

예를 들어 시험지가 다음 구조라면:

[24~27] 다음 글을 읽고 물음에 답하시오.

비문학 지문 A

24. 문제
① ...
② ...
③ ...
④ ...
⑤ ...

25. 문제
<보기>
...
① ...
② ...
③ ...
④ ...
⑤ ...

26. 문제
...

27. 문제
...

[28~32] 문학

...

[33~35] 다음 글을 읽고 물음에 답하시오.

비문학 지문 B

33. 문제
...
34. 문제
...
35. 문제
...

이 경우 반드시 다음처럼 분리합니다.

PASSAGE 1
- 지문 A
- 24번
- 25번
- 26번
- 27번

PASSAGE 2
- 지문 B
- 33번
- 34번
- 35번

==================================================
비문학 우선
==================================================

다음을 우선 추출합니다.

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
이번 단계에서 기본적으로 제외합니다.

비문학 지문이 여러 개 있으면
각각 별도의 passage group으로 반환하세요.

==================================================
지문 추출 규칙
==================================================

지문 source에는

실제 지문 본문만 넣으세요.

다음은 제거하세요.

- 페이지 번호
- 시험지 머리말
- 영역 표시
- "다음 글을 읽고 물음에 답하시오"
- 문제 번호
- 문제 문장
- 선택지
- 정답 표시
- 불필요한 반복 문구

그러나 지문 자체의 각주나 용어 설명이
독해에 필요한 경우에는 포함해도 됩니다.

지문을 요약하거나 새로 쓰지 마세요.

==================================================
문제 추출 규칙
==================================================

questions 배열에는
해당 지문 뒤에 붙은 원본 문제를
문제 번호 순서대로 넣으세요.

각 문제:

number:
문제 번호만 넣습니다.
예: "24"

stem:
문제의 발문 전체.
선택지는 포함하지 않습니다.

bogi:
문제 안에 <보기>가 있다면
<보기> 전체 내용을 넣습니다.

<보기>가 없으면 빈 문자열 "".

choices:
선택지를 순서대로 문자열 배열로 넣습니다.

예:

[
  "① ...",
  "② ...",
  "③ ...",
  "④ ...",
  "⑤ ..."
]

선지가 표 형식이라면
각 선지의 의미가 보존되도록
하나의 문자열로 정리하세요.

==================================================
중요
==================================================

문제의 정답을 추측하지 마세요.

정답 분석은 다음 단계에서 합니다.

지금은 원문 시험의 구조를
최대한 정확히 보존하는 것이 목표입니다.

==================================================
제목
==================================================

각 지문에는 학생이 알아보기 쉬운
짧은 제목을 새로 붙이세요.

예:

"기본소득과 최저소득 보장"

"동물의 눈동자와 생존 전략"

==================================================
JSON 출력
==================================================

반드시 아래 형식으로만 답하세요.

{
  "groups": [
    {
      "id": "group-1",
      "title": "짧은 지문 제목",
      "source": "지문 원문",
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
          ]
        }
      ]
    }
  ]
}

JSON 밖의 설명은 절대 하지 마세요.

==================================================
시험지 전체 텍스트
==================================================

${text}
`;

    /*
    ==================================================
    AI 분석
    ==================================================
    */

    const result =
      await openai.responses.create({
        model: "gpt-5-mini",
        input: prompt,
      });

    const output =
      result.output_text?.trim() ?? "";

    if (!output) {
      throw new Error(
        "원본 문제 분석 결과가 비어 있습니다."
      );
    }

    /*
    ==================================================
    JSON 코드블록 제거
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

    /*
    ==================================================
    결과 정리
    ==================================================
    */

    const groups: TwinPassageGroup[] =
      rawGroups
        .map(
          (
            group: any,
            groupIndex: number
          ) => {
            const questions =
              Array.isArray(
                group?.questions
              )
                ? group.questions
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
                    )
                : [];

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