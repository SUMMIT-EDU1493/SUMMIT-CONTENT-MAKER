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
        { error: "OPENAI_API_KEY가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const body = await req.json();

    const passages: Passage[] = Array.isArray(body?.passages)
      ? body.passages
      : [];

    if (passages.length === 0) {
      return Response.json(
        { error: "선택된 국어 지문이 없습니다." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const prompt = `
당신은 대한민국 고등학교 국어 비문학 수업자료 전문 편집자입니다.

아래 지문을 학생들이 시험 직전에 빠르게 복습할 수 있는
'요약.ZIP' 형태로 정리하세요.

중요:
단순 요약문을 만드는 것이 아닙니다.
글의 논리 구조와 시험에서 묻기 좋은 관계를 시각적으로 정리할 수 있는 데이터를 만듭니다.

[선택 지문]

${JSON.stringify(passages, null, 2)}

==================================================
요약 기준
==================================================

1. oneLine
- 지문 전체 핵심을 한 문장으로 정리
- 지나치게 길지 않게

2. flow
- 글의 전개를 3~6단계로 나눔
- label은 "문제 제기", "개념 설명", "원리", "대안", "한계", "결론" 등의 기능
- content는 해당 단계의 핵심

3. concepts
- 반드시 알아야 할 개념만 추출
- 지문에 없는 지식 추가 금지
- 정의와 역할을 간단히 설명

4. comparison
- 지문에 비교·대조되는 대상이 있으면 표로 정리
- 예:
  최저소득보장제 vs 기본소득제
  육식동물 vs 초식동물
- 비교할 대상이 없다면 빈 배열 사용

5. testPoints
- 실제 시험에서 확인할 만한 핵심 관계
- 인과관계
- 비교·대조
- 개념 정의
- 사례의 역할
- 결론
위주로 3~5개 작성

6. caution
- 학생이 혼동하기 쉬운 핵심 포인트 1개
- 지문에 근거해서만 작성

7. 사실 정확성이 최우선
- 원문에 없는 내용을 절대 추가하지 마세요.
- 원문의 입장을 과장하지 마세요.
- 논설문이라면 찬반 여부를 임의로 단정하지 마세요.

8. visualPrompt
- 이 지문의 핵심 내용을 그림 하나로 이해할 수 있게 장면을 설명한다.
- 비교 지문이면 좌우 대비가 보이게 한다.
- 원인과 결과가 있으면 흐름이 보이게 한다.
- 그림 안에 글자를 넣도록 요구하지 않는다.
- 지문에 없는 내용은 추가하지 않는다.

==================================================
반환 형식
==================================================

JSON만 반환하세요.

{
  "summaries": [
    {
      "passageId": "원래 passage id",
      "title": "요약 제목",
      "oneLine": "핵심 한 줄",
"visualPrompt": "이 지문의 핵심 관계를 그림으로 보여주는 장면 설명",
      "flow": [
        {
          "label": "문제 제기",
          "content": "내용"
        }
      ],

      "concepts": [
        {
          "name": "개념",
          "description": "설명"
        }
      ],

      "comparisonTitle": "핵심 비교",
      "comparisonHeaders": [
        "구분",
        "A",
        "B"
      ],

      "comparisonRows": [
        [
          "특징",
          "A의 특징",
          "B의 특징"
        ]
      ],

      "testPoints": [
        "시험 포인트"
      ],

      "caution": "헷갈리기 쉬운 포인트"
    }
  ]
}
`;

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: prompt,
    });

    const raw = response.output_text?.trim();

    if (!raw) {
      throw new Error("요약.ZIP 결과가 없습니다.");
    }

    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return Response.json({
      summaries: Array.isArray(parsed?.summaries)
        ? parsed.summaries
        : [],
    });
  } catch (error) {
    console.error("Korean summary generation error:", error);

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