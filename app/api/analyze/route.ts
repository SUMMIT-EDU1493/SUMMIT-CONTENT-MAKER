import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const text = body.text;

    if (!text || typeof text !== "string") {
      return Response.json(
        { error: "분석할 PDF 텍스트가 없습니다." },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: `
아래 내용은 영어 교재 PDF에서 추출한 전체 텍스트다.

내용을 분석해서 다음 항목으로 정확히 분류하라.

1. 대화문
2. 본문
3. 문법
4. 핵심 표현
5. 주요 단어

규칙:
- 서로 다른 대화문이 여러 개라면 각각 분리한다.
- 교재에 없는 내용을 임의로 만들지 않는다.
- 영어 원문은 가능한 한 그대로 유지한다.
- 핵심 표현과 주요 단어에는 자연스러운 한국어 뜻을 붙인다.
- 반드시 JSON만 출력한다.
- 코드블록이나 설명은 붙이지 않는다.

반드시 아래 구조로 응답한다.

{
  "dialogues": [
    {
      "title": "대화문의 제목 또는 주제",
      "content": "대화문 전체 원문"
    }
  ],
  "reading": [
    {
      "title": "본문 제목",
      "content": "본문 전체 내용"
    }
  ],
  "grammar": [
    {
      "title": "문법 항목",
      "content": "문법 내용"
    }
  ],
  "keyExpressions": [
    {
      "english": "핵심 영어 표현",
      "korean": "한글 뜻"
    }
  ],
  "keyWords": [
    {
      "english": "영어 단어",
      "korean": "한글 뜻"
    }
  ]
}

PDF 내용:
${text}
      `,
    });

    const raw = response.output_text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    try {
      const parsed = JSON.parse(raw);
      return Response.json(parsed);
    } catch {
      return Response.json(
        {
          error: "AI 분석은 완료됐지만 결과 형식을 읽지 못했습니다.",
          detail: raw.slice(0, 1000),
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("OPENAI ANALYZE ERROR:", error);

    return Response.json(
      {
        error: "OpenAI API 호출에 실패했습니다.",
        detail:
          error?.message ||
          error?.error?.message ||
          "알 수 없는 오류",
        code: error?.code || "",
        status: error?.status || "",
      },
      { status: 500 }
    );
  }
}