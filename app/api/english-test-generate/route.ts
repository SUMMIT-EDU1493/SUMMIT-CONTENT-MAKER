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
  choices: string[];

  answer: string;
  explanation: string;
  keyPoint: string;

  // 기존 화면과 호환용
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

const BANNED_PHRASES = [
  "영어 선택지 우선",
  "영어 선지를 우선",
  "영어 선택지를 우선",
  "제작 지침",
  "출제 지침",
  "다음 단계",
  "본문에 표시된",
  "아래 형식",
];

function shuffle<T>(items: T[]) {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }

  return result;
}

function cleanJson(raw: string) {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalize(
  raw: Partial<GeneratedQuestion>,
  plan: QuestionPlan
): GeneratedQuestion {
  return {
    passageId: plan.passageId,
    passageTitle: plan.passageTitle,
    type: plan.type,
    difficulty: plan.difficulty,

    stem:
      typeof raw.stem === "string"
        ? raw.stem.trim()
        : "",

    passage:
      typeof raw.passage === "string" && raw.passage.trim()
        ? raw.passage.trim()
        : plan.source,

    choices: Array.isArray(raw.choices)
      ? raw.choices
          .filter(
            (choice): choice is string =>
              typeof choice === "string"
          )
          .map((choice) => choice.trim())
          .filter(Boolean)
      : [],

    answer:
      typeof raw.answer === "string"
        ? raw.answer.trim()
        : "",

    explanation:
      typeof raw.explanation === "string"
        ? raw.explanation.trim()
        : "",

    keyPoint:
      typeof raw.keyPoint === "string"
        ? raw.keyPoint.trim()
        : "",

    boxTitle: "",
    boxText: "",
    supplementaryItems: [],
  };
}

function hasBannedPhrase(question: GeneratedQuestion) {
  const text = [
    question.stem,
    question.passage,
    ...question.choices,
  ].join(" ");

  return BANNED_PHRASES.some((phrase) =>
    text.includes(phrase)
  );
}

function validateQuestion(
  question: GeneratedQuestion,
  plan: QuestionPlan
) {
  const errors: string[] = [];

  if (!question.stem) {
    errors.push("발문 없음");
  }

  if (!question.passage) {
    errors.push("본문 없음");
  }

  if (question.choices.length !== 5) {
    errors.push("5지선다 아님");
  }

  if (!question.answer) {
    errors.push("정답 없음");
  }

  if (!question.explanation) {
    errors.push("해설 없음");
  }

  if (hasBannedPhrase(question)) {
    errors.push("내부 제작 문구 노출");
  }

  if (question.type !== plan.type) {
    errors.push("문제 유형 불일치");
  }

  if (
    question.type === "빈칸 추론" &&
    !question.passage.includes("________")
  ) {
    errors.push("본문에 빈칸 없음");
  }

  if (question.type === "어휘") {
    const marks = ["①", "②", "③", "④", "⑤"];

    const count = marks.filter((mark) =>
      question.passage.includes(mark)
    ).length;

    if (count < 5) {
      errors.push("어휘 표시 ①~⑤ 부족");
    }
  }

  return errors;
}

function makePlans(
  passages: Passage[],
  requests: QuestionRequest[],
  difficulties: string[]
) {
  const types: string[] = [];

  for (const request of requests) {
    if (!ALLOWED_TYPES.includes(request.type)) {
      continue;
    }

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
    difficulties.length > 0
      ? difficulties
      : ["중상"];

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

function makePrompt(
  plans: QuestionPlan[],
  previousQuestions: PreviousQuestion[],
  retryMessage = ""
) {
  return `
당신은 대한민국 고등학교 영어 내신 및 모의고사 전문 출제자입니다.

이번 시스템에서는 오직 아래 6가지 문제만 제작합니다.

1. 제목
2. 주제
3. 요지
4. 내용 일치·불일치
5. 어휘
6. 빈칸 추론

${retryMessage}

[이번 출제 계획]

${JSON.stringify(plans, null, 2)}

[이전에 생성한 문제]

${JSON.stringify(previousQuestions.slice(-80), null, 2)}

==================================================
공통 절대 규칙
==================================================

1.
출제 계획의 type을 절대로 다른 유형으로 변경하지 마세요.

예:
type이 "요지"이면 제목 문제를 만들면 안 됩니다.
type이 "빈칸 추론"이면 반드시 빈칸 추론 문제여야 합니다.

2.
반드시 제공된 영어 원문만 근거로 출제하세요.

3.
원문 내용을 왜곡하거나 존재하지 않는 사실을 만들지 마세요.

4.
학생에게 보여줄 발문에는 문제 제작용 지시를 절대 적지 마세요.

다음 표현은 학생용 문제에 절대 출력하지 않습니다.

- 영어 선택지 우선
- 영어 선지를 우선
- 영어 선택지를 우선
- 제작 지침
- 출제 지침
- 본문에 표시된
- 아래 형식으로
- 다음 단계에서

5.
stem은 실제 시험지에 인쇄되는 짧은 발문만 작성하세요.

6.
문제에 필요한 영어 문장이나 자료를 stem 뒤에 길게 붙이지 마세요.

7.
모든 문제는 5지선다입니다.

8.
정답은 반드시 하나만 존재해야 합니다.

9.
오답은 너무 황당하면 안 됩니다.
본문과 관련성은 있지만 의미상 분명히 틀린 선지를 만드세요.

10.
선택지는 서로 의미가 겹쳐 정답이 2개가 되지 않도록 검토하세요.

11.
최근 출제 이력과 같은 문장, 같은 핵심 포인트, 사실상 동일한 선지를 반복하지 마세요.

12.
한글과 영어가 섞인 이상한 오타를 절대 만들지 마세요.

==================================================
제목
==================================================

stem은 다음처럼 간결하게 작성합니다.

"다음 글의 제목으로 가장 적절한 것은?"

선택지는 영어 제목 5개입니다.

좋은 제목은:
- 글 전체를 포괄
- 지나치게 넓거나 좁지 않음
- 핵심 메시지를 반영

==================================================
주제
==================================================

stem:

"다음 글의 주제로 가장 적절한 것은?"

영어 주제 표현 5개를 제시합니다.

제목 문제와 동일하게 만들지 마세요.

주제는 제목보다 글의 중심 소재와 논점을 직접적으로 표현하세요.

==================================================
요지
==================================================

stem:

"다음 글의 요지로 가장 적절한 것은?"

글쓴이가 전달하려는 핵심 메시지를 묻습니다.

단순 소재 찾기 문제가 되지 않도록 하세요.

선택지는 영어 문장 5개로 구성하세요.

==================================================
내용 일치·불일치
==================================================

둘 중 하나를 자연스럽게 선택합니다.

"다음 글의 내용과 일치하는 것은?"

또는

"다음 글의 내용과 일치하지 않는 것은?"

선택지 5개는 본문의 구체적인 사실을 이용합니다.

정답이 애매해지지 않도록 반드시 본문에서 확인 가능한 내용만 사용하세요.

==================================================
어휘
==================================================

문맥상 어휘 사용의 적절성을 판단하는 문제입니다.

stem:

"밑줄 친 낱말 중 문맥상 적절하지 않은 것은?"

passage 안에 정확히 다섯 개의 어휘를 표시합니다.

예:

①maintain
②reduce
③significant
④ignore
⑤beneficial

반드시 ① ② ③ ④ ⑤ 표시가 passage 안에 실제로 존재해야 합니다.

다섯 단어 중 정확히 하나만 문맥상 부적절하게 바꾸세요.

나머지 네 단어는 원문의 의미와 문맥에 맞아야 합니다.

choices에는 해당 다섯 어휘를 다음처럼 넣습니다.

"① maintain"
"② reduce"
...

문법 문제로 변질시키지 마세요.

==================================================
빈칸 추론
==================================================

이 유형은 특히 중요합니다.

stem:

"다음 빈칸에 들어갈 말로 가장 적절한 것은?"

반드시 passage 안에서 글의 핵심 의미를 담는 한 부분을

________

으로 바꾸세요.

중요:

정답 선택지는 원문에서 삭제한 표현을 그대로 복사하지 마세요.

정답은 원문의 핵심 의미를 자연스럽게
PARAPHRASE한 영어 표현이어야 합니다.

즉 학생이 원문을 여러 번 읽어
원래 문장을 외웠더라도
표현만 보고 바로 답을 알아차리지 않도록 하세요.

하지만:

- 원문 의미와 정확히 같아야 함
- 지나친 의역 금지
- 새로운 정보를 추가하면 안 됨
- 문법적으로 빈칸에 자연스럽게 들어가야 함

예:

원문 의미:
people often follow what the majority does

정답 선택지 예:
people tend to conform to the behavior of others

이런 방식으로 의미는 유지하고 표현을 바꿉니다.

오답 역시 문법적으로는 가능해 보이지만
글 전체의 논리와는 맞지 않게 만드세요.

==================================================
난이도
==================================================

기본:
- 핵심 내용을 정확히 읽으면 풀 수 있음

중상:
- 오답 매력도를 높임
- 한 문장만 보고 바로 답하기 어렵게 함

고난도:
- 글 전체 논리와 핵심 메시지를 함께 파악해야 함
- 오답도 부분적으로는 본문과 관련되게 설계

고난도라고 해서 억지 함정을 만들면 안 됩니다.

==================================================
반환 형식
==================================================

반드시 JSON만 출력하세요.

{
  "questions": [
    {
      "passageId": "계획의 passageId",
      "passageTitle": "계획의 passageTitle",
      "type": "계획의 type",
      "difficulty": "계획의 difficulty",
      "stem": "학생용 발문",
      "passage": "학생용 영어 본문",
      "choices": [
        "① ...",
        "② ...",
        "③ ...",
        "④ ...",
        "⑤ ..."
      ],
      "answer": "정답 번호와 정답 내용",
      "explanation": "왜 이것이 정답인지 본문 근거를 포함한 해설",
      "keyPoint": "이번 문항의 출제 핵심"
    }
  ]
}

출제 계획의 개수와 정확히 같은 개수의 문제를 반환하세요.
`;
}

async function generateBatch(
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

  const sourceQuestions = Array.isArray(parsed?.questions)
    ? parsed.questions
    : [];

  const questions = plans.map((plan, index) =>
    normalize(sourceQuestions[index] || {}, plan)
  );

  const invalid = questions
    .map((question, index) => ({
      index,
      errors: validateQuestion(
        question,
        plans[index]
      ),
    }))
    .filter((item) => item.errors.length > 0);

  if (invalid.length === 0) {
    return questions;
  }

  // 문제가 있는 문항만 재생성
  const retryPlans = invalid.map(
    (item) => plans[item.index]
  );

  const reasons = invalid
    .map(
      (item) =>
        `${plans[item.index].type}: ${item.errors.join(
          ", "
        )}`
    )
    .join("\n");

  const retry = await openai.responses.create({
    model: "gpt-5-mini",
    input: makePrompt(
      retryPlans,
      history,
      `
이전 결과 중 아래 문제가 검수에서 탈락했습니다.

${reasons}

같은 오류를 반복하지 말고 다시 제작하세요.
`
    ),
  });

  const retryRaw = retry.output_text?.trim();

  if (!retryRaw) {
    return questions;
  }

  const retryParsed = JSON.parse(
    cleanJson(retryRaw)
  );

  const retryQuestions = Array.isArray(
    retryParsed?.questions
  )
    ? retryParsed.questions
    : [];

  invalid.forEach((item, retryIndex) => {
    const repaired = normalize(
      retryQuestions[retryIndex] || {},
      plans[item.index]
    );

    const errors = validateQuestion(
      repaired,
      plans[item.index]
    );

    if (errors.length === 0) {
      questions[item.index] = repaired;
    }
  });

  return questions;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

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

    const passages: Passage[] = Array.isArray(
      body?.passages
    )
      ? body.passages
      : [];

    const requests: QuestionRequest[] =
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
        { error: "선택된 지문이 없습니다." },
        { status: 400 }
      );
    }

    const plans = makePlans(
      passages,
      requests,
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

    const openai = new OpenAI({ apiKey });

    // 4문항씩 병렬 생성
    const batches = chunk(plans, 4);

    const results = await Promise.all(
      batches.map((batch) =>
        generateBatch(
          openai,
          batch,
          previousQuestions
        )
      )
    );

    const questions = results
      .flat()
      .map((question, index) => ({
        ...question,
        id: `question-${Date.now()}-${index}`,
      }));

    return Response.json({
      questions,
    });
  } catch (error) {
    console.error(
      "English question engine v3:",
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