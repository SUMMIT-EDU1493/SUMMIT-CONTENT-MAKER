import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const title = body.title;
    const content = body.content;

    if (!content || typeof content !== "string") {
      return Response.json(
        { error: "대화문 내용이 없습니다." },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: `
아래 영어 대화문을 바탕으로 학습용 가로형 4컷 만화 설계안을 만들어라.

목표:
- 학생들이 읽기 쉽게 4컷 학습만화로 만들기 위한 설계안 작성
- 컷별 장면 설명, 등장인물, 영어 대사, 자연스러운 한글 뜻 포함
- 핵심표현과 주요단어도 함께 정리

반드시 아래 JSON 형식으로만 출력하라.

{
  "title": "대화문 제목",
  "summary": "대화문 한 줄 요약",
  "panels": [
    {
      "cut": "1컷",
      "scene": "장면 설명",
      "characters": "등장인물",
      "english": "영어 대사",
      "korean": "한글 뜻"
    },
    {
      "cut": "2컷",
      "scene": "장면 설명",
      "characters": "등장인물",
      "english": "영어 대사",
      "korean": "한글 뜻"
    },
    {
      "cut": "3컷",
      "scene": "장면 설명",
      "characters": "등장인물",
      "english": "영어 대사",
      "korean": "한글 뜻"
    },
    {
      "cut": "4컷",
      "scene": "장면 설명",
      "characters": "등장인물",
      "english": "영어 대사",
      "korean": "한글 뜻"
    }
  ],
  "keyExpressions": [
    {
      "english": "핵심표현",
      "korean": "한글 뜻"
    }
  ],
  "keyWords": [
    {
      "english": "주요단어",
      "korean": "한글 뜻"
    }
  ]
}

규칙:
- 대화문 흐름이 자연스럽게 4컷으로 이어지게 나눌 것
- 영어 원문은 가능한 유지할 것
- 한글 뜻은 학생용으로 자연스럽게 쓸 것
- 장면 설명은 실제 만화 그림을 만들기 좋게 구체적으로 쓸 것
- 핵심표현 3~6개
- 주요단어 5~10개
- JSON 외의 설명은 쓰지 말 것

대화문 제목:
${title || "대화문"}

대화문 내용:
${content}
      `,
    });

    const raw = response.output_text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(raw);

    return Response.json(parsed);
  } catch (error: any) {
    console.error("COMIC PLAN ERROR:", error);

    return Response.json(
      {
        error: "써밋네컷 설계안 생성 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          error?.error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}