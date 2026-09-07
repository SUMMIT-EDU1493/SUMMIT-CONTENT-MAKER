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
너는 고등 국어 학습자료 편집자다.

목표는
"영어 요약ZIP처럼 간결하고 보기 쉬운
국어 비주얼 요약 1장"
을 만드는 것이다.

이 자료는
긴 해설지가 아니라,
학생이 10초 안에 핵심을 훑어볼 수 있는
가로형 비주얼 요약 학습지다.

==================================================
절대 원칙
==================================================

- 절대 원문을 길게 복붙하지 마라.
- 절대 장문의 설명을 쓰지 마라.
- 절대 한 칸에 긴 문장을 넣지 마라.
- 많이 담으려 하지 마라.
- 핵심만 남겨라.
- 설명보다 키워드와 관계를 우선하라.
- 같은 내용을 여러 영역에서 반복하지 마라.
- 글이 길어질 것 같으면 과감히 버려라.
- 모든 내용은 원문에 근거해야 한다.
- 비주얼 요약에 필요 없는 세부 설명은 생략한다.

이 결과는 작은 카드와 일러스트가 함께 들어가는
고정 레이아웃에 들어간다.

따라서
"짧고, 압축적이고, 바로 읽히는 문구"
만 생성해야 한다.

==================================================
제목
==================================================

- 8~18자
- 핵심 논점만 표현
- "요약", "정리", "분석" 같은 단어 붙이지 말 것

예:
최저소득보장제와 기본소득제
동물의 눈동자와 생존 방식

==================================================
한 줄 핵심
==================================================

- 최대 32자
- 딱 1문장
- 지문의 가장 중요한 메시지만

좋은 예:
두 복지제도의 지급 방식과 한계를 비교한다.

나쁜 예:
이 글은 기술 발전에 따른 실업 문제를 배경으로
최저소득보장제의 문제점을 살펴보고 기본소득제를
대안으로 검토하면서 여러 장점과 한계를 설명한다.

==================================================
핵심 흐름
==================================================

- 4~5단계
- label: 최대 6자
- content: 최대 16자
- 한 단계에 정보 하나만
- 메모형 표현 사용

좋은 예:

{
  "label": "문제 제기",
  "content": "일자리 감소 → 저소득층 증가"
}

{
  "label": "기존 제도",
  "content": "최저생계비 보전"
}

{
  "label": "문제점",
  "content": "근로 유인↓ · 심사비용↑"
}

나쁜 예:

{
  "label": "문제 제기",
  "content": "기술 발전으로 인해 향후 일자리가 감소하면서
  저소득층이 늘어날 가능성이 있기 때문에 기존 복지제도를
  다시 살펴볼 필요가 있다."
}

==================================================
핵심 개념
==================================================

- 최대 5개
- name: 최대 6자
- description: 최대 14자
- 사전식 정의 금지
- 시험에 필요한 의미만

좋은 예:

{
  "name": "총소득",
  "description": "세금·지원 전 소득"
}

{
  "name": "순소득",
  "description": "세금·지원 후 소득"
}

==================================================
비교
==================================================

비교 대상이 뚜렷할 때만 작성한다.

- comparisonHeaders: 반드시 3개
- ["구분", "A", "B"] 형태
- comparisonRows: 최대 4개
- 각 셀 최대 12자
- 문장보다 단어/짧은 구 사용

좋은 예:

[
  ["대상", "저소득층", "모든 국민"],
  ["심사", "필요", "없음"],
  ["장점", "집중 지원", "사각지대 감소"],
  ["한계", "근로 유인 저하", "재정 부담"]
]

비교가 필요 없는 지문이면
comparisonRows는 빈 배열로 반환한다.

==================================================
시험 POINT
==================================================

- 최대 3개
- 각 항목 최대 18자
- 시험에서 구분할 핵심만

좋은 예:

"두 제도의 지급 대상 차이"
"면세점과 순소득 관계"
"기본소득제의 현실적 한계"

==================================================
헷갈리기 쉬운 포인트
==================================================

- caution은 최대 30자
- 딱 1개만
- 학생이 가장 혼동하기 쉬운 핵심

좋은 예:

"기본소득제도 근로 의욕 저하 우려가 있다."

==================================================
visualPrompt
==================================================

이 값은 그림 생성용이다.

- 최대 120자
- 글자를 넣으라고 지시하지 말 것
- 그림으로 보여줄 핵심 관계만 설명
- 비교 지문이면 좌우 대비
- 인과 지문이면 원인 → 결과
- 과정 지문이면 단계 변화
- 원문에 없는 정보 추가 금지

좋은 예:

