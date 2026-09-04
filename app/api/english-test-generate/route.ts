import OpenAI from "openai";

type Passage = {
  id: string;
  title: string;
  source: string;
};

type QuestionRequest = {
  type: string;
  count: number;
};

type PreviousQuestion = {
  passageId?: string;
  type?: string;
  stem?: string;
  answer?: string;
  keyPoint?: string;
};

type QuestionPlan = {
  passageId: string;
  passageTitle: string;
  type: string;
  difficulty: string;
};

type GeneratedQuestion = {
  passageId: string;
  passageTitle: string;
  type: string;
  difficulty: string;
  stem: string;
  passage: string;
  choices: string[];
  answer: string;
  explanation: string;
  keyPoint: string;
};

function shuffle<T>(items: T[]): T[] {
  const copied = [...items];

  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));

    [copied[i], copied[j]] = [copied[j], copied[i]];
  }

  return copied;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error: "OPENAI_API_KEY가 설정되어 있지 않습니다.",
        },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey,
    });

    const body = await req.json();

    const passages: Passage[] = Array.isArray(body?.passages)
      ? body.passages
      : [];

    const questionRequests: QuestionRequest[] = Array.isArray(
      body?.questionRequests
    )
      ? body.questionRequests
      : [];

    const difficulties: string[] =
      Array.isArray(body?.difficulties) && body.difficulties.length > 0
        ? body.difficulties
        : ["기본"];

    const previousQuestions: PreviousQuestion[] = Array.isArray(
      body?.previousQuestions
    )
      ? body.previousQuestions
      : [];

    if (passages.length === 0) {
      return Response.json(
        {
          error: "선택된 영어 지문이 없습니다.",
        },
        { status: 400 }
      );
    }

    if (questionRequests.length === 0) {
      return Response.json(
        {
          error: "선택된 문제 유형이 없습니다.",
        },
        { status: 400 }
      );
    }

    const cleanPassages = passages.filter(
      (item) =>
        typeof item?.id === "string" &&
        typeof item?.title === "string" &&
        typeof item?.source === "string" &&
        item.source.trim().length > 50
    );

    if (cleanPassages.length === 0) {
      return Response.json(
        {
          error: "사용 가능한 영어 지문이 없습니다.",
        },
        { status: 400 }
      );
    }

    /*
     * 출제 계획 생성
     *
     * 예:
     * 주제·제목 2개
     * 어법 3개
     * 빈칸 1개
     *
     * → 총 6개의 계획을 만든 뒤
     *   지문 / 유형 / 난이도를 섞어서 배치
     */

    const expandedTypes: string[] = [];

    for (const request of questionRequests) {
      const type =
        typeof request?.type === "string"
          ? request.type.trim()
          : "";

      const count = Number(request?.count || 0);

      if (!type || count <= 0) continue;

      for (let i = 0; i < Math.min(count, 20); i += 1) {
        expandedTypes.push(type);
      }
    }

    if (expandedTypes.length === 0) {
      return Response.json(
        {
          error: "생성할 문제 수가 0개입니다.",
        },
        { status: 400 }
      );
    }

    if (expandedTypes.length > 40) {
      return Response.json(
        {
          error: "한 번에 최대 40문항까지 생성할 수 있습니다.",
        },
        { status: 400 }
      );
    }

    const shuffledTypes = shuffle(expandedTypes);
    const shuffledPassages = shuffle(cleanPassages);

    const plans: QuestionPlan[] = shuffledTypes.map(
      (type, index) => {
        const passage =
          shuffledPassages[index % shuffledPassages.length];

        const difficulty =
          difficulties[
            Math.floor(Math.random() * difficulties.length)
          ];

        return {
          passageId: passage.id,
          passageTitle: passage.title,
          type,
          difficulty,
        };
      }
    );

    /*
     * 연속해서 같은 지문이 붙는 것을 조금 줄이기 위해
     * 한 번 더 재정렬
     */
    const mixedPlans = [...plans];

    for (let i = 1; i < mixedPlans.length; i += 1) {
      if (
        mixedPlans.length > 2 &&
        mixedPlans[i].passageId === mixedPlans[i - 1].passageId
      ) {
        const swapIndex = mixedPlans.findIndex(
          (item, index) =>
            index > i &&
            item.passageId !== mixedPlans[i - 1].passageId
        );

        if (swapIndex > i) {
          [mixedPlans[i], mixedPlans[swapIndex]] = [
            mixedPlans[swapIndex],
            mixedPlans[i],
          ];
        }
      }
    }

    const passageData = cleanPassages.map((passage) => ({
      id: passage.id,
      title: passage.title,
      source: passage.source,
    }));

    const previousHistory = previousQuestions.slice(-100);

    const prompt = `
당신은 대한민국 고등학교 영어 내신 및 모의고사 변형문제를 제작하는 전문 출제자입니다.

사용자가 제공한 영어 지문을 바탕으로 실제 시험에서 사용할 수 있는 변형문제를 제작하세요.

━━━━━━━━━━━━━━━━━━━━
[가장 중요한 원칙]
━━━━━━━━━━━━━━━━━━━━

1. 반드시 제공된 영어 지문 내용만 근거로 문제를 만드세요.
2. 지문에 없는 사실을 임의로 추가하지 마세요.
3. 문제마다 출제 포인트를 다르게 하세요.
4. 같은 지문에서 여러 문제가 출제되어도 같은 문장이나 같은 근거만 반복하지 마세요.
5. 기존 출제 이력이 제공된 경우, 이전 문제와 발문·정답 근거·핵심 포인트가 겹치지 않도록 새롭게 출제하세요.
6. 단순히 단어나 표현만 바꾼 사실상 동일한 문제는 만들지 마세요.
7. 객관식 문제는 정답이 명확하게 하나만 존재해야 합니다.
8. 객관식은 원칙적으로 5지선다입니다.
9. 오답 선지는 너무 엉뚱하지 않게, 학생이 실제로 고민할 만한 매력적인 오답으로 만드세요.
10. 난이도에 따라 선지의 유사성, 추론 깊이, 어휘 수준을 조절하세요.

━━━━━━━━━━━━━━━━━━━━
[난이도 기준]
━━━━━━━━━━━━━━━━━━━━

기본:
- 본문 핵심내용을 정확히 이해하면 해결 가능
- 과도한 함정 금지

중상:
- 문맥과 논리 흐름을 함께 이해해야 해결 가능
- 오답 선지를 서로 비슷하게 구성

고난도:
- 핵심 논리, 문맥, 함의까지 종합적으로 판단
- 단순 내용 찾기로 정답이 바로 보이지 않도록 구성
- 단, 억지 함정이나 복수정답은 금지

━━━━━━━━━━━━━━━━━━━━
[문제 유형별 기준]
━━━━━━━━━━━━━━━━━━━━

주제·제목:
- 글 전체의 중심내용을 판단
- 제목 또는 주제 선택형
- 영어 선지를 우선 사용

내용 일치·불일치:
- 본문 전체에 근거
- 단순 문장 복사보다 의미를 적절히 변형
- 일치 또는 불일치 여부가 명확해야 함

빈칸 추론:
- 핵심 논리나 중심내용에 의미 있는 부분을 빈칸으로 설정
- 단순 어휘 암기형 빈칸은 피함

어휘:
- 문맥상 의미
- 어휘의 적절성
- 유의어·반의어
- 문맥상 낱말의 쓰임 등을 다양하게 활용

어법:
- 문법적으로 의미 있는 부분을 출제
- 단순 철자나 사소한 오류는 피함
- 수일치, 준동사, 관계사, 병렬, 시제, 태, 대명사 등 지문에 실제로 존재하는 구조 활용

요약문 완성:
- 지문 전체 핵심내용을 1~2문장으로 요약
- (A), (B) 빈칸형 5지선다 가능

문장 삽입:
- 지문의 논리 흐름이 충분한 경우만 출제
- 삽입 문장의 위치가 명확해야 함

글의 순서:
- 원문의 논리 흐름을 활용
- 지나치게 짧은 글에서는 억지로 만들지 않음

서술형:
- 학생이 영어 또는 한국어로 핵심을 작성
- 반드시 채점 가능한 모범답안 포함

학교시험형 종합:
- 국내 고등학교 내신 스타일
- 어법, 어휘, 내용, 문맥, 요약 등을 적절히 변형
- 기존 유형과 최대한 중복되지 않는 형태로 출제

━━━━━━━━━━━━━━━━━━━━
[지문 목록]
━━━━━━━━━━━━━━━━━━━━

${JSON.stringify(passageData, null, 2)}

━━━━━━━━━━━━━━━━━━━━
[이번 출제 계획]
━━━━━━━━━━━━━━━━━━━━

${JSON.stringify(mixedPlans, null, 2)}

━━━━━━━━━━━━━━━━━━━━
[기존 출제 이력]
━━━━━━━━━━━━━━━━━━━━

${
  previousHistory.length > 0
    ? JSON.stringify(previousHistory, null, 2)
    : "기존 출제 이력 없음"
}

━━━━━━━━━━━━━━━━━━━━
[반환 형식]
━━━━━━━━━━━━━━━━━━━━

반드시 아래 JSON 형식만 반환하세요.

{
  "questions": [
    {
      "passageId": "원래 지문 id",
      "passageTitle": "지문 제목",
      "type": "문제 유형",
      "difficulty": "기본 또는 중상 또는 고난도",
      "stem": "문제 발문",
      "passage": "문제에 실제로 표시할 영어 지문. 필요한 경우 원문의 일부에 번호, 밑줄, 빈칸 등의 표시를 넣을 수 있음",
      "choices": [
        "① ...",
        "② ...",
        "③ ...",
        "④ ...",
        "⑤ ..."
      ],
      "answer": "정답",
      "explanation": "정답 근거와 필요한 해설",
      "keyPoint": "이 문제의 핵심 출제 포인트를 짧게 설명"
    }
  ]
}

추가 규칙:

- 서술형 문제는 choices를 빈 배열 []로 반환하세요.
- 객관식 문제는 choices를 반드시 5개 반환하세요.
- answer에는 정답 번호 또는 모범답안을 넣으세요.
- passage는 반드시 원문의 내용을 유지해야 합니다.
- 문제 수는 출제 계획과 정확히 같아야 합니다.
- 출제 계획에 없는 문제 유형을 추가하지 마세요.
`;

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: prompt,
    });

    const raw = response.output_text?.trim();

    if (!raw) {
      return Response.json(
        {
          error: "문제 생성 결과가 없습니다.",
        },
        { status: 500 }
      );
    }

    let parsed: {
      questions?: GeneratedQuestion[];
    };

    try {
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Question JSON parse failed:", raw);

      return Response.json(
        {
          error: "생성된 문제 데이터를 읽지 못했습니다.",
        },
        { status: 500 }
      );
    }

    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.filter(
          (item) =>
            typeof item?.passageId === "string" &&
            typeof item?.type === "string" &&
            typeof item?.stem === "string" &&
            typeof item?.passage === "string" &&
            typeof item?.answer === "string"
        )
      : [];

    if (questions.length === 0) {
      return Response.json(
        {
          error: "사용 가능한 변형문제를 생성하지 못했습니다.",
        },
        { status: 500 }
      );
    }

    /*
     * 최종 문제 순서도 한 번 랜덤하게 섞어서 반환
     */
    const shuffledQuestions = shuffle(
      questions.map((question, index) => ({
        ...question,
        id: `question-${Date.now()}-${index}`,
      }))
    );

    return Response.json({
      questions: shuffledQuestions,
      requestedCount: mixedPlans.length,
      generatedCount: shuffledQuestions.length,
    });
  } catch (error) {
    console.error("English test generation error:", error);

    return Response.json(
      {
        error: "영어 변형문제 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}