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

    if (!text || typeof text !== "string") {
      return Response.json(
        { error: "분석할 교재 텍스트가 없습니다." },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: `
아래는 중학교 영어 교과서 PDF에서 추출한 텍스트다.

목표:
교재 안에서 아래 5개 학습 코너의 대화문만 찾아서 추출한다.

찾아야 할 코너:
1. Listen and Talk 1
2. Listen and Talk 2
3. Listen & Write 1
4. Listen & Write 2
5. Real Life Talk

매우 중요한 규칙:
- 위 5개 코너 외의 다른 대화문은 추출하지 않는다.
- 본문 읽기, 문법, 단어, 활동 문제, 보기 문장 등은 제외한다.
- 코너명이 약간 다르게 표기되어 있어도 의미상 같은 코너면 찾아낸다.
- 예: Listen and Talk / Listen & Talk 같은 표기 차이는 허용한다.
- 각 코너의 실제 영어 대화 내용만 추출한다.
- 문제 지시문, 번호, 선택지, 정답 설명은 가능한 한 제외한다.
- 원문 영어 대화 순서는 그대로 유지한다.
- 영어 문장은 가능한 한 원문 그대로 보존한다.
- 해당 코너가 교재에 없으면 content를 빈 문자열로 둔다.
- 절대 없는 내용을 만들어내지 않는다.

반드시 아래 JSON 형식만 출력한다:

{
  "sections": [
    {
      "key": "listen-talk-1",
      "title": "Listen and Talk 1",
      "content": ""
    },
    {
      "key": "listen-talk-2",
      "title": "Listen and Talk 2",
      "content": ""
    },
    {
      "key": "listen-write-1",
      "title": "Listen & Write 1",
      "content": ""
    },
    {
      "key": "listen-write-2",
      "title": "Listen & Write 2",
      "content": ""
    },
    {
      "key": "real-life-talk",
      "title": "Real Life Talk",
      "content": ""
    }
  ]
}

교재 텍스트:
${text}
`,
    });

    const raw = response.output_text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(raw);

    return Response.json(parsed);
  } catch (error: any) {
    console.error("ANALYZE ERROR:", error);

    return Response.json(
      {
        error: "교재 분석 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          error?.error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}