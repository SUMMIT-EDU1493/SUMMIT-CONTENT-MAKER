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

중요:
이것은 영어 원문 번역본이 아니다.
원문의 핵심 내용을 살려 4컷 만화용으로 자연스럽게 재구성해야 한다.

대화 관계:
- 기본적으로 친구 또는 같은 또래 학생끼리의 대화
- 한국어 대사는 자연스러운 반말
- "~요", "~습니다" 같은 존댓말 금지
- 번역투 금지
- 실제 친구들이 말할 법하게 짧고 생생하게

예:
"정말 좋네요. 저는 당신이 훌륭한 축구선수가 될 수 있다고 확신해요."
→
"대박이다! 넌 꼭 훌륭한 축구선수가 될 거야!"

영어 학습 요소:
- 원문에서 중요한 단어나 표현 4~6개 정도 선정
- 반드시 한국어 뜻 바로 뒤에 괄호로 영어를 붙이는 방식
- 예: 직업(job), 성격(personality), 계획(plan)
- 문장 끝에 영어만 따로 괄호로 넣지 말 것
- 해당 한국어 단어 바로 뒤에 넣을 것

한줄요약:
- 만화 맨 위 제목처럼 쓸 짧은 한글 주제
- 8~18자 정도
- 예: "성격 유형과 직업"
- 교재 제목처럼 깔끔하게

4컷:
- 4개의 장면으로 분리
- 장면 설명은 그림 생성이 가능하도록 구체적
- 등장인물 외모/옷은 4컷에서 일관성 있게 유지할 수 있도록 설명
- 각 컷 한국어 대사는 1~2개 정도
- 길게 쓰지 말 것

JSON만 출력:

{
  "title": "${title || "써밋네컷"}",
  "summary": "짧은 한글 한줄요약",
  "panels": [
    {
      "cut": "1컷",
      "scene": "",
      "characters": "",
      "korean": ""
    },
    {
      "cut": "2컷",
      "scene": "",
      "characters": "",
      "korean": ""
    },
    {
      "cut": "3컷",
      "scene": "",
      "characters": "",
      "korean": ""
    },
    {
      "cut": "4컷",
      "scene": "",
      "characters": "",
      "korean": ""
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