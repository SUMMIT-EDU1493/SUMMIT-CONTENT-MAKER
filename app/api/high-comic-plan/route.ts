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
  visualStyle?: string;
  storyMode?: string;
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
시각 스타일과 스토리 전개 방식
==================================================

각 독립 영어 지문마다 아래 두 항목을 반드시 정하라.

- visualStyle
- storyMode

visualStyle은 다음 후보를 골고루 사용한다.

1. graphic novel
   - 강한 명암, 드라마틱한 구도, 그래픽노블 느낌

2. editorial illustration
   - 잡지 삽화처럼 세련되고 개념적인 시각 표현

3. cinematic storyboard
   - 영화 장면처럼 카메라 구도와 빛을 적극 활용

4. modern webtoon
   - 현대적인 한국 웹툰 스타일

5. ink drawing comic
   - 펜·잉크 드로잉과 강한 선 중심

6. painterly illustration
   - 회화적인 질감과 분위기 중심

7. collage magazine comic
   - 매거진 콜라주와 편집 디자인 감각

8. retro comic book
   - 빈티지 코믹북, 하프톤과 강한 프레이밍

9. minimal conceptual illustration
   - 인물 대화보다 개념과 상징을 시각적으로 표현

10. infographic comic
   - 정보·비교·과정을 그림 속에서 직관적으로 보여주는 방식

연속된 두 지문에 같은 visualStyle을 사용하지 마라.
전체 자료 안에서 특정 스타일만 반복하지 마라.

storyMode는 다음 방식을 골고루 섞는다.

- character dialogue
- narrator driven
- visual metaphor
- comparison
- process sequence
- cause and effect
- symbolic scene
- real world example
- documentary style
- inner monologue

매번 학생 2~3명이 서서 대화하는 구조로 만들지 마라.

중요:
4컷 모두가 인물 간 대화로만 이루어지는 plan은 금지한다.

각 plan의 4컷 중 최소 1컷,
가능하면 2컷은 다음 중 하나로 구성한다.

- 인물 없는 상징 장면
- 짧은 내레이션 중심 장면
- 개념을 시각화한 장면
- 실제 사례 재현
- 비교 장면
- 원인 → 결과 장면
- 사물이나 환경 중심 장면
- 극적인 클로즈업
- 공간 전체를 보여주는 장면

본문이 추상적인 설명문이라면
억지로 학생 두 명이 그 내용을 설명하게 하지 말고,
시각적 비유와 상황 자체로 보여줘라.


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
대사 말투 자연스러움 — 매우 중요
==================================================

만화 대사는 보고서 문장이나 교과서 해설문처럼 쓰지 마라.

특히 해설자, 전문가, 연구자, 과학자 등이 말한다고 해서
모든 대사를 "~한다.", "~이다.", "~된다." 같은
딱딱한 서술체로 끝내지 마라.

dialogue는 실제 사람이 입으로 말하는 문장이어야 한다.

좋지 않은 예:
"다양성은 조직의 적응력을 높인다."
"이 현상은 인간의 인지 과정에서 발생한다."
"공감은 상대방의 감정을 이해하는 능력이다."

좋은 예:
"다양성이 있으면 변화에 훨씬 잘 적응할 수 있어요."
"이런 현상이 우리 생각하는 방식에서도 나타나는 거죠."
"쉽게 말하면, 상대의 입장에서 느껴보는 게 공감이에요."

화자에 따라 말투를 자연스럽게 달리한다.

- 학생끼리 대화: 자연스러운 일상 구어체
- 교사·전문가·연구자: 설명은 정확하되 자연스러운 말투
- 해설자: 짧고 리듬감 있는 내레이션
- 혼잣말: 실제 생각처럼 자연스럽게
- 관람객·회사원 등 일반 인물: 상황에 맞는 생활 말투

모든 문장을 억지로 반말로 만들 필요는 없다.
반대로 모든 문장을 딱딱한 문어체로 만들지도 마라.

핵심은:
"이 사람이 실제 만화 속에서 이렇게 말할 법한가?"
를 기준으로 작성하는 것이다.

