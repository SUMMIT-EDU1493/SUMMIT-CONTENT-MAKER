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
아래 교재 대화문을 바탕으로 한국 중학생용 "써밋네컷" 설계안을 만들어라.

목표:
- 이것은 교과서 번역지가 아니라 내용 이해용 4컷 만화다.
- 영어 원문의 핵심 상황과 의미를 유지한다.
- 한국어는 실제 중학생 친구들이 말할 법한 자연스러운 반말로 새로 만든다.

[원문 사용]
1. 영어 원문의 의미와 상황만 참고한다.
2. 한국어 번역문이나 해석이 포함되어 있어도 참고하지 않는다.
3. 영어 문장 구조를 그대로 한국어로 직역하지 않는다.
4. 모든 문장을 다 옮길 필요는 없다.
5. 핵심 내용만 선별하되 원래 의미는 바꾸지 않는다.

[대화 순서 보존 - 매우 중요]
1. 원문 영어 대화의 앞뒤 순서를 절대 변경하지 않는다.
2. 질문 → 대답 → 추가 질문 → 결론의 흐름을 유지한다.
3. 뒤에 나온 정보를 앞 컷으로 옮기지 않는다.
4. 앞의 내용을 뒤로 보내지 않는다.
5. 문장을 생략하거나 자연스럽게 의역할 수는 있지만 남은 내용 순서는 원문과 같아야 한다.
6. 중등 영어 대화 순서 문제 대비를 위해 임의 재배열은 금지한다.
7. 1컷은 원문 앞부분, 2컷은 그다음, 3컷은 그다음, 4컷은 마지막 흐름을 담당한다.

[한국어 대사]
1. 반드시 자연스러운 반말.
2. 존댓말 금지.
3. 번역투 금지.
4. 설명문이나 교과서 해석 같은 말투 금지.
5. 짧고 생생한 만화 대사로 만든다.
6. 실제 입으로 말했을 때 어색한 문장은 만들지 않는다.

금지 예:
- "너라면 진짜 될 거야."
- "너면 꼭 될 거야."
- "추천직업이 실용적인 편이야."
- "나는 네가 성공할 수 있다고 확신해."
- "그것은 좋은 선택인 것 같아."

좋은 예:
- "오, 이거 너한테 딱인데?"
- "넌 진짜 잘할 것 같아!"
- "와, 이 직업(job) 괜찮다!"
- "네 성격(personality)이랑 잘 맞네."
- "대박! 나 이런 거 좋아해!"
- "그럼 이쪽이 더 잘 맞겠다!"

[영어 삽입 - 절대 필수]
1. 전체 4컷을 합쳐 반드시 4~6개의 핵심 영어 단어 또는 짧은 표현을 넣는다.
2. 영어는 반드시 해당 한국어 뜻 바로 뒤에 괄호로 붙인다.
3. 형식은 반드시 한글(English)이다.
4. 예:
   흥미(interest)
   성격(personality)
   직업(job)
   현실적(realistic)
   자신감(confidence)
5. 영어 단어를 문장 끝에 따로 괄호로 붙이지 않는다.
6. 한국어와 영어를 다른 줄로 나누지 않는다.
7. 최소 3개의 서로 다른 컷에 한글(English) 표현이 하나 이상 들어가야 한다.
8. 4컷 전체에 영어 단어가 하나도 없거나 1~2개뿐인 결과는 허용하지 않는다.
9. 단, 억지로 어색하게 넣지 말고 자연스러운 문장 안에 녹인다.
10. 출력 전에 반드시 영어 항목 개수를 세어 4~6개인지 확인한다.

[4컷 구성]
1. 정확히 4컷.
2. 각 컷은 자연스럽게 이어진다.
3. 한 컷 대사는 1~2개 정도.
4. 등장인물 외모와 옷은 4컷 내내 일관되게 유지한다.
5. 누가 질문하고 누가 대답하는지 scene에 분명하게 적는다.

[표정과 행동]
1. 질문하는 사람은 질문하는 표정.
2. 대답하는 사람은 대답하는 표정.
3. 기호나 반짝이 사용은 가능하지만 감정 주체가 명확해야 한다.

[화자]
각 대사는 speaker와 text로 분리한다.

[한줄요약]
summary는 만화 상단에 들어갈 짧은 한글 제목이다.
8~18자 정도로 작성한다.

[최종 검사]
출력 직전에 반드시 확인한다.
- 대화 순서가 원문과 같은가?
- 한국어가 자연스러운 반말인가?
- 번역투가 없는가?
- 영어 학습 요소가 총 4~6개인가?
- 최소 3컷에 한글(English)이 들어갔는가?

하나라도 만족하지 않으면 수정한 뒤 출력한다.

반드시 JSON만 출력한다.

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

교재에서 추출된 내용:
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