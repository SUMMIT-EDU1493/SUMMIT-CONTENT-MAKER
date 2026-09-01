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
    const { title, content } = body;

    if (!content) {
      return Response.json(
        { error: "대화문 내용이 없습니다." },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: `
아래 영어 대화문을 바탕으로 한국 중학생용 "써밋네컷" 설계안을 만들어라.

이것은 번역본이 아니라, 원문의 핵심 의미를 살린 자연스러운 4컷 만화다.

가장 중요한 규칙:

1. 등장인물은 친구 또는 같은 또래 학생이다.
2. 한국어 대사는 반드시 자연스러운 반말만 사용한다.
3. "~요", "~습니다", "~네요" 같은 존댓말 금지.
4. 번역투 금지.
5. 실제 친구들이 말할 법한 짧고 자연스러운 말투를 사용한다.
6. 어색한 표현을 절대 만들지 않는다.

나쁜 예:
"너면 꼭 될 거야."
"정말 좋네요."
"저는 당신이 훌륭한 선수가 될 수 있다고 확신해요."

좋은 예:
"넌 꼭 될 거야!"
"대박이다!"
"와, 진짜?"
"너한테 딱인데?"
"넌 분명 훌륭한 선수가 될 거야!"
"같이 해보자!"

영어 학습 요소:
- 원문에서 중요한 단어나 표현 4~6개 선정
- 반드시 한국어 뜻 바로 뒤에 괄호로 영어를 붙인다
- 예: 성격(personality), 직업(job), 계획(plan)
- 영어만 문장 끝에 따로 넣지 않는다
- 반드시 해당 한국어 단어 바로 뒤에 붙인다

한줄요약:
- 만화 상단 제목으로 사용할 짧은 한글 주제
- 8~18자 정도
- 예: "성격 유형과 직업"

화자 정보:
- 각 대사는 누가 말하는지 반드시 명확히 표시한다
- speaker 필드에 화자 이름 또는 인물 구분을 적는다
- 한 컷에 두 명이 말하면 dialogue 배열에 각각 따로 넣는다

JSON만 출력:

{
  "title": "${title || "써밋네컷"}",
  "summary": "짧은 한글 한줄요약",
  "panels": [
    {
      "cut": "1컷",
      "scene": "",
      "characters": "",
      "dialogue": [
        {
          "speaker": "",
          "text": ""
        }
      ]
    },
    {
      "cut": "2컷",
      "scene": "",
      "characters": "",
      "dialogue": [
        {
          "speaker": "",
          "text": ""
        }
      ]
    },
    {
      "cut": "3컷",
      "scene": "",
      "characters": "",
      "dialogue": [
        {
          "speaker": "",
          "text": ""
        }
      ]
    },
    {
      "cut": "4컷",
      "scene": "",
      "characters": "",
      "dialogue": [
        {
          "speaker": "",
          "text": ""
        }
      ]
    }
  ]
}

원문 대화:
${content}
`,
    });

    const raw = response.output_text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(raw);

    return Response.json(parsed);
  } catch (error: any) {
    console.error("COMIC PLAN ERROR:", error);

    return Response.json(
      {
        error: "써밋네컷 설계안 생성 중 오류가 발생했습니다.",
        detail: error?.message || "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}