짧은 감탄, 질문, 반응도 적절히 섞어
4컷 전체가 설명문을 잘라놓은 것처럼 보이지 않게 한다.

단,
- 지나치게 유치한 말투 금지
- 과한 인터넷 은어 금지
- 핵심 의미 왜곡 금지
- 영어 학습 핵심어 한글뜻(English) 형식은 그대로 유지

==================================================
핵심어 삽입
==================================================

각 지문마다 핵심 영어 어휘 5~8개 정도를 골라라.

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
절대 규칙: 대사 언어
==================================================

모든 panels[].dialogue[].text는 반드시 한국어로 작성한다.

영어 문장 전체를 dialogue.text에 쓰는 것은 절대 금지한다.

영어는 오직 영어 학습 핵심어를 다음 형태로 넣을 때만 허용한다.

한글뜻(English)

예:
다양성(diversity)
회복력(resilience)
객관성(objectivity)

다음은 금지:
"This makes me uneasy."
"Artists use discomfort to make us think."
"Science needs diversity."

반드시 다음처럼 작성:
"이 장면, 좀 불편하게 느껴지지?"
"그 불편함이 오히려 변화(transformation)를 만들 수도 있어."
"과학에서도 다양성(diversity)이 중요한 이유가 바로 이거야."

speaker 이름도 가능하면 한국어로 작성한다.

예:
해설자
학생
관람객
연구자
회사원
과학자

Narrator, Visitor 1, Student A 같은 영어 화자명은 사용하지 않는다.

JSON을 출력하기 직전에
모든 dialogue.text를 다시 검사하여
영어 문장으로 된 대사가 하나라도 있으면 반드시 한국어로 고친다.

==================================================
핵심 영어 어휘
==================================================

각 지문마다 keyWords는 반드시 5~8개를 선택한다.

keyWords 배열에 넣기만 하고 끝내지 마라.

선택한 핵심어 중 최소 5개는
반드시 실제 4컷 대사 안에도 자연스럽게 등장해야 한다.

형식은 반드시:
한글뜻(English)

한 컷에 몰아넣지 말고 4컷 전체에 분산한다.

가능하면:
- 1컷 1~2개
- 2컷 1~2개
- 3컷 1~2개
- 4컷 1~2개

정도로 배치한다.

영어 학습 만화라는 점이 눈에 보여야 하지만,
단어장처럼 보이게 만들지는 않는다.

==================================================
스토리 구성 다양화
==================================================

"두 사람이 서서 설명하고 상대가 반응하는 구조"를 기본값으로 사용하지 마라.

4컷 모두 대화 장면으로 만드는 것을 금지한다.

다만 인물을 지나치게 없애는 것도 금지한다.

각 써밋네컷은 원칙적으로:
- 최소 2컷은 인물이 등장하는 생동감 있는 장면
- 최대 1컷 정도만 순수 사물/풍경/상징 장면
- 나머지는 상황 재현, 행동, 비교, 사건 전개 등

으로 구성한다.

좋은 예:
1컷: 실제 상황 또는 문제 제시
2컷: 행동이나 사건 발생
3컷: 시각적 비유 또는 결과
4컷: 인물의 반응과 핵심 결론

설명문이라도 억지로 학생들이 강의하듯 말하게 하지 말고,
본문 속 개념을 실제 사건과 장면으로 보여준다.

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
      "visualStyle": "graphic novel",
      "storyMode": "visual metaphor",
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

          visualStyle:
            plan.visualStyle ||
            [
              "graphic novel",
              "editorial illustration",
              "cinematic storyboard",
              "modern webtoon",
              "ink drawing comic",
              "painterly illustration",
              "collage magazine comic",
              "retro comic book",
              "minimal conceptual illustration",
              "infographic comic",
            ][index % 10],

          storyMode:
            plan.storyMode ||
            [
              "visual metaphor",
              "real world example",
              "comparison",
              "narrator driven",
              "cause and effect",
              "symbolic scene",
              "process sequence",
              "documentary style",
              "inner monologue",
              "character dialogue",
            ][index % 10],

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
