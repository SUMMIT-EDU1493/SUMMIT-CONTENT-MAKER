import OpenAI from "openai";

type Question = {
  id?: string;
  passageId: string;
  passageTitle: string;
  type: string;
  difficulty: string;
  stem: string;
  passage: string;
  choices: string[];
  supplementaryItems?: string[];
  answer: string;
  explanation: string;
  keyPoint: string;
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const body = await req.json();

    const question: Question = body?.question;

    const mode =
      typeof body?.mode === "string"
        ? body.mode.trim()
        : "";

    const originalSource =
      typeof body?.originalSource === "string"
        ? body.originalSource.trim()
        : question?.passage || "";

    if (!question || !mode) {
      return Response.json(
        { error: "변형할 문제 정보가 부족합니다." },
        { status: 400 }
      );
    }

    const prompt = `
당신은 대한민국 고등학교 영어 내신 및 모의고사 전문 출제자입니다.

아래 문제를 사용자가 선택한 방식으로 변형하세요.

[변형 방식]
${mode}

[원본 영어 지문]
${originalSource}

[현재 문제]
${JSON.stringify(question, null, 2)}

반드시 지켜야 할 규칙:

1. 원본 영어 지문의 사실과 의미를 벗어나지 마세요.
2. 기존 문제와 사실상 동일한 문제를 다시 만들지 마세요.
3. 객관식은 정답이 하나만 존재하도록 만드세요.
4. 객관식은 기본적으로 5지선다입니다.
5. 오답은 학생이 실제로 고민할 만한 매력적인 선지로 만드세요.
6. 정답 근거가 명확해야 합니다.

[변형 방식별 규칙]

난이도 높이기:
- 추론 깊이를 높이세요.
- 오답 선지를 더 정교하게 만드세요.
- 억지 함정은 금지합니다.

난이도 낮추기:
- 핵심 내용 이해로 해결 가능하게 단순화하세요.

발문 변경:
- 출제 핵심은 유지하되 질문 방식은 새롭게 구성하세요.

선지 변형:
- 정답 근거는 유지하세요.
- 선택지를 새롭게 구성하세요.

다른 유형으로 변형:
- 현재 지문에 적절한 다른 유형으로 바꾸세요.
- 기존 유형과 겹치지 않게 하세요.

객관식 → 서술형:
- choices는 []로 반환하세요.
- 채점 가능한 모범답안을 answer에 넣으세요.

서술형 → 객관식:
- choices를 정확히 5개 만드세요.
- 정답이 하나만 존재해야 합니다.

학교시험형 종합:
- (A)~(F) 같은 별도 진술형 자료가 필요한 경우
  supplementaryItems 배열에 따로 넣으세요.
- supplementaryItems를 stem이나 passage에 섞지 마세요.

반드시 아래 JSON만 반환하세요.

{
  "question": {
    "passageId": "${question.passageId}",
    "passageTitle": "${question.passageTitle}",
    "type": "문제 유형",
    "difficulty": "기본 또는 중상 또는 고난도",
    "stem": "문제 발문",
    "passage": "문제에 표시할 영어 지문",
    "choices": [
      "① ...",
      "② ...",
      "③ ...",
      "④ ...",
      "⑤ ..."
    ],
    "supplementaryItems": [],
    "answer": "정답",
    "explanation": "정답 근거와 해설",
    "keyPoint": "핵심 출제 포인트"
  }
}
`;

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: prompt,
    });

    const raw = response.output_text?.trim();

    if (!raw) {
      return Response.json(
        { error: "문제 변형 결과가 없습니다." },
        { status: 500 }
      );
    }

    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    const result = parsed?.question;

    if (
      !result ||
      typeof result.stem !== "string" ||
      typeof result.passage !== "string" ||
      typeof result.answer !== "string"
    ) {
      return Response.json(
        { error: "변형 문제 데이터를 읽지 못했습니다." },
        { status: 500 }
      );
    }

    return Response.json({
      question: {
        ...result,
        id: question.id,
        choices: Array.isArray(result.choices)
          ? result.choices
          : [],
        supplementaryItems: Array.isArray(result.supplementaryItems)
          ? result.supplementaryItems
          : [],
      },
    });
  } catch (error) {
    console.error("English question transform error:", error);

    return Response.json(
      { error: "문제 변형 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}