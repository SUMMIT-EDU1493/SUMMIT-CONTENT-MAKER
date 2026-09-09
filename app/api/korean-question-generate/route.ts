import OpenAI from "openai";

export const maxDuration = 300;

type Difficulty = "중" | "상";

type TypeRequest = {
  type: string;
  count: number;
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseJsonOutput(output: string) {
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
            "OPENAI_API_KEY가 설정되지 않았습니다.",
        },
        {
          status: 500,
        }
      );
    }

    const body =
      await request.json();

    const title =
      cleanText(body?.title) ||
      "국어 독서 지문";

    const passage =
      cleanText(body?.passage);

    const difficulties: Difficulty[] =
      Array.isArray(
        body?.difficulties
      )
        ? body.difficulties
            .filter(
              (
                item: unknown
              ): item is Difficulty =>
                item === "중" ||
                item === "상"
            )
            .filter(
              (
                item: Difficulty,
                index: number,
                array: Difficulty[]
              ) =>
                array.indexOf(
                  item
                ) === index
            )
        : [];

    const activeDifficulties: Difficulty[] =
      difficulties.length > 0
        ? difficulties
        : ["중"];

    const rawTypes =
      Array.isArray(body?.types)
        ? body.types
        : [];

    const types: TypeRequest[] =
      rawTypes
        .map(
          (
            item: unknown
          ): TypeRequest => {
            const value =
              item &&
              typeof item ===
                "object"
                ? (item as Record<
                    string,
                    unknown
                  >)
                : {};

            return {
              type:
                cleanText(
                  value.type
                ),

              count:
                Math.max(
                  0,
                  Math.min(
                    30,
                    Number(
                      value.count ??
                        0
                    ) || 0
                  )
                ),
            };
          }
        )
        .filter(
          (item: TypeRequest) =>
            item.type &&
            item.count > 0
        );

    if (!passage) {
      return Response.json(
        {
          error:
            "문제를 만들 지문이 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      types.length === 0
    ) {
      return Response.json(
        {
          error:
            "최소 한 개 이상의 문제 유형을 선택해 주세요.",
        },
        {
          status: 400,
        }
      );
    }

    const requestedTypes =
      types
        .map(
          (item) =>
            `- ${item.type}: ${item.count}문항`
        )
        .join("\n");

    const totalCount =
      types.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.count,
        0
      );

    const requestedCountByType =
      new Map<string, number>(
        types.map(
          (item) => [
            item.type,
            item.count,
          ]
        )
      );

    const openai =
      new OpenAI({
        apiKey,
      });

    const prompt = `
당신은 대한민국 수능 국어와 평가원 모의평가
독서 영역 문항을 설계하는 전문 출제자입니다.

아래 원문 지문을 바탕으로
수능·모의평가형 5지선다 문제를 제작하십시오.

==================================================
절대 규칙: 원문 보존
==================================================

지문 자체는 절대 수정하지 마십시오.

문제를 만들기 위해
원문 문장을 바꾸거나,
없는 정보를 원문에 삽입하거나,
지문을 재작성하면 안 됩니다.

문제와 <보기>만 새롭게 만드십시오.

==================================================
난이도
==================================================

사용 가능한 난이도: ${activeDifficulties.join(", ")}

- 한 가지 난이도만 전달된 경우 모든 문항을 그 난이도로 출제하십시오.
- "중"과 "상"이 함께 전달된 경우 전체 문항에서 두 난이도를 가능한 한 균등하게 섞으십시오.
- 문항 수가 홀수라면 어느 한 난이도가 1문항 더 많아도 됩니다.
- 같은 유형 안에서도 문항이 2개 이상이면 난이도가 한쪽에 몰리지 않도록 하십시오.

[중]

- 단순 암기형이나 한 문장 복사형 문제는 피하십시오.
- 최소 한 번 이상의 판단이 필요해야 합니다.
- 문단 간 관계, 조건, 인과, 대상 구분 등을 파악해야 풀리게 하십시오.
- 오답은 지문과 상당히 유사하지만
  주체, 조건, 범위, 원인, 결과 등을 미세하게 틀리게 하십시오.

[상]

- 두 개 이상의 문단이나 정보를 결합하도록 하십시오.
- 조건·개념·관점 등을 2단계 이상 적용하도록 하십시오.
- 정답과 오답의 차이가 지나치게 노골적이면 안 됩니다.
- 오답도 지문의 일부 정보와는 부합하지만
  결정적인 조건에서 틀리도록 설계하십시오.
- 단순히 문장을 길게 만드는 방식으로 난도를 높이지 마십시오.

==================================================
요청 문제 유형
==================================================

${requestedTypes}

총 ${totalCount}문항을 목표로 하십시오.

단,
지문 자체가 특정 유형에 객관적으로 적합하지 않다면
억지로 문제를 만들지 마십시오.

그러나 다음 유형은 일반적인 독서 지문이라면
가급적 출제하십시오.

- 글의 구조와 전개 방식
- 세부 내용 파악
- 단어의 의미 파악
- 생략된 내용 추론
- 중심 내용 파악

특히 "생략된 내용 추론"은
지문에 명시된 전제·인과·조건·대조 관계에서
논리적으로 도출할 수 있는 내용이 하나라도 있다면
출제 가능한 것으로 판단하십시오.

정말 객관적으로 출제가 불가능한 경우에만
skippedTypes에 이유와 함께 기록하십시오.

요청한 문항 수보다 더 많은 문제를 만들면 안 됩니다.
각 유형별 요청 개수를 정확히 지키십시오.

==================================================
유형별 출제 규칙
==================================================

1. 글의 구조와 전개 방식

먼저 내부적으로 문단별 역할과 전체 구조를 분석하십시오.

정답은 실제 전개를 정확히 설명해야 합니다.

오답에는
지문에 존재하지 않는
비교, 대조, 문제 해결, 시간 순서,
반론, 사례화, 원인 분석 등의 전개 방식을
교묘하게 섞을 수 있습니다.

단순히
"대상을 설명하고 있다"
수준의 쉬운 선지는 금지합니다.

--------------------------------------------------

2. 세부 내용 파악

모든 선택지는 반드시 지문의 내용과 대조할 수 있어야 합니다.

오답은 다음 요소 중 하나를 미세하게 변형하십시오.

- 주체
- 대상
- 조건
- 범위
- 정도
- 원인
- 결과
- 선후 관계
- 포함 관계

지문과 전혀 관계없는 황당한 오답은 금지합니다.

--------------------------------------------------

3. 구체적 사례 적용

먼저 지문의 핵심 개념 또는 원리를 추출하십시오.

그 다음 지문에 직접 등장하지 않는
새로운 텍스트 사례를 <보기>로 만드십시오.

<보기>는
지문의 개념을 적용하면
정답을 명확히 판별할 수 있어야 합니다.

도표, 그래프, 그림은 사용하지 마십시오.

--------------------------------------------------

4. 단어의 의미 파악

반드시 원문에 실제 존재하는
중요한 단어 또는 표현 하나를 선택하십시오.

사전 뜻 암기 문제가 아니라
문맥에서 어떤 의미로 사용되었는지 물으십시오.

targetWord 필드에
원문의 실제 어휘를 그대로 넣으십시오.

선택지는
비슷해 보이지만 문맥에는 맞지 않는 의미를 포함하십시오.

--------------------------------------------------

5. 생략된 내용 추론

지문에서 명시되지 않았지만
제시된 전제, 조건, 인과, 대조 관계로부터
논리적으로 도출되는 내용을 물으십시오.

단순히
"그럴 수도 있는 내용"은 정답이 될 수 없습니다.

정답은 반드시
지문의 정보에 의해 논리적으로 뒷받침되어야 합니다.

--------------------------------------------------

6. 다른 견해와의 비교

원문의 핵심 관점과 비교 가능한
짧은 텍스트 <보기>를 만드십시오.

<보기>에는
원문과 공통점 또는 차이가 분명한
다른 관점을 제시하십시오.

두 견해의
판단 기준, 전제, 설명 방식,
대상에 대한 태도 등을 비교하게 하십시오.

지문이 단순한 기계 원리나
관점 비교 자체가 부적절한 정보 전달 글이라면
억지로 만들지 말고 skippedTypes에 기록하십시오.

--------------------------------------------------

7. 중심 내용 파악

글 전체를 포괄하는
가장 상위의 핵심 내용을 정답으로 만드십시오.

첫 문단이나 마지막 문단만 보고
정답을 정하지 마십시오.

오답은 다음 방식으로 만드십시오.

- 너무 좁은 일부 내용
- 지나치게 넓은 일반론
- 단순 소재만 언급
- 글의 관점과 반대
- 부수적인 예시를 중심 내용처럼 제시

==================================================
수능형 문항 표현
==================================================

문제의 발문은 실제 수능·모의평가처럼
간결하고 자연스럽게 작성하십시오.

예:

- 윗글의 내용과 일치하지 않는 것은?
- 윗글의 내용에 대한 이해로 가장 적절한 것은?
- 윗글의 글의 전개 방식에 대한 설명으로 가장 적절한 것은?
- 윗글을 바탕으로 <보기>를 이해한 내용으로 적절하지 않은 것은?
- 윗글에서 추론한 내용으로 가장 적절한 것은?
- 윗글과 <보기>를 비교하여 이해한 내용으로 가장 적절한 것은?
- 윗글의 중심 내용으로 가장 적절한 것은?

같은 발문을 반복하지 말고
문항에 가장 적합한 표현을 선택하십시오.

==================================================
선택지
==================================================

각 문항은 정확히 5개의 선택지를 가져야 합니다.

정답은 반드시 하나만 존재해야 합니다.

선택지 번호는 JSON에 넣지 마십시오.
화면에서 자동으로 번호를 붙입니다.

정답 번호는 1~5의 숫자로 반환하십시오.

정답 위치가 계속 같은 번호에 몰리지 않도록
전체 문항에서 자연스럽게 분산하십시오.

==================================================
해설
==================================================

각 문항에 다음을 작성하십시오.

explanation:
정답이 되는 핵심 이유를
2~4문장으로 명확하게 설명

choiceExplanations:
1번부터 5번까지
각 선택지가 왜 맞거나 틀렸는지 설명

evidence:
출제자가 검수할 수 있도록
정답 판단의 원문 근거를 간결히 기록

evidence는 학생 문제지에는 표시하지 않을
관리자 검수용 정보입니다.

원문을 길게 그대로 복사하지 말고
근거가 되는 부분을 짧게 특정하거나 요약하십시오.

==================================================
품질 검수
==================================================

JSON 출력 전에 모든 문제를 다시 검수하십시오.

1. 정답이 실제로 하나뿐인가?
2. 정답이 지문으로 증명되는가?
3. 오답도 너무 황당하지 않은가?
4. 선택지끼리 의미가 겹치지 않는가?
5. 지문에 없는 지식을 정답 근거로 사용하지 않았는가?
6. <보기>가 필요한 유형에서는 텍스트 <보기>가 충분한가?
7. 각 문항의 난이도가 사용 가능한 난이도 범위 안에 있으며, 복수 난이도 요청 시 적절히 섞였는가?
8. 5개 선택지가 모두 문법적으로 자연스러운가?
9. 같은 표현을 반복하여 정답이 티 나지 않는가?

하나라도 문제가 있으면 수정한 뒤 출력하십시오.

==================================================
JSON
==================================================

반드시 아래 JSON 형식만 반환하십시오.

{
  "questions": [
    {
      "type": "세부 내용 파악",
      "difficulty": "중",
      "stem": "문제 발문",
      "boxText": "",
      "targetWord": "",
      "choices": [
        "선택지",
        "선택지",
        "선택지",
        "선택지",
        "선택지"
      ],
      "answer": 3,
      "explanation": "정답 해설",
      "choiceExplanations": [
        "1번 해설",
        "2번 해설",
        "3번 해설",
        "4번 해설",
        "5번 해설"
      ],
      "evidence": "관리자 검수용 원문 근거"
    }
  ],
  "skippedTypes": [
    {
      "type": "다른 견해와의 비교",
      "reason": "이 지문에는 관점 비교형 문항이 적합하지 않음"
    }
  ]
}

boxText가 필요하지 않은 문제는 빈 문자열.
targetWord가 필요하지 않은 문제는 빈 문자열.

JSON 밖의 설명은 출력하지 마십시오.

==================================================
지문 제목
==================================================

${title}

==================================================
원문 지문
==================================================

${passage}
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
        "문제 생성 결과가 비어 있습니다."
      );
    }

    const parsed =
      parseJsonOutput(output);

    const rawQuestions =
      Array.isArray(
        parsed?.questions
      )
        ? parsed.questions
        : [];

    const questions =
      rawQuestions
        .map(
          (
            raw: unknown
          ) => {
            const item =
              raw &&
              typeof raw ===
                "object"
                ? (raw as Record<
                    string,
                    unknown
                  >)
                : {};

            const choices =
              Array.isArray(
                item.choices
              )
                ? item.choices
                    .map(
                      cleanText
                    )
                    .slice(
                      0,
                      5
                    )
                : [];

            const choiceExplanations =
              Array.isArray(
                item.choiceExplanations
              )
                ? item.choiceExplanations
                    .map(
                      cleanText
                    )
                    .slice(
                      0,
                      5
                    )
                : [];

            return {
              type:
                cleanText(
                  item.type
                ),

              difficulty:
                item.difficulty ===
                "상"
                  ? "상"
                  : "중",

              stem:
                cleanText(
                  item.stem
                ),

              boxText:
                cleanText(
                  item.boxText
                ),

              targetWord:
                cleanText(
                  item.targetWord
                ),

              choices,

              answer:
                Math.max(
                  1,
                  Math.min(
                    5,
                    Number(
                      item.answer ??
                        1
                    ) || 1
                  )
                ),

              explanation:
                cleanText(
                  item.explanation
                ),

              choiceExplanations,

              evidence:
                cleanText(
                  item.evidence
                ),
            };
          }
        )
        .filter(
          (question: {
            type: string;
            stem: string;
            choices: string[];
          }) =>
            question.type &&
            question.stem &&
            question.choices
              .length === 5
        );

    const limitedQuestions = (() => {
      const used =
        new Map<string, number>();

      const result: typeof questions =
        [];

      for (
        const question of questions
      ) {
        const limit =
          requestedCountByType.get(
            question.type
          );

        if (
          !limit ||
          limit <= 0
        ) {
          continue;
        }

        const current =
          used.get(
            question.type
          ) ?? 0;

        if (
          current >= limit
        ) {
          continue;
        }

        result.push(
          question
        );

        used.set(
          question.type,
          current + 1
        );
      }

      return result;
    })();

    const skippedTypes =
      Array.isArray(
        parsed?.skippedTypes
      )
        ? parsed.skippedTypes
            .map(
              (
                raw: unknown
              ) => {
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
                  type:
                    cleanText(
                      item.type
                    ),

                  reason:
                    cleanText(
                      item.reason
                    ),
                };
              }
            )
            .filter(
              (item: {
                type: string;
                reason: string;
              }) =>
                item.type
            )
        : [];

    if (
      limitedQuestions.length ===
        0 &&
      skippedTypes.length === 0
    ) {
      return Response.json({
        questions: [],
        skippedTypes: types.map(
          (item) => ({
            type:
              item.type,
            reason:
              "요청한 유형의 유효한 문항을 생성하지 못했습니다.",
          })
        ),
      });
    }

    return Response.json({
      questions:
        limitedQuestions,
      skippedTypes,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "KOREAN QUESTION GENERATE ERROR:",
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
