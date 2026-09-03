import OpenAI from "openai";

export const runtime = "nodejs";

type RequestBody = {
  schoolName?: string;
  gradeName?: string;
  lessonName?: string;
  sourceText?: string;
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되어 있지 않아." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as RequestBody;

    const sourceText = body.sourceText?.trim() || "";

    if (!sourceText) {
      return Response.json(
        { error: "분석할 본문이 없어." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
너는 고등학교 영어 본문을
'시험 직전 한눈에 복습하는 시각형 요약집'으로 설계하는 편집자다.

다음 영어 본문을 원문의 흐름과 의미 순서를 유지하면서
4~6개의 핵심 의미 블록으로 나눠라.

이 요약집의 목적은:
- 줄거리 요약이 아니라 본문의 논리 구조 파악
- 시험 직전 빠른 복습
- 핵심 개념과 사례 연결
- 중요 영어 표현 암기
이다.

━━━━━━━━━━━━━━━━━━━━
학교
━━━━━━━━━━━━━━━━━━━━
${body.schoolName || ""}

학년
${body.gradeName || ""}

Lesson
${body.lessonName || ""}

━━━━━━━━━━━━━━━━━━━━
반드시 지켜야 할 규칙
━━━━━━━━━━━━━━━━━━━━

1. 원문의 순서를 절대 바꾸지 않는다.

2. 단순히 문단 수대로 자르지 말고
'하나의 핵심 의미가 완성되는 단위'로 나눈다.

3. 전체 페이지 수는 4~6장.

4. 각 페이지에는 반드시 다음이 있어야 한다.

- englishTitle
  짧은 영어 핵심 제목

- koreanTitle
  학생이 바로 이해할 수 있는 한국어 제목

- oneLineSummary
  해당 부분의 핵심을 한 문장으로 요약

- keyPoints
  반드시 기억해야 할 핵심 내용 3~5개

- keyWords
  중요 어휘/표현 3~6개
  형식:
  한국어 뜻(English)

- sourceRange
  원문의 어느 부분을 다루는지 간단히 설명

- visualType
  아래 중 가장 적합한 하나 선택

  FLOW
  COMPARE
  CAUSE_EFFECT
  TIMELINE
  CONCEPT
  PERSON_STORY
  PROCESS

- visualIdea
  이 페이지를 어떻게 한눈에 보이게 만들지
  한국어로 짧고 구체적으로 설명

5. keyPoints는 긴 문장 금지.
시험 직전 볼 수 있게 짧고 압축한다.

6. 단순 번역 금지.
'이 부분이 왜 중요한지'가 드러나게 정리한다.

7. 원문에 없는 사실은 추가하지 않는다.

8. 사람이나 실제 사례 중심이면 PERSON_STORY,
과정이면 PROCESS 또는 FLOW,
A/B 차이면 COMPARE,
원인→결과면 CAUSE_EFFECT를 적극 활용한다.

9. 모든 페이지를 똑같은 레이아웃으로 만들지 않는다.
내용에 가장 맞는 구조를 선택한다.

━━━━━━━━━━━━━━━━━━━━
출력 형식
━━━━━━━━━━━━━━━━━━━━

JSON만 출력한다.

{
  "overallTitle": "전체 Lesson 핵심 제목",
  "overallSummary": "Lesson 전체를 관통하는 핵심 내용 1~2문장",
  "pageCount": 5,
  "pages": [
    {
      "id": "summary-1",
      "englishTitle": "",
      "koreanTitle": "",
      "oneLineSummary": "",
      "keyPoints": [
        "",
        "",
        ""
      ],
      "keyWords": [
        "한국어 뜻(English)"
      ],
      "sourceRange": "",
      "visualType": "FLOW",
      "visualIdea": ""
    }
  ]
}

━━━━━━━━━━━━━━━━━━━━
본문
━━━━━━━━━━━━━━━━━━━━

${sourceText}
`;

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: prompt,
    });

    let output = response.output_text?.trim() || "";

    // ```json ... ``` 제거
    output = output
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let result;

    try {
      result = JSON.parse(output);
    } catch {
      console.error(
        "HIGH SUMMARY JSON PARSE ERROR:",
        output
      );

      return Response.json(
        {
          error: "요약집 계획 JSON 변환에 실패했어.",
          raw: output,
        },
        { status: 500 }
      );
    }

    if (
      !Array.isArray(result?.pages) ||
      result.pages.length === 0
    ) {
      return Response.json(
        {
          error: "요약집 페이지 계획이 생성되지 않았어.",
        },
        { status: 500 }
      );
    }

    return Response.json(result);
  } catch (error: any) {
    console.error(
      "HIGH SUMMARY PLAN ERROR:",
      error
    );

    return Response.json(
      {
        error: "고등 요약집 계획 생성 중 오류가 생겼어.",
        detail: error?.message || "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}