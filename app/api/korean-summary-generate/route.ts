import OpenAI from "openai";

type Passage = {
  id: string;
  title: string;
  source: string;
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "OPENAI_API_KEY가 설정되어 있지 않습니다.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const passages: Passage[] = Array.isArray(
      body?.passages
    )
      ? body.passages
      : [];

    if (passages.length === 0) {
      return Response.json(
        {
          error:
            "선택된 국어 지문이 없습니다.",
        },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey,
    });

    const prompt = `
당신은 대한민국 고등학교 국어 비문학
'비주얼 요약집' 전문 편집자입니다.

아래 지문을 시험 직전 한눈에 볼 수 있는
아주 짧고 압축적인 학습자료로 정리하세요.

절대로 장문의 설명을 쓰지 마세요.

이 자료는 작은 박스와 일러스트가 함께 들어가는
가로형 비주얼 학습지에 사용됩니다.

==================================================
가장 중요한 원칙
==================================================

1. 많이 담으려 하지 마세요.
2. 핵심만 남기세요.
3. 긴 문장을 만들지 마세요.
4. 모든 내용은 원문에 근거해야 합니다.
5. 같은 내용을 다른 항목에서 반복하지 마세요.
6. 설명보다 '키워드 + 짧은 관계'를 우선합니다.

==================================================
분량 제한 — 반드시 지키세요
==================================================

TITLE
- 18자 이내
- 지문의 핵심 대상만
- "요약", "정리" 같은 말 붙이지 않기

ONELINE
- 35자 이내
- 한 문장
- 가장 중요한 메시지만

FLOW
- 정확히 4~5단계
- label: 6자 이내
- content: 22자 이내
- 한 단계에 하나의 정보만

좋은 예:
{
  "label": "문제 제기",
  "content": "기술 발전 → 일자리 감소 우려"
}

나쁜 예:
{
  "label": "문제 제기",
  "content": "기술의 발전으로 인해 향후 여러 일자리가 감소할 것으로 예상되면서 저소득층 보호를 위한 사회보장제도의 필요성이 커지고 있다."
}

CONCEPTS
- 최대 5개
- name: 8자 이내
- description: 18자 이내
- 사전식 설명 금지
- 시험에 필요한 뜻만

COMPARISON
- 비교 대상이 명확할 때만 작성
- 헤더는 3개까지만
- 행은 최대 4개
- 각 셀 15자 이내
- 문장보다 단어/짧은 구 사용

예:
[
  ["대상", "저소득층", "모든 국민"],
  ["심사", "필요", "없음"],
  ["장점", "집중 지원", "사각지대 감소"],
  ["한계", "근로 유인 저하", "재정 부담"]
]

TEST POINT
- 정확히 3개 이하
- 각 22자 이내
- 시험에서 구분해야 할 것만

CAUTION
- 30자 이내
- 가장 헷갈릴 내용 하나만

VISUAL PROMPT
- 그림 생성용이므로 구체적으로 작성
- 글자를 그림에 넣도록 지시하지 않기
- 비교 지문이면 좌우 대비
- 인과 지문이면 원인 → 결과
- 과정 지문이면 단계 변화
- 원문에 없는 정보 추가 금지

==================================================
지문
==================================================

${JSON.stringify(passages, null, 2)}

==================================================
반환 JSON
==================================================

JSON만 반환하세요.

{
  "summaries": [
    {
      "passageId": "원래 passage id",

      "title": "18자 이내 제목",

      "oneLine": "35자 이내 핵심 한 줄",

      "visualPrompt": "학습용 일러스트 설명",

      "flow": [
        {
          "label": "6자 이내",
          "content": "22자 이내"
        }
      ],

      "concepts": [
        {
          "name": "8자 이내",
          "description": "18자 이내"
        }
      ],

      "comparisonTitle": "12자 이내",

      "comparisonHeaders": [
        "구분",
        "A",
        "B"
      ],

      "comparisonRows": [
        [
          "항목",
          "15자 이내",
          "15자 이내"
        ]
      ],

      "testPoints": [
        "22자 이내"
      ],

      "caution": "30자 이내"
    }
  ]
}

다시 강조합니다.

이것은 교과서 해설지가 아닙니다.
학생이 10초 안에 훑어볼 수 있는
비주얼 요약 자료입니다.

짧게 쓰세요.
`;

    const response =
      await openai.responses.create({
        model: "gpt-5-mini",
        input: prompt,
      });

    const raw =
      response.output_text?.trim();

    if (!raw) {
      throw new Error(
        "요약.ZIP 결과가 없습니다."
      );
    }

    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    const summaries = Array.isArray(
      parsed?.summaries
    )
      ? parsed.summaries.map(
          (item: any) => ({
            ...item,

            title:
              String(item?.title || "")
                .trim()
                .slice(0, 24),

            oneLine:
              String(item?.oneLine || "")
                .trim()
                .slice(0, 50),

            flow: Array.isArray(item?.flow)
              ? item.flow
                  .slice(0, 5)
                  .map((flow: any) => ({
                    label: String(
                      flow?.label || ""
                    )
                      .trim()
                      .slice(0, 8),

                    content: String(
                      flow?.content || ""
                    )
                      .trim()
                      .slice(0, 30),
                  }))
              : [],

            concepts: Array.isArray(
              item?.concepts
            )
              ? item.concepts
                  .slice(0, 5)
                  .map(
                    (concept: any) => ({
                      name: String(
                        concept?.name || ""
                      )
                        .trim()
                        .slice(0, 10),

                      description: String(
                        concept?.description ||
                          ""
                      )
                        .trim()
                        .slice(0, 24),
                    })
                  )
              : [],

            comparisonRows:
              Array.isArray(
                item?.comparisonRows
              )
                ? item.comparisonRows
                    .slice(0, 4)
                    .map((row: any[]) =>
                      Array.isArray(row)
                        ? row
                            .slice(0, 3)
                            .map((cell) =>
                              String(cell || "")
                                .trim()
                                .slice(0, 20)
                            )
                        : []
                    )
                : [],

            testPoints: Array.isArray(
              item?.testPoints
            )
              ? item.testPoints
                  .slice(0, 3)
                  .map((point: any) =>
                    String(point || "")
                      .trim()
                      .slice(0, 30)
                  )
              : [],

            caution: String(
              item?.caution || ""
            )
              .trim()
              .slice(0, 40),
          })
        )
      : [];

    return Response.json({
      summaries,
    });
  } catch (error) {
    console.error(
      "Korean summary generation error:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "국어 요약.ZIP 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}