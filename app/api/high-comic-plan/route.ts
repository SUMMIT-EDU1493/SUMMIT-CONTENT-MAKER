import OpenAI from "openai";

export const maxDuration = 300;

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

export async function POST(
  request: Request
) {
  try {
    if (
      !process.env.OPENAI_API_KEY
    ) {
      return Response.json(
        {
          error:
            "OPENAI_API_KEY가 설정되어 있지 않습니다.",
        },
        {
          status: 500,
        }
      );
    }

    const body =
      (await request.json()) as RequestBody;

    const schoolName =
      body?.schoolName?.trim() ||
      "";

    const gradeName =
      body?.gradeName?.trim() ||
      "고등부";

    const lessonName =
      body?.lessonName?.trim() ||
      "";

    const sourceText =
      body?.sourceText?.trim() ||
      "";

    if (!sourceText) {
      return Response.json(
        {
          error:
            "본문 텍스트가 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const openai =
      new OpenAI({
        apiKey:
          process.env.OPENAI_API_KEY,
      });

    const response =
      await openai.responses.create({
        model:
          "gpt-5-mini",

        max_output_tokens:
          16000,

        input: `
너는 고등 영어 지문을 각각 "써밋네컷"으로 바꾸는 전문 편집자다.

==================================================
프로젝트 정보
==================================================

학교: ${schoolName || "미입력"}
학년/과정: ${gradeName}
자료명: ${lessonName || "미입력"}

==================================================
가장 중요한 규칙
==================================================

입력 자료에는 서로 독립된 영어 지문이 여러 개 들어 있다.

반드시:

독립된 영어 지문 1개
=
써밋네컷 설계안 1개
=
plans 배열의 항목 1개

로 만들어라.

예:

영어 지문이 1개이면 plans 1개
영어 지문이 6개이면 plans 6개
영어 지문이 10개이면 plans 10개
영어 지문이 15개이면 plans 15개

지문 개수를 임의로 줄이거나 합치지 마라.

절대로 "최대 6개" 같은 제한을 두지 마라.

==================================================
독립 지문 판단 기준
==================================================

입력 PDF 텍스트에는 다음과 같은 정보가 섞여 있을 수 있다.

- 연도
- 월 모의고사
- 문제 번호
- 영어 원문
- 한국어 해석
- 문장 번호
- 페이지 번호
- 저작권 문구
- 기타 안내 문구

독립된 영어 지문은 주로 다음과 같은 형태로 시작한다.

예:

21번 I suspect fungi are...
23번 Empathy is frequently...
24번 We tend to break up time...

"21번", "23번", "24번" 등
문제 번호 뒤에 영어 문장이 시작되면
새로운 독립 영어 지문의 시작일 가능성이 매우 높다.

또한 다음 문구 이후에 나오는 영어 문단을 중요하게 보라.

"지문 읽기"

각 지문의 영어 원문은
그 지문에 딸린 한국어 해석과 구분해야 한다.

==================================================
중요: 한국어 해석 중복 금지
==================================================

각 영어 지문 뒤에는
같은 내용을 번역한 한국어 해석이 붙어 있을 수 있다.

한국어 해석을 별도의 지문으로 세지 마라.

영어 원문 1개 + 그 한국어 해석
=
지문 1개

이다.

한국어 해석은 영어 원문의 의미를 확인하는
보조 자료로만 사용한다.

==================================================
페이지가 나뉘는 경우
==================================================

한 지문의 영어 원문 또는 한국어 해석이
다음 PDF 페이지까지 이어질 수도 있다.

페이지가 바뀌었다는 이유만으로
새 지문으로 판단하지 마라.

반대로 새 페이지에서

- 새로운 모의고사 정보
- 새로운 문제 번호
- 새로운 영어 제목
- "지문 읽기"

가 나타나면
새로운 독립 지문인지 확인하라.

==================================================
써밋네컷 제작 기준
==================================================

각 독립 영어 지문 전체를 이해한 뒤
그 지문 하나를 정확히 4컷으로 재구성한다.

즉,

지문 하나를 다시 여러 장의 만화로 쪼개지 마라.

지문 1개당
반드시 써밋네컷 1장만 만든다.

==================================================
고등 써밋네컷 스타일
==================================================

[톤]

- 고등학생 수준
- 너무 유치한 말투 금지
- 실제 대화처럼 자연스럽게
- 살짝 MZ스러운 표현 가능
- 코믹 포인트 가능
- 그러나 본문의 핵심 의미는 정확해야 함

[대사]

- 영어 본문을 그대로 번역하지 마라.
- 만화 속 실제 대사처럼 재구성한다.
- 짧고 직관적으로 표현한다.
- 한 컷에 지나치게 많은 정보를 넣지 않는다.
- 4컷을 모두 보면 원문의 전체 흐름이 이해되어야 한다.

==================================================
핵심어 삽입
==================================================

각 지문마다 핵심 영어 어휘 3~6개 정도를 골라라.

형식은 반드시:

한글뜻(English)

예:

원동력(driving force)
적응하다(adapt)
회복력(resilience)

핵심어는 만화 대사 속에 자연스럽게 포함한다.

단어장처럼 마지막 컷에 몰아서 넣지 마라.

==================================================
4컷 구성
==================================================

각 plan에는 반드시 정확히 4개의 panel이 있어야 한다.

각 컷:

1컷
2컷
3컷
4컷

각 컷에는 다음 정보가 필요하다.

- cut
- scene
- characters
- dialogue

4컷 모두 같은 배경이나 같은 자세로 만들지 마라.

컷마다:

- 장소
- 표정
- 행동
- 구도

중 최소 하나 이상은 변화하도록 설계한다.

==================================================
sourceRange
==================================================

가능하면 각 지문의 출처를
sourceRange에 적어라.

예:

2023년 09월 모의고사 21번
2024년 03월 모의고사 23번
2024년 06월 모의고사 24번

입력에서 정확히 확인할 수 없는 정보는
억지로 만들어내지 마라.

==================================================
누락 방지 최종 검수
==================================================

JSON을 출력하기 전에 반드시 입력 전체를 다시 확인한다.

1. 독립된 영어 지문의 시작점을 처음부터 끝까지 센다.
2. plans의 개수를 센다.
3. 두 숫자가 같은지 확인한다.
4. 빠진 영어 지문이 있으면 plans에 추가한다.
5. 서로 다른 지문 두 개가 하나의 plan으로 합쳐지지 않았는지 확인한다.
6. 같은 영어 지문을 두 번 만들지 않았는지 확인한다.

특히 입력에 독립 영어 지문이 10개라면
plans도 반드시 10개여야 한다.

==================================================
출력 규칙
==================================================

반드시 JSON만 출력한다.

설명문 금지.
머리말 금지.
코드블록 금지.

형식:

{
  "overallTitle": "자료 전체 제목",
  "overallSummary": "자료 전체에 대한 짧은 설명",
  "plans": [
    {
      "id": "passage-1",
      "englishTitle": "해당 지문의 짧은 영문 제목",
      "koreanSubtitle": "해당 지문의 짧은 한글 부제",
      "blockSummary": "해당 영어 지문의 핵심 내용",
      "sourceRange": "2024년 03월 모의고사 21번",
      "keyWords": [
        "한글뜻(English)",
        "한글뜻(English)"
      ],
      "panels": [
        {
          "cut": "1컷",
          "scene": "장면 설명",
          "characters": "등장인물 설명",
          "dialogue": [
            {
              "speaker": "화자",
              "text": "자연스러운 만화 대사"
            }
          ]
        },
        {
          "cut": "2컷",
          "scene": "장면 설명",
          "characters": "등장인물 설명",
          "dialogue": []
        },
        {
          "cut": "3컷",
          "scene": "장면 설명",
          "characters": "등장인물 설명",
          "dialogue": []
        },
        {
          "cut": "4컷",
          "scene": "장면 설명",
          "characters": "등장인물 설명",
          "dialogue": []
        }
      ]
    }
  ]
}

==================================================
절대 금지
==================================================

- 서로 다른 영어 지문 합치기
- 영어 지문 누락
- 한국어 해석을 별도 지문으로 계산
- 지문 수를 임의로 3~6개로 제한
- 하나의 지문을 여러 plan으로 쪼개기
- 본문 순서 변경
- 4컷보다 많거나 적게 만들기
- 교과서 문장 그대로 직역
- 모든 컷을 같은 구도로 구성
- 지나치게 유치한 말투
- 입력 텍스트 바깥의 설명 추가

==================================================
입력 자료
==================================================

${sourceText}
`,
      });

    const raw =
      response.output_text?.trim();

    if (!raw) {
      throw new Error(
        "고등 써밋네컷 설계안 생성 결과가 비어 있습니다."
      );
    }

    const cleaned =
      raw
        .replace(
          /^```json\s*/i,
          ""
        )
        .replace(
          /^```\s*/i,
          ""
        )
        .replace(
          /\s*```$/,
          ""
        )
        .trim();

    let parsed:
      ParsedResponse;

    try {
      parsed =
        JSON.parse(
          cleaned
        );
    } catch {
      throw new Error(
        "고등 설계안 JSON 해석에 실패했습니다."
      );
    }

    const plans =
      Array.isArray(
        parsed?.plans
      )
        ? parsed.plans
        : [];

    if (
      plans.length ===
      0
    ) {
      throw new Error(
        "생성된 고등 설계안이 없습니다."
      );
    }

    const normalizedPlans =
      plans.map(
        (
          plan,
          index
        ) => ({
          id:
            plan.id ||
            `passage-${index + 1}`,

          englishTitle:
            plan.englishTitle ||
            `Passage ${index + 1}`,

          koreanSubtitle:
            plan.koreanSubtitle ||
            `지문 ${index + 1}`,

          blockSummary:
            plan.blockSummary ||
            "",

          sourceRange:
            plan.sourceRange ||
            "",

          keyWords:
            Array.isArray(
              plan.keyWords
            )
              ? plan.keyWords
              : [],

          panels:
            Array.isArray(
              plan.panels
            )
              ? plan.panels
                  .slice(
                    0,
                    4
                  )
                  .map(
                    (
                      panel,
                      panelIndex
                    ) => ({
                      cut:
                        `${panelIndex + 1}컷`,

                      scene:
                        panel.scene ||
                        "",

                      characters:
                        panel.characters ||
                        "",

                      dialogue:
                        Array.isArray(
                          panel.dialogue
                        )
                          ? panel.dialogue.map(
                              (
                                line
                              ) => ({
                                speaker:
                                  line.speaker ||
                                  "화자",

                                text:
                                  line.text ||
                                  "",
                              })
                            )
                          : [],
                    })
                  )
              : [],
        })
      );

    return Response.json({
      overallTitle:
        parsed.overallTitle ||
        `${lessonName || "고등 영어"} 써밋네컷`,

      overallSummary:
        parsed.overallSummary ||
        "",

      plans:
        normalizedPlans,

      blockCount:
        normalizedPlans.length,
    });
  } catch (
    error: any
  ) {
    console.error(
      "HIGH COMIC PLAN ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "고등 써밋네컷 설계안 생성 중 오류가 발생했습니다.",

        detail:
          error?.message ||
          "알 수 없는 오류",
      },
      {
        status: 500,
      }
    );
  }
}
