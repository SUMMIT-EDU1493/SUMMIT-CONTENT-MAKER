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

  boxTitle: string;
  boxText: string;

  supplementaryItems: string[];
  choices: string[];

  answer: string;
  explanation: string;
  keyPoint: string;
};

const OBJECTIVE_TYPES = new Set([
  "주제·제목",
  "내용 일치·불일치",
  "빈칸 추론",
  "어휘",
  "어법",
  "요약문 완성",
  "문장 삽입",
  "글의 순서",
  "학교시험형 종합",
]);

const BANNED_META_PHRASES = [
  "영어 선택지 우선",
  "영어 선지를 우선",
  "영어 선택지를 우선",
  "본문에 표시된 [①]",
  "본문에 표시된 ①",
  "아래 형식으로",
  "다음 단계",
  "출제 지침",
  "제작 지침",
];

function shuffle<T>(items: T[]) {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function stripCodeFence(raw: string) {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeQuestion(
  raw: Partial<GeneratedQuestion>,
  plan: QuestionPlan
): GeneratedQuestion {
  return {
    passageId: plan.passageId,
    passageTitle: plan.passageTitle,
    type:
      typeof raw.type === "string" && raw.type.trim()
        ? raw.type.trim()
        : plan.type,
    difficulty:
      typeof raw.difficulty === "string" && raw.difficulty.trim()
        ? raw.difficulty.trim()
        : plan.difficulty,

    stem: typeof raw.stem === "string" ? raw.stem.trim() : "",
    passage:
      typeof raw.passage === "string" && raw.passage.trim()
        ? raw.passage.trim()
        : plan.source,

    boxTitle:
      typeof raw.boxTitle === "string" ? raw.boxTitle.trim() : "",
    boxText:
      typeof raw.boxText === "string" ? raw.boxText.trim() : "",

    supplementaryItems: Array.isArray(raw.supplementaryItems)
      ? raw.supplementaryItems
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : [],

    choices: Array.isArray(raw.choices)
      ? raw.choices
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : [],

    answer: typeof raw.answer === "string" ? raw.answer.trim() : "",
    explanation:
      typeof raw.explanation === "string"
        ? raw.explanation.trim()
        : "",
    keyPoint:
      typeof raw.keyPoint === "string" ? raw.keyPoint.trim() : "",
  };
}

function containsBannedMeta(question: GeneratedQuestion) {
  const combined = [
    question.stem,
    question.boxTitle,
    question.boxText,
    ...question.supplementaryItems,
    ...question.choices,
  ].join(" ");

  return BANNED_META_PHRASES.some((phrase) =>
    combined.includes(phrase)
  );
}

function hasInsertionPositions(text: string) {
  return ["①", "②", "③", "④", "⑤"].every((mark) =>
    text.includes(mark)
  );
}

function hasABC(items: string[]) {
  const text = items.join(" ");

  return (
    (text.includes("(A)") || text.includes("A)")) &&
    (text.includes("(B)") || text.includes("B)")) &&
    (text.includes("(C)") || text.includes("C)"))
  );
}

function hasABBlank(text: string) {
  const upper = text.toUpperCase();

  return (
    (upper.includes("(A)") || upper.includes("A)")) &&
    (upper.includes("(B)") || upper.includes("B)"))
  );
}

function hasBlank(text: string) {
  return (
    text.includes("_____") ||
    text.includes("______") ||
    text.includes("________") ||
    text.includes("빈칸")
  );
}

function englishWordCount(text: string) {
  return text
    .replace(/[^\w'-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function validateQuestion(question: GeneratedQuestion) {
  const errors: string[] = [];

  if (!question.stem) errors.push("발문 없음");
  if (!question.passage) errors.push("본문 없음");
  if (!question.answer) errors.push("정답 없음");
  if (!question.explanation) errors.push("해설 없음");

  if (containsBannedMeta(question)) {
    errors.push("제작 지침 문구 노출");
  }

  if (
    OBJECTIVE_TYPES.has(question.type) &&
    question.choices.length !== 5
  ) {
    errors.push("객관식 선택지가 5개가 아님");
  }

  switch (question.type) {
    case "주제·제목": {
      if (question.choices.length !== 5) {
        errors.push("주제·제목 선택지 부족");
      }
      break;
    }

    case "빈칸 추론": {
      if (!hasBlank(question.passage)) {
        errors.push("본문에 실제 빈칸 없음");
      }
      break;
    }

    case "문장 삽입": {
      if (!question.boxText) {
        errors.push("삽입할 문장 없음");
      }

      if (!hasInsertionPositions(question.passage)) {
        errors.push("본문에 ①~⑤ 삽입 위치 없음");
      }
      break;
    }

    case "글의 순서": {
      if (
        question.supplementaryItems.length < 3 ||
        !hasABC(question.supplementaryItems)
      ) {
        errors.push("(A)(B)(C) 순서 구간 없음");
      }
      break;
    }

    case "요약문 완성": {
      if (!question.boxText) {
        errors.push("요약문 없음");
      }

      if (!hasABBlank(question.boxText)) {
        errors.push("요약문에 (A)(B) 없음");
      }
      break;
    }

    case "학교시험형 종합": {
      if (question.supplementaryItems.length < 4) {
        errors.push("학교시험형 별도 보기 없음");
      }
      break;
    }

    case "서술형": {
      if (question.choices.length > 0) {
        errors.push("서술형에 객관식 선택지 존재");
      }

      const words = englishWordCount(question.answer);

      if (words > 30) {
        errors.push("서술형 모범답안이 너무 김");
      }

      break;
    }
  }

  return errors;
}

function makePlans(
  passages: Passage[],
  requests: QuestionRequest[],
  difficulties: string[]
) {
  const expandedTypes: string[] = [];

  for (const request of requests) {
    const count = Math.max(
      0,
      Math.min(Number(request.count) || 0, 20)
    );

    for (let i = 0; i < count; i++) {
      expandedTypes.push(request.type);
    }
  }

  const shuffledTypes = shuffle(expandedTypes).slice(0, 40);
  const shuffledPassages = shuffle(passages);
  const levelPool =
    difficulties.length > 0 ? difficulties : ["중상"];

  return shuffledTypes.map((type, index): QuestionPlan => {
    const passage =
      shuffledPassages[index % shuffledPassages.length];

    return {
      passageId: passage.id,
      passageTitle: passage.title,
      source: passage.source,
      type,
      difficulty:
        levelPool[
          Math.floor(Math.random() * levelPool.length)
        ],
    };
  });
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

function buildPrompt(
  plans: QuestionPlan[],
  previousQuestions: PreviousQuestion[],
  retryReasons?: string[]
) {
  const retryText =
    retryReasons && retryReasons.length
      ? `
이전 생성 결과가 아래 이유로 검수에서 탈락했습니다.
이번에는 반드시 수정하세요.

${retryReasons.map((item) => `- ${item}`).join("\n")}
`
      : "";

  return `
당신은 대한민국 고등학교 영어 내신 및 모의고사 전문 출제자입니다.

아래의 정확한 출제 계획에 따라 문제를 제작하세요.

${retryText}

[출제 계획]
${JSON.stringify(plans, null, 2)}

[최근 출제 이력]
${JSON.stringify(previousQuestions.slice(-80), null, 2)}

==================================================
가장 중요한 공통 규칙
==================================================

1. 반드시 제공된 원문 영어 지문만 근거로 출제합니다.
2. 원문에 없는 사실을 만들어내지 않습니다.
3. 문제 제작용 내부 지침을 학생용 발문에 절대 노출하지 않습니다.
4. 아래 같은 문구는 절대 쓰지 않습니다.
   - 영어 선택지 우선
   - 영어 선지를 우선 사용
   - 본문에 표시된 위치 중
   - 제작 지침
   - 출제 지침
5. 발문은 실제 대한민국 고등학교 시험지처럼 자연스럽게 작성합니다.
6. 한글과 영어가 비정상적으로 붙은 오타를 만들지 않습니다.
7. 문제에서 요구하는 A, B, C, ①, ② 등이 실제 자료 안에 반드시 존재해야 합니다.
8. 객관식은 반드시 5지선다입니다.
9. 정답이 하나만 존재하도록 만듭니다.
10. 오답은 원문과 관련성은 있지만 분명히 틀려야 합니다.
11. 이전 출제 이력과 발문 및 핵심 포인트가 최대한 겹치지 않도록 합니다.

==================================================
필드 사용법
==================================================

stem:
학생에게 보여줄 짧은 문제 발문만 작성합니다.
긴 문장, 요약문, 삽입문, (A)~(F)를 stem 뒤에 붙이지 않습니다.

passage:
학생이 읽는 영어 본문입니다.

boxTitle / boxText:
본문과 별도로 네모 박스에 보여줄 자료입니다.

supplementaryItems:
(A), (B), (C) 또는 (A)~(F)처럼
본문 아래에 별도로 보여줄 여러 항목입니다.

choices:
①~⑤ 객관식 선택지입니다.

answer:
정답만 간결하게 적습니다.

explanation:
정답 근거와 설명은 여기 적습니다.

==================================================
문제 유형별 절대 규칙
==================================================

[주제·제목]
- stem은 간결하게:
  "다음 글의 제목으로 가장 적절한 것은?"
  또는
  "다음 글의 주제로 가장 적절한 것은?"
- 괄호 안에 제작 지침을 절대 덧붙이지 않습니다.
- choices는 영어 5개를 자연스럽게 구성합니다.
- boxText = ""
- supplementaryItems = []

[내용 일치·불일치]
- 본문의 세부 내용을 정확히 활용합니다.
- 5지선다입니다.

[빈칸 추론]
- 발문 뒤에 빈칸 문장 전체를 붙이지 않습니다.
- 반드시 passage 안의 적절한 부분을 _____ 로 바꿉니다.
- 학생은 본문을 읽으며 빈칸을 확인할 수 있어야 합니다.
- choices는 빈칸에 들어갈 영어 표현 5개입니다.

[어휘]
- passage 안에서 특정 어휘를 명확하게 표시합니다.
- 단순 암기가 아니라 문맥 판단형으로 출제합니다.

[어법]
- passage 안에서 판단 대상 부분을 명확히 표시합니다.
- 발문만 보고 무엇을 고르는지 모호하면 안 됩니다.

[요약문 완성]
- passage에는 원문을 둡니다.
- boxTitle = "<요약문>"
- boxText 안에 실제 요약문을 작성합니다.
- boxText에 반드시 (A), (B) 두 빈칸이 존재해야 합니다.
예:
"The passage shows that nudges can (A) ______ behavior while preserving (B) ______."
- choices에는 (A), (B) 조합 5개를 제시합니다.

[문장 삽입]
- boxTitle = "<주어진 문장>"
- boxText = 삽입해야 할 영어 문장 한 문장
- passage 안에 반드시 ① ② ③ ④ ⑤ 위치를 직접 삽입합니다.
- stem에는 삽입문을 길게 다시 쓰지 않습니다.
- stem 예:
  "주어진 문장이 들어가기에 가장 적절한 곳은?"
- choices = ["①", "②", "③", "④", "⑤"]

[글의 순서]
- passage에는 짧은 '주어진 글' 부분만 둡니다.
- 나머지 본문은 의미 단위로 3개로 나눕니다.
- supplementaryItems에 반드시:
  "(A) ..."
  "(B) ..."
  "(C) ..."
  형식으로 넣습니다.
- 문장을 중간에서 자르지 않습니다.
- choices는 순서 조합 5개입니다.
예:
"① (A)-(C)-(B)"

[서술형]
- 학생이 영어로 1~2문장 정도 작성할 수 있는 문제로 만듭니다.
- 지나치게 많은 근거를 한꺼번에 요구하지 않습니다.
- answer는 영어 약 10~30단어를 권장하며 절대 30단어를 넘기지 않습니다.
- 핵심 내용 1~2개만 포함합니다.
- 긴 설명은 answer에 쓰지 말고 explanation에 적습니다.
- choices = []
- supplementaryItems = []

[학교시험형 종합]
- 실제 고등학교 내신의 복합 내용 판단형으로 만듭니다.
- stem은 발문만 씁니다.
- passage에는 영어 본문만 둡니다.
- (A)~(F)를 사용하는 경우 supplementaryItems에 반드시 실제 항목을 넣습니다.
예:
[
  "(A) ...",
  "(B) ...",
  "(C) ...",
  "(D) ...",
  "(E) ...",
  "(F) ..."
]
- (A)~(F)를 발문에만 언급하고 실제 항목을 빠뜨리는 것은 절대 금지입니다.
- choices는 올바른 조합 5개입니다.

==================================================
반환 형식
==================================================

JSON 외에는 아무것도 출력하지 마세요.

{
  "questions": [
    {
      "passageId": "계획의 passageId 그대로",
      "passageTitle": "계획의 passageTitle 그대로",
      "type": "계획의 유형",
      "difficulty": "계획의 난이도",

      "stem": "학생용 발문",
      "passage": "학생에게 보여줄 본문",

      "boxTitle": "",
      "boxText": "",

      "supplementaryItems": [],
      "choices": [],

      "answer": "간결한 정답",
      "explanation": "충분한 해설",
      "keyPoint": "출제 핵심"
    }
  ]
}

반드시 출제 계획의 문제 수와 정확히 같은 개수를 반환하세요.
`;
}

async function generateBatch(
  openai: OpenAI,
  plans: QuestionPlan[],
  previousQuestions: PreviousQuestion[]
) {
  const firstResponse = await openai.responses.create({
    model: "gpt-5-mini",
    input: buildPrompt(plans, previousQuestions),
  });

  const firstRaw = firstResponse.output_text?.trim();

  if (!firstRaw) {
    throw new Error("AI 응답이 없습니다.");
  }

  const firstParsed = JSON.parse(stripCodeFence(firstRaw));

  const firstQuestions = Array.isArray(firstParsed?.questions)
    ? firstParsed.questions
    : [];

  const normalized = plans.map((plan, index) =>
    normalizeQuestion(firstQuestions[index] || {}, plan)
  );

  const invalidIndexes: number[] = [];
  const invalidReasons: string[] = [];

  normalized.forEach((question, index) => {
    const errors = validateQuestion(question);

    if (errors.length > 0) {
      invalidIndexes.push(index);
      invalidReasons.push(
        `${index + 1}번 ${plans[index].type}: ${errors.join(", ")}`
      );
    }
  });

  if (invalidIndexes.length === 0) {
    return normalized;
  }

  const retryPlans = invalidIndexes.map((index) => plans[index]);

  const retryResponse = await openai.responses.create({
    model: "gpt-5-mini",
    input: buildPrompt(
      retryPlans,
      previousQuestions,
      invalidReasons
    ),
  });

  const retryRaw = retryResponse.output_text?.trim();

  if (!retryRaw) {
    return normalized;
  }

  const retryParsed = JSON.parse(stripCodeFence(retryRaw));

  const retryQuestions = Array.isArray(retryParsed?.questions)
    ? retryParsed.questions
    : [];

  invalidIndexes.forEach((originalIndex, retryIndex) => {
    const repaired = normalizeQuestion(
      retryQuestions[retryIndex] || {},
      plans[originalIndex]
    );

    const errors = validateQuestion(repaired);

    if (errors.length === 0) {
      normalized[originalIndex] = repaired;
    }
  });

  return normalized;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const body = await req.json();

    const passages: Passage[] = Array.isArray(body?.passages)
      ? body.passages
      : [];

    const questionRequests: QuestionRequest[] = Array.isArray(
      body?.questionRequests
    )
      ? body.questionRequests
      : [];

    const difficulties: string[] = Array.isArray(body?.difficulties)
      ? body.difficulties
      : ["중상"];

    const previousQuestions: PreviousQuestion[] = Array.isArray(
      body?.previousQuestions
    )
      ? body.previousQuestions
      : [];

    if (passages.length === 0) {
      return Response.json(
        { error: "선택된 지문이 없습니다." },
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
        { error: "생성할 문제 수가 0개입니다." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });

    // 4문항씩 묶어서 동시에 생성
    const batches = chunk(plans, 4);

    const results = await Promise.all(
      batches.map((batch) =>
        generateBatch(openai, batch, previousQuestions)
      )
    );

    const questions = results.flat().map((question, index) => ({
      ...question,
      id: `question-${Date.now()}-${index}`,
    }));

    return Response.json({
      questions,
    });
  } catch (error) {
    console.error("English generation v2 error:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "변형문제 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}