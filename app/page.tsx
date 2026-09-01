import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = body.text;

    if (!text || typeof text !== "string") {
      return Response.json(
        { error: "분석할 텍스트가 없습니다." },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: `
아래는 영어 교재 PDF에서 추출한 전체 텍스트다.

이 텍스트를 분석해서 다음 항목으로 분류해라.

1. 대화문
2. 본문
3. 문법
4. 주요 표현
5. 주요 단어

특히 대화문은 서로 다른 대화가 여러 개 있다면 각각 따로 분리해라.

반드시 아래 JSON 형식으로만 답해라.

{
  "dialogues": [
    {
      "title": "대화문 제목 또는 주제",
      "content": "대화문 전체 원문"
    }
  ],
  "reading": [
    {
      "title": "본문 제목",
      "content": "본문 내용"
    }
  ],
  "grammar": [
    {
      "title": "문법 항목",
      "content": "문법 설명"
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
      "english": "단어",
      "korean": "한글 뜻"
    }
  ]
}

교재에 없는 내용을 임의로 만들어내지 마라.

PDF 텍스트:
${text}
      `,
    });

    const output = response.output_text;

    let parsed;

    try {
      parsed = JSON.parse(output);
    } catch {
      return Response.json(
        {
          error: "AI 응답을 JSON으로 읽지 못했습니다.",
          raw: output,
        },
        { status: 500 }
      );
    }

    return Response.json(parsed);
  } catch (error) {
    console.error("ANALYZE ERROR:", error);

    return Response.json(
      {
        error: "AI 분석 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}