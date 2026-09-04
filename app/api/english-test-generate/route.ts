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
  keyPoint?: string;
};

type QuestionPlan = {
  passageId: string;
  passageTitle: string;
  source: string;
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
  boxTitle: string;
  boxText: string;
  supplementaryItems: string[];
};

const ALLOWED_TYPES = [
  "제목",
  "주제",
  "요지",
  "내용 일치·불일치",
  "어휘",
  "빈칸 추론",
];

const MODIFIED_PASSAGE_TYPES = new Set([
  "어휘",
  "빈칸 추론",
]);

function shuffle<T>(items: T[]) {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function cleanJson(raw: string) {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function makePlans(
  passages: Passage[],
  requests: QuestionRequest[],
  difficulties: string[]
) {
  const types: string[] = [];

  for (const request of requests) {
    if (!ALLOWED_TYPES.includes(request.type)) continue;

    const count = Math.max(
      0,
      Math.min(Number(request.count) || 0, 20)
    );

    for (let i = 0; i < count; i++) {
      types.push(request.type);
    }
  }

  const shuffledTypes = shuffle(types).slice(0, 40);
  const passagePool = shuffle(passages);
  const levels =
    difficulties.length > 0 ? difficulties : ["중상"];

  return shuffledTypes.map(
    (type, index): QuestionPlan => {
      const passage =
        passagePool[index % passagePool.length];

      return {
        passageId: passage.id,
        passageTitle: passage.title,
        source: passage.source,
        type,
        difficulty:
          levels[
            Math.floor(Math.random() * levels.length)
          ],
      };
    }
  );
}

function makeCompactPlan(plans: QuestionPlan[]) {
  return plans.map((plan) => ({
    passageId: plan.passageId,
    passageTitle: plan.passageTitle,
    type: plan.type,
    difficulty: plan.difficulty,
    source: plan.source,
  }));
}

function makePrompt(
  plans: QuestionPlan[],
  history: PreviousQuestion[]
) {
  return `
당신은 대한민국 고등학교 영어 내신 및 모의고사 전문 출제자입니다.

오직 아래 6가지 유형만 출제합니다.

- 제목
- 주제
- 요지
- 내용 일치·불일치
- 어휘
- 빈칸 추론

[출제 계획]
${JSON.stringify(makeCompactPlan(plans), null, 2)}

[최근 출제 이력]
${JSON.stringify(
  history.slice(-25).map((item) => ({
    passageId: item.passageId,
    type: item.type,
    stem: item.stem,
    keyPoint: item.keyPoint,
  })),
  null,
  2
)}

==================================================
공통 규칙
==================================================

- type을 절대 바꾸지 않습니다.
- 반드시 제공된 원문만 근거로 출제합니다.
- 모든 문제는 5지선다입니다.
- 정답은 하나만 존재해야 합니다.
- answer에는 반드시 정답 번호만 적습니다.
  예: "①"
- explanation은 반드시 한국어로 작성합니다.
- 영어 표현을 짧게 인용하는 것은 가능하지만 설명 문장은 한국어여야 합니다.
- stem에는 제작 지침이나 내부 메모를 절대 넣지 않습니다.
- "영어 선택지 우선", "영어 선지를 우선", "출제 지침", "제작 지침" 같은 표현을 절대 출력하지 않습니다.
- 한글과 영어가 섞인 이상한 오타를 만들지 않습니다.
- 최근 출제 이력과 지나치게 비슷한 문제를 피합니다.

==================================================
유형별 규칙
==================================================

[제목]
stem:
"다음 글의 제목으로 가장 적절한 것은?"
choices:
영어 제목 5개
modifiedPassage:
빈 문자열 ""

[주제]
stem:
"다음 글의 주제로 가장 적절한 것은?"
choices:
영어 주제 표현 5개
modifiedPassage:
빈 문자열 ""

[요지]
stem:
"다음 글의 요지로 가장 적절한 것은?"
choices:
영어 문장 5개
modifiedPassage:
빈 문자열 ""

[내용 일치·불일치]
stem:
"다음 글의 내용과 일치하는 것은?"
또는
"다음 글의 내용과 일치하지 않는 것은?"
choices:
본문 사실에 근거한 영어 문장 5개
modifiedPassage:
빈 문자열 ""

[어휘]
stem:
"밑줄 친 낱말 중 문맥상 적절하지 않은 것은?"
modifiedPassage:
원문의 의미와 흐름은 유지하면서
① ② ③ ④ ⑤ 다섯 어휘를 실제 본문 안에 표시합니다.
정확히 하나만 문맥상 부적절해야 합니다.
choices:
["① 단어", "② 단어", "③ 단어", "④ 단어", "⑤ 단어"]

[빈칸 추론]
stem:
"다음 빈칸에 들어갈 말로 가장 적절한 것은?"
modifiedPassage:
원문의 핵심 의미를 담은 한 부분을
________
으로 바꿉니다.
choices:
정답은 원문에서 지운 표현을 그대로 복사하지 않습니다.
반드시 같은 의미를 자연스럽게 패러프레이징한 영어 표현으로 만듭니다.
원문보다 지나치게 멀리 의역하지 않습니다.

==================================================
반환 형식
==================================================

JSON만 반환하세요.

{
  "questions": [
    {
      "passageId": "출제 계획의 passageId",
      "passageTitle": "출제 계획의 passageTitle",
      "type": "출제 계획의 type",
      "difficulty": "출제 계획의 difficulty",
      "stem": "학생용 발문",
      "modifiedPassage": "",
      "choices": [
        "① ...",
        "② ...",
        "③ ...",
        "④ ...",
        "⑤ ..."
      ],
      "answer": "③",
      "explanation": "한국어 해설",
      "keyPoint": "핵심 출제 포인트"
    }
  ]
}

제목/주제/요지/내용 일치·불일치 문제는 modifiedPassage를 반드시 빈 문자열로 반환하세요.
어휘/빈칸 추론 문제만 modifiedPassage를 반환하세요.
출제 계획 개수와 정확히 같은 개수의 문제를 반환하세요.
`;
}

function validateQuestion(
  question: any,
  plan: QuestionPlan
) {
  const errors: string[] = [];

  if (!question?.stem) errors.push("발문 없음");

  if (
    !Array.isArray(question?.choices) ||
    question.choices.length !== 5
  ) {
    errors.push("5지선다 아님");
  }

  if (
    !["①", "②", "③", "④", "⑤"].includes(
      String(question?.answer || "").trim()
    )
  ) {
    errors.push("정답 번호 형식 오류");
  }

  if (!question?.explanation) {
    errors.push("해설 없음");
  }

  if (
    plan.type === "빈칸 추론" &&
    !String(question?.modifiedPassage || "").includes(
      "________"
    )
  ) {
    errors.push("빈칸 없음");
  }

  if (plan.type === "어휘") {
    const text = String(
      question?.modifiedPassage || ""
    );

    const count = [
      "①",
      "②",
      "③",
      "④",
      "⑤",
    ].filter((mark) => text.includes(mark)).length;

    if (count < 5) {
      errors.push("어휘 번호 부족");
    }
  }

  return errors;
}

async function generateChunk(
  openai: OpenAI,
  plans: QuestionPlan[],
  history: PreviousQuestion[]
) {
  const response = await openai.responses.create({
    model: "gpt-5-mini",
    input: makePrompt(plans, history),
  });

  const raw = response.output_text?.trim();

  if (!raw) {
    throw new Error("AI 문제 생성 결과가 없습니다.");
  }

  const parsed = JSON.parse(cleanJson(raw));

  const sourceQuestions = Array.isArray(
    parsed?.questions
  )
    ? parsed.questions
    : [];

  return plans.map((plan, index) => {
    const rawQuestion =
      sourceQuestions[index] || {};

    const modifiedPassage =
      typeof rawQuestion.modifiedPassage ===
        "string"
        ? rawQuestion.modifiedPassage.trim()
        : "";

    const question: GeneratedQuestion = {
      passageId: plan.passageId,
      passageTitle: plan.passageTitle,
      type: plan.type,
      difficulty: plan.difficulty,

      stem:
        typeof rawQuestion.stem === "string"
          ? rawQuestion.stem.trim()
          : "",

      passage: MODIFIED_PASSAGE_TYPES.has(plan.type)
        ? modifiedPassage || plan.source
        : plan.source,

      choices: Array.isArray(
        rawQuestion.choices
      )
        ? rawQuestion.choices
        : [],

      answer:
        typeof rawQuestion.answer === "string"
          ? rawQuestion.answer.trim()
          : "",

      explanation:
        typeof rawQuestion.explanation ===
        "string"
          ? rawQuestion.explanation.trim()
          : "",

      keyPoint:
        typeof rawQuestion.keyPoint === "string"
          ? rawQuestion.keyPoint.trim()
          : "",

      boxTitle: "",
      boxText: "",
      supplementaryItems: [],
    };

    return {
      question,
      errors: validateQuestion(
        rawQuestion,
        plan
      ),
    };
  });
}

function splitPlans(plans: QuestionPlan[]) {
  const total = plans.length;

  if (total <= 8) {
    return [plans];
  }

  if (total <= 16) {
    const middle = Math.ceil(total / 2);

    return [
      plans.slice(0, middle),
      plans.slice(middle),
    ];
  }

  const size = Math.ceil(total / 3);

  return [
    plans.slice(0, size),
    plans.slice(size, size * 2),
    plans.slice(size * 2),
  ].filter((batch) => batch.length > 0);
}

export async function POST(req: Request) {
  try {
    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "OPENAI_API_KEY가 설정되어 있지 않습니다.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const passages: Passage[] =
      Array.isArray(body?.passages)
        ? body.passages
        : [];

    const questionRequests: QuestionRequest[] =
      Array.isArray(body?.questionRequests)
        ? body.questionRequests
        : [];

    const difficulties: string[] =
      Array.isArray(body?.difficulties)
        ? body.difficulties
        : ["중상"];

    const previousQuestions: PreviousQuestion[] =
      Array.isArray(body?.previousQuestions)
        ? body.previousQuestions
        : [];

    if (passages.length === 0) {
      return Response.json(
        {
          error:
            "선택된 지문이 없습니다.",
        },
        { status: 400 }
      );
    }

    const plans = makePlans(
      passages,
      questionRequests,
      difficulties
    );

    if (plans.length === 0) {
      return Response.json(
        {
          error:
            "생성할 문제 유형을 선택해 주세요.",
        },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey,
    });

    const batches = splitPlans(plans);

    const batchResults =
      await Promise.all(
        batches.map((batch) =>
          generateChunk(
            openai,
            batch,
            previousQuestions
          )
        )
      );

    const flatResults =
      batchResults.flat();

    const questions =
      flatResults.map(
        (result, index) => ({
          ...result.question,
          id: `question-${Date.now()}-${index}`,
        })
      );

    const validationWarnings =
      flatResults
        .map((result, index) => ({
          index,
          errors: result.errors,
        }))
        .filter(
          (item) =>
            item.errors.length > 0
        );

    return Response.json({
      questions,
      validationWarnings,
    });
  } catch (error) {
    console.error(
      "English question engine v4:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "문제 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}