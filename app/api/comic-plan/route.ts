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

    if (!content || typeof content !== "string") {
      return Response.json(
        { error: "대화문 내용이 없습니다." },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: `
아래 영어 대화문을 바탕으로 한국 중학생용 "써밋네컷" 설계안을 만들어라.

이 작업의 목표:
- 영어 대화문을 4컷 만화용으로 자연스럽게 재구성
- 한국 학생들이 읽기 쉬운 말투로 구성
- 번역문처럼 딱딱하지 않고, 실제 친구들 대화처럼 생생하게 만들기

가장 중요한 규칙:

[말투 규칙]
1. 등장인물은 기본적으로 친구, 같은 반 학생, 또래 청소년이다.
2. 한국어 대사는 반드시 자연스러운 반말만 사용한다.
3. "~요", "~습니다", "~네요", "~해요" 같은 존댓말은 절대 금지한다.
4. 번역투 표현을 금지한다.
5. 실제 만화 대사처럼 짧고 리듬감 있게 만든다.
6. 너무 교과서 해석처럼 길게 설명하지 않는다.
7. 어색한 표현은 금지한다.

[말투 예시]
나쁜 예:
- "정말 좋네요."
- "저는 당신이 훌륭한 축구선수가 될 수 있다고 확신해요."
- "너면 꼭 될 거야."

좋은 예:
- "대박이다!"
- "와, 진짜?"
- "넌 꼭 훌륭한 축구선수가 될 거야!"
- "너한테 딱이다!"
- "같이 해보자!"
- "완전 잘 어울리는데?"

[영어 학습 요소 규칙]
1. 원문에서 중요한 단어나 표현 4~6개 정도를 골라 자연스럽게 대사에 녹인다.
2. 영어는 반드시 한국어 단어 바로 뒤에 괄호로 붙인다.
3. 형식은 반드시 "한글(English)" 이다.
4. 예:
   - 성격(personality)
   - 직업(job)
   - 계획(plan)
   - 자신감(confidence)
5. 영어만 문장 끝에 따로 붙이지 않는다.
6. 한국어와 영어를 줄바꿈해서 분리하지 않는다.
7. 풀 영어 문장을 그대로 길게 넣지 않는다.
8. 영어는 꼭 필요한 핵심 단어/표현만 자연스럽게 삽입한다.

[구성 규칙]
1. 반드시 4컷으로 나눈다.
2. 각 컷은 장면 흐름이 자연스럽게 이어져야 한다.
3. 각 컷의 대사는 1~2개 정도로 짧게 한다.
4. 그림 생성이 가능하도록 장면 설명은 구체적으로 쓴다.
5. 등장인물의 외모, 복장, 분위기는 4컷 동안 일관되게 유지할 수 있도록 작성한다.
6. summary는 만화 상단 제목으로 들어갈 짧은 한글 한줄요약이다.
7. summary는 8~18자 정도로, 깔끔한 교재 제목 느낌으로 만든다.
8. 예:
   - 성격 유형과 직업
   - 장래희망과 재능
   - 꿈과 적성 찾기

[화자 규칙]
1. 각 대사는 누가 말하는지 반드시 표시한다.
2. dialogue는 배열로 만들고, 각 원소에 speaker와 text를 넣는다.
3. 화자 이름은 너무 복잡하지 않게 쓴다.
4. 예:
   - "민지"
   - "준호"
   - "여학생"
   - "남학생"
5. 한 컷에서 두 사람이 말하면 dialogue 배열에 따로 나눠 쓴다.

[출력 형식]
반드시 JSON만 출력한다.
설명문, 마크다운, 코드블록은 금지한다.

형식:
{
  "title": "${title || "써밋네컷"}",
  "summary": "짧은 한글 한줄요약",
  "panels": [
    {
      "cut": "1컷",
      "scene": "그림을 그릴 수 있을 정도로 구체적인 장면 설명",
      "characters": "등장인물 설명",
      "dialogue": [
        {
          "speaker": "화자",
          "text": "대사"
        }
      ]
    },
    {
      "cut": "2컷",
      "scene": "그림을 그릴 수 있을 정도로 구체적인 장면 설명",
      "characters": "등장인물 설명",
      "dialogue": [
        {
          "speaker": "화자",
          "text": "대사"
        }
      ]
    },
    {
      "cut": "3컷",
      "scene": "그림을 그릴 수 있을 정도로 구체적인 장면 설명",
      "characters": "등장인물 설명",
      "dialogue": [
        {
          "speaker": "화자",
          "text": "대사"
        }
      ]
    },
    {
      "cut": "4컷",
      "scene": "그림을 그릴 수 있을 정도로 구체적인 장면 설명",
      "characters": "등장인물 설명",
      "dialogue": [
        {
          "speaker": "화자",
          "text": "대사"
        }
      ]
    }
  ]
}

원문 대화문:
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