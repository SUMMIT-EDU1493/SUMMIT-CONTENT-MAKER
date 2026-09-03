import OpenAI from "openai";

type ComicDialogue = {
  speaker: string;
  text: string;
};

type ComicPanel = {
  cut: string;
  scene: string;
  characters: string;
  dialogue: ComicDialogue[];
};

type HighComicPlan = {
  id: string;
  englishTitle: string;
  koreanSubtitle: string;
  blockSummary: string;
  sourceRange: string;
  keyWords: string[];
  panels: ComicPanel[];
};

type RequestBody = {
  schoolName?: string;
  gradeName?: string;
  lessonName?: string;
  sourceText?: string;
};

type ParsedResponse = {
  overallTitle?: string;
  overallSummary?: string;
  plans?: HighComicPlan[];
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        {
          error: "OPENAI_API_KEY가 설정되어 있지 않습니다.",
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as RequestBody;

    const schoolName = body?.schoolName?.trim() || "";
    const gradeName = body?.gradeName?.trim() || "고등부";
    const lessonName = body?.lessonName?.trim() || "";
    const sourceText = body?.sourceText?.trim() || "";

    if (!sourceText) {
      return Response.json(
        {
          error: "본문 텍스트가 없습니다.",
        },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: `
너는 고등 영어 본문을 "여러 장의 써밋네컷 설계안"으로 바꾸는 전문 편집자다.

==================================================
프로젝트 정보
==================================================

학교: ${schoolName || "미입력"}
학년/과정: ${gradeName}
Lesson: ${lessonName || "미입력"}

==================================================
중요 목표
==================================================

긴 고등 영어 본문을 읽고,
의미 흐름에 맞게 3~6개의 "블록"으로 나눈 뒤,
각 블록마다 4컷 만화 설계안을 만들어라.

각 블록 = 써밋네컷 1장 분량이다.

즉,
본문 전체 → 여러 개의 4컷 설계안들
형태로 만들어야 한다.

==================================================
입력 텍스트 특징
==================================================

입력 텍스트에는 다음이 섞여 있을 수 있다:

- 영어 원문
- 한국어 해석
- 문장 번호
- 페이지 번호
- 제목
- 저작권 문구
- 중복 텍스트

반드시 다음 기준을 따를 것:

1. 본문의 "영어 원문 흐름"을 가장 우선 기준으로 삼아라.
2. 한국어 해석은 보조 참고용으로만 사용해라.
3. 저작권 문구, 페이지 번호, 잡문은 제거해라.
4. 문단/문장 순서를 절대 뒤섞지 마라.
5. 앞부분-중간-뒷부분 흐름이 유지되어야 한다.
6. 문단 단순 분할이 아니라 "의미 덩어리" 기준으로 나눠라.

==================================================
고등 써밋네컷 스타일 규칙
==================================================

이건 중등용이 아니다.
고등용이므로 아래 스타일을 반드시 지켜라.

[톤]
- 중등보다 더 성숙한 톤
- 너무 유치하면 안 됨
- 설명문체보다 실제 대화처럼
- 살짝 MZ 톤 가능
- 코믹 포인트 가능
- 그러나 본문 내용이 흐트러지면 안 됨

[대사 방식]
- 본문을 그대로 번역하지 말고
  "만화 속 대사"처럼 자연스럽게 재구성
- 말투는 생동감 있게
- 너무 딱딱한 교과서 해석투 금지
- 한 컷에 정보만 잔뜩 넣지 말 것
- 짧고 강한 대사 + 필요한 설명 조합으로 구성

[어휘 삽입]
- 각 블록마다 핵심어 3~6개 정도만 자연스럽게 넣어라
- 형식은 반드시:
  한글뜻(English)
- 예:
  원동력(driving force)
  적응하다(adapt)
  회복력(resilience)

- 핵심어는 대사 속에 자연스럽게 섞어라
- 억지로 마지막에 단어장처럼 붙이지 마라

[장면 연출]
- 컷마다 장면 변화가 보여야 함
- 4컷 모두 같은 배경/같은 자세 금지
- 표정, 구도, 동작, 장소를 바꿔라
- 인물이 서 있기만 하는 만화 금지
- 웹툰처럼 눈길을 끄는 장면 설계
- 필요하면 내레이션형 컷이나 설명 캐릭터 활용 가능

==================================================
블록 분할 규칙
==================================================

- 전체 본문을 읽고 "자연스러운 의미 흐름" 기준으로 3~6개 블록으로 분할
- 각 블록은 독립적으로 이해되지만,
  전체로 보면 순서대로 연결되어야 함
- 마지막 블록은 필요하면 conclusion/정리 역할 가능
- 실존 인물 두 명 이상이 나오면
  인물별로 블록이 나뉠 수 있음
- 단, 무조건 인물 기준으로만 나누지 말고
  "의미 전환점"을 기준으로 판단해라

==================================================
컷 구성 규칙
==================================================

각 블록마다 반드시 4컷.

각 컷에는 아래 정보 필요:
- cut: "1컷", "2컷" ...
- scene: 장면 설명
- characters: 등장인물 설명
- dialogue: 대사 배열

dialogue는 예를 들어:
[
  { "speaker": "학생1", "text": "..." },
  { "speaker": "학생2", "text": "..." }
]

화자 이름은 이해하기 쉬운 방식으로 붙여라.
예:
- 학생1
- 학생2
- 해설자
- Luca
- Lynsey
- 기자
- 감독
등

==================================================
출력 규칙
==================================================

반드시 JSON만 출력.
설명문, 머리말, 코드블록 표시 절대 금지.

JSON 형식:

{
  "overallTitle": "Lesson 전체를 한 줄로 요약한 제목",
  "overallSummary": "본문 전체 핵심 요약",
  "plans": [
    {
      "id": "block-1",
      "englishTitle": "영문 소제목",
      "koreanSubtitle": "한글 부제",
      "blockSummary": "이 블록 핵심 요약",
      "sourceRange": "본문 앞부분 / Luca 파트 초반 / 결론부 등",
      "keyWords": ["원동력(driving force)", "적응하다(adapt)"],
      "panels": [
        {
          "cut": "1컷",
          "scene": "장면 설명",
          "characters": "등장인물 외형/분위기 설명",
          "dialogue": [
            {
              "speaker": "학생1",
              "text": "자연스러운 대사"
            }
          ]
        }
      ]
    }
  ]
}

==================================================
절대 금지
==================================================

- 교과서 문장을 거의 그대로 직역
- 모든 컷이 같은 구도
- 중학생처럼 유치한 말투
- 핵심어가 하나도 안 들어감
- 영어 핵심어를 대사 끝에 무더기로 몰아넣기
- 본문 순서 섞기
- 4컷보다 많거나 적게 만들기
- 블록 수 3개 미만 또는 6개 초과
- 텍스트 바깥 설명 추가

==================================================
입력 본문
==================================================

${sourceText}
`,
    });

    const raw = response.output_text?.trim();

    if (!raw) {
      throw new Error("고등 써밋네컷 설계안 생성 결과가 비어 있습니다.");
    }

    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    let parsed: ParsedResponse;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("고등 설계안 JSON 해석에 실패했습니다.");
    }

    const plans = Array.isArray(parsed?.plans) ? parsed.plans : [];

    if (plans.length === 0) {
      throw new Error("생성된 고등 설계안이 없습니다.");
    }

    const normalizedPlans = plans.map((plan, index) => ({
      id: plan.id || `block-${index + 1}`,
      englishTitle: plan.englishTitle || `Block ${index + 1}`,
      koreanSubtitle: plan.koreanSubtitle || `블록 ${index + 1}`,
      blockSummary: plan.blockSummary || "",
      sourceRange: plan.sourceRange || "",
      keyWords: Array.isArray(plan.keyWords) ? plan.keyWords : [],
      panels: Array.isArray(plan.panels)
        ? plan.panels.map((panel, panelIndex) => ({
            cut: panel.cut || `${panelIndex + 1}컷`,
            scene: panel.scene || "",
            characters: panel.characters || "",
            dialogue: Array.isArray(panel.dialogue)
              ? panel.dialogue.map((line) => ({
                  speaker: line.speaker || "화자",
                  text: line.text || "",
                }))
              : [],
          }))
        : [],
    }));

    return Response.json({
      overallTitle: parsed.overallTitle || `${lessonName} 고등 써밋네컷`,
      overallSummary: parsed.overallSummary || "",
      plans: normalizedPlans,
      blockCount: normalizedPlans.length,
    });
  } catch (error: any) {
    console.error("HIGH COMIC PLAN ERROR:", error);

    return Response.json(
      {
        error: "고등 써밋네컷 설계안 생성 중 오류가 발생했습니다.",
        detail: error?.message || "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}