"왼쪽에는 저소득 가구가 심사를 거쳐 부족한 소득을
지원받는 모습, 오른쪽에는 다양한 국민 모두가
정기적으로 현금을 지급받는 모습을 대비해 표현"

==================================================
절대 실패 기준
==================================================

아래 중 하나라도 해당하면 실패다.

- 문장이 길다.
- 원문을 요약 없이 거의 옮겼다.
- 한 칸에 들어가기 어려운 분량이다.
- 같은 내용을 여러 영역에서 반복했다.
- 설명조가 너무 강하다.
- 영어 요약ZIP보다 복잡하다.
- 학생이 한눈에 읽기 어렵다.

==================================================
입력 지문
==================================================

${JSON.stringify(passages, null, 2)}

==================================================
반환 형식
==================================================

JSON만 반환한다.
설명, 해설, 코드블록을 절대 추가하지 않는다.

{
  "summaries": [
    {
      "passageId": "원래 passage id",

      "title": "8~18자",

      "oneLine": "최대 32자",

      "visualPrompt": "최대 120자",

      "flow": [
        {
          "label": "최대 6자",
          "content": "최대 16자"
        }
      ],

      "concepts": [
        {
          "name": "최대 6자",
          "description": "최대 14자"
        }
      ],

      "comparisonTitle": "최대 12자",

      "comparisonHeaders": [
        "구분",
        "A",
        "B"
      ],

      "comparisonRows": [
        [
          "항목",
          "A 핵심",
          "B 핵심"
        ]
      ],

      "testPoints": [
        "최대 18자"
      ],

      "caution": "최대 30자"
    }
  ]
}

다시 강조한다.

이것은 해설지가 아니다.
학생이 시험 직전 보는 비주얼 요약집이다.

짧게 써라.
핵심만 남겨라.
한눈에 읽히게 만들어라.
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

            passageId: String(
              item?.passageId || ""
            ),

            title: String(
              item?.title || ""
            )
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 18),

            oneLine: String(
              item?.oneLine || ""
            )
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 32),

            visualPrompt: String(
              item?.visualPrompt || ""
            )
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 120),

            flow: Array.isArray(
              item?.flow
            )
              ? item.flow
                  .slice(0, 5)
                  .map(
                    (flowItem: any) => ({
                      label: String(
                        flowItem?.label ||
                          ""
                      )
                        .replace(
                          /\s+/g,
                          " "
                        )
                        .trim()
                        .slice(0, 6),

                      content: String(
                        flowItem?.content ||
                          ""
                      )
                        .replace(
                          /\s+/g,
                          " "
                        )
                        .trim()
                        .slice(0, 16),
                    })
                  )
              : [],

            concepts: Array.isArray(
              item?.concepts
            )
              ? item.concepts
                  .slice(0, 5)
                  .map(
                    (
                      concept: any
                    ) => ({
                      name: String(
                        concept?.name || ""
                      )
                        .replace(
                          /\s+/g,
                          " "
                        )
                        .trim()
                        .slice(0, 6),

                      description: String(
                        concept?.description ||
                          ""
                      )
                        .replace(
                          /\s+/g,
                          " "
                        )
                        .trim()
                        .slice(0, 14),
                    })
                  )
              : [],

            comparisonTitle: String(
              item?.comparisonTitle || ""
            )
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 12),

            comparisonHeaders:
              Array.isArray(
                item?.comparisonHeaders
              )
                ? item.comparisonHeaders
                    .slice(0, 3)
                    .map((header: any) =>
                      String(header || "")
                        .replace(
                          /\s+/g,
                          " "
                        )
                        .trim()
                        .slice(0, 8)
                    )
                : [],

            comparisonRows:
              Array.isArray(
                item?.comparisonRows
              )
                ? item.comparisonRows
                    .slice(0, 4)
                    .map(
                      (row: any) =>
                        Array.isArray(row)
                          ? row
                              .slice(0, 3)
                              .map(
                                (
                                  cell: any
                                ) =>
                                  String(
                                    cell ||
                                      ""
                                  )
                                    .replace(
                                      /\s+/g,
                                      " "
                                    )
                                    .trim()
                                    .slice(
                                      0,
                                      12
                                    )
                              )
                          : []
                    )
                : [],

            testPoints:
              Array.isArray(
                item?.testPoints
              )
                ? item.testPoints
                    .slice(0, 3)
                    .map(
                      (point: any) =>
                        String(
                          point || ""
                        )
                          .replace(
                            /\s+/g,
                            " "
                          )
                          .trim()
                          .slice(0, 18)
                    )
                : [],

            caution: String(
              item?.caution || ""
            )
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 30),
          })
        )
      : [];

    return Response.json({
      summaries,
    });
  } catch (error) {
    console.error(
      "KOREAN SUMMARY GENERATION ERROR:",
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