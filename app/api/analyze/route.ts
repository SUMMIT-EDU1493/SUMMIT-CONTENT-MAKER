import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const body = await request.json();
    const text = body.text;

    if (!text) {
      return Response.json(
        { error: "분석할 텍스트가 없습니다." },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: `
아래는 영어 교재 PDF에서 추출한 텍스트다.

목표:
오직 "대화문"만 찾아서 추출한다.

규칙:
- 본문 독해, 문법 설명, 단어 목록은 제외
- 실제 인물 간 대화 형식만 추출
- 대화문이 여러 개면 각각 분리
- 원문 영어는 가능한 그대로 유지
- 각 대화문에 짧은 한글 제목을 붙인다
- JSON만 출력
- 설명문이나 마크다운 금지

형식:
{
  "dialogues": [
    {
      "title": "짧은 한글 제목",
      "content": "대화문 원문"
    }
  ]
}

교재 텍스트:
${text}
`,
    });

    const raw = response.output_text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(raw);

    return Response.json(parsed);
  } catch (error: any) {
    console.error("ANALYZE ERROR:", error);

    return Response.json(
      {
        error: "교재 분석 중 오류가 발생했습니다.",
        detail: error?.message || "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}