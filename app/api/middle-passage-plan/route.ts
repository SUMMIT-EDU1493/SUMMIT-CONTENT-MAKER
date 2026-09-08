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

type ComicPlan = {
  title: string;
  summary: string;
  panels: ComicPanel[];
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseJsonOutput(output: string) {
  const cleaned = output
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

export async function POST(request: Request) {
  try {
    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "OPENAI_API_KEY가 설정되지 않았습니다.",
        },
        {
          status: 500,
        }
      );
    }

    const body =
      await request.json();

    const title =
      cleanText(body?.title) ||
      "본문";

    const content =
      cleanText(body?.content);

    if (!content) {
      return Response.json(
        {
          error:
            "분석할 본문이 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const openai =
      new OpenAI({
        apiKey,
      });

    const prompt = `
당신은 대한민국 중학생용 영어 학습만화
"써밋네컷"을 설계하는 전문 영어교사입니다.

아래 영어 교과서 본문을
학생이 내용을 쉽게 이해하고,
핵심 영어 단어까지 함께 기억할 수 있도록
정확히 4컷의 학습만화로 구성하십시오.

==================================================
핵심 목표
==================================================

네 컷을 순서대로 보면
원문의 처음부터 끝까지의 흐름과 핵심 내용을
학생이 직관적으로 이해할 수 있어야 합니다.

각 컷에는 반드시:

1. 명확한 장면
2. 등장인물
3. 짧고 자연스러운 한국어 대사 또는 내레이션
4. 원문에서 실제로 중요한 영어 단어 또는 표현

이 포함되어야 합니다.

==================================================
정확히 4컷
==================================================

반드시 정확히 네 컷입니다.

1컷 → 본문 앞부분
2컷 → 다음 흐름
3컷 → 다음 흐름
4컷 → 결론 또는 마지막 흐름

본문의 순서를 바꾸지 마십시오.

본문 전체의 핵심 흐름이
네 컷에 고르게 들어가야 합니다.

==================================================
만화 상단 한줄 제목
==================================================

summary는 이미지 맨 위에 들어가는
짧은 한 줄 제목입니다.

규칙:

- 한국어 기준 10~18자 권장
- 최대 22자
- 마침표 금지
- 설명문처럼 길게 쓰지 말 것
- 핵심 메시지만 압축할 것

예:

"작은 선택이 만드는 변화"
"편견을 깨는 새로운 시선"
"실패 끝에 찾은 성공"

==================================================
매우 중요: 영어 핵심어
==================================================

이 자료는 영어 학습용입니다.

따라서 한국어 뜻만 있는 만화가 되어서는 안 됩니다.

각 컷의 dialogue 안에는
원문에서 학생이 기억할 만한
핵심 영어 단어 또는 표현을
최소 1개 이상 포함하십시오.

가능하면 전체 네 컷을 합쳐
핵심 영어 단어 또는 표현이
약 5~10개 정도 자연스럽게 등장하도록 하십시오.

반드시 아래 형식을 우선 사용하십시오.

한국어 뜻(English)

예:

선택(choice)
영향을 미치다(influence)
행동(behavior)
기본 설정(default)
선택에서 제외하다(opt out)
미묘하게(subtly)
결정(decision)
안전(safety)

짧은 영어 표현도 가능합니다.

예:

더 나은 결정을 하다(make better decisions)
올바른 방향으로 이끌다(guide in the right direction)

==================================================
영어 단어 선택 기준
==================================================

아무 단어나 넣지 마십시오.

다음 중 중요한 것만 고르십시오.

- 본문의 주제어
- 반복되는 핵심어
- 시험에 나올 가능성이 높은 어휘
- 내용 이해에 꼭 필요한 동사
- 핵심 개념어
- 중요한 구동사
- 주요 숙어 또는 표현

너무 쉬운 단어를 억지로 많이 넣지 마십시오.

예:

good
people
thing
go

같은 단순 단어보다

behavior
influence
default
preserve
reduce
encourage

같은 핵심어를 우선하십시오.

==================================================
영어 표현 정확성
==================================================

영어 단어와 표현은
반드시 원문에서 실제로 사용된 표현을 우선합니다.

원문에 없는 어려운 표현을
임의로 만들어 넣지 마십시오.

필요한 경우 원문의 활용형을
기본형으로 제시할 수 있습니다.

예:

reduced → 줄이다(reduce)
influenced → 영향을 미치다(influence)

==================================================
SCENE
==================================================

scene은 이미지 생성 AI가
실제 장면을 그릴 수 있도록 한국어로 씁니다.

장소, 사람, 행동, 표정,
중요한 물건을 구체적으로 적습니다.

네 컷이 전부
사람 두 명이 서서 말하는 장면이 되지 않게 하십시오.

가능하면:

- 전체 장면
- 행동 장면
- 반응 장면
- 클로즈업
- 사물 중심
- 결과 장면

등을 섞으십시오.

==================================================
CHARACTERS
==================================================

characters에는 해당 컷의
등장인물 외형을 구체적으로 적습니다.

같은 인물이 여러 컷에 나오면
같은 외모를 유지하십시오.

예:

"민준: 한국인 중학생 남학생, 짧은 검은 머리, 둥근 안경, 네이비 후드티.
지우: 한국인 중학생 여학생, 어깨까지 오는 검은 머리, 흰 셔츠와 연두색 가디건."

==================================================
DIALOGUE
==================================================

각 컷에는 dialogue 배열이 반드시 있어야 합니다.

대사가 가능한 장면이면
등장인물이 직접 말하게 합니다.

설명문이나 인물이 없는 장면이면
speaker를 "내레이션"으로 사용합니다.

대사는 학생이 한눈에 읽을 수 있도록
짧고 명확하게 작성합니다.

각 컷은 보통 1~2개의 말풍선이면 충분합니다.

==================================================
대사 길이
==================================================

한 대사는 가급적:

- 한국어 약 15~35자
- 최대 두 문장
- 너무 긴 설명 금지

그러나 핵심 영어 단어는
대사 안에서 반드시 유지하십시오.

예:

"이런 작은 개입을 넛지(nudge)라고 해."

"선택(choice)은 그대로 두면서 행동(behavior)을 이끄는 거야."

"기본 설정(default)을 바꾸면 선택도 달라질 수 있어."

==================================================
대사의 역할
==================================================

대사 네 컷만 순서대로 읽어도
본문의 핵심 흐름이 이해되어야 합니다.

단순 재미용 대사는 피하십시오.

==================================================
원문 충실성
==================================================

절대로:

- 원문의 핵심 의미를 바꾸지 마십시오.
- 원인과 결과를 뒤집지 마십시오.
- 본문에 없는 결론을 만들지 마십시오.
- 중요한 사례를 엉뚱한 사례로 바꾸지 마십시오.

==================================================
JSON
==================================================

반드시 아래 형식의 JSON만 반환하십시오.

{
  "title": "본문 또는 만화 제목",
  "summary": "짧은 만화 상단 한줄 제목",
  "panels": [
    {
      "cut": "1컷",
      "scene": "장면 설명",
      "characters": "등장인물 설명",
      "dialogue": [
        {
          "speaker": "화자",
          "text": "한국어 대사 속 핵심 영어 단어(English)"
        }
      ]
    },
    {
      "cut": "2컷",
      "scene": "장면 설명",
      "characters": "등장인물 설명",
      "dialogue": [
        {
          "speaker": "화자",
          "text": "한국어 대사 속 핵심 영어 단어(English)"
        }
      ]
    },
    {
      "cut": "3컷",
      "scene": "장면 설명",
      "characters": "등장인물 설명",
      "dialogue": [
        {
          "speaker": "화자",
          "text": "한국어 대사 속 핵심 영어 단어(English)"
        }
      ]
    },
    {
      "cut": "4컷",
      "scene": "장면 설명",
      "characters": "등장인물 설명",
      "dialogue": [
        {
          "speaker": "화자",
          "text": "한국어 대사 속 핵심 영어 단어(English)"
        }
      ]
    }
  ]
}

JSON 외에는 아무것도 출력하지 마십시오.

==================================================
본문 제목
==================================================

${title}

==================================================
영어 본문
==================================================

${content}
`;

    const result =
      await openai.responses.create({
        model: "gpt-5-mini",
        input: prompt,
      });

    const output =
      result.output_text?.trim() ??
      "";

    if (!output) {
      throw new Error(
        "써밋네컷 설계 결과가 비어 있습니다."
      );
    }

    const parsed =
      parseJsonOutput(output);

    const rawPanels =
      Array.isArray(parsed?.panels)
        ? parsed.panels
        : [];

    const panels: ComicPanel[] =
      rawPanels
        .slice(0, 4)
        .map(
          (
            rawPanel: unknown,
            index: number
          ) => {
            const panel =
              rawPanel &&
              typeof rawPanel ===
                "object"
                ? (rawPanel as Record<
                    string,
                    unknown
                  >)
                : {};

            const rawDialogue =
              Array.isArray(
                panel.dialogue
              )
                ? panel.dialogue
                : [];

            const dialogue: ComicDialogue[] =
              rawDialogue
                .map(
                  (
                    raw: unknown
                  ) => {
                    const item =
                      raw &&
                      typeof raw ===
                        "object"
                        ? (raw as Record<
                            string,
                            unknown
                          >)
                        : {};

                    return {
                      speaker:
                        cleanText(
                          item.speaker
                        ) ||
                        "내레이션",

                      text:
                        cleanText(
                          item.text
                        ),
                    };
                  }
                )
                .filter(
                  (
                    item
                  ) =>
                    Boolean(
                      item.text
                    )
                );

            return {
              cut: `${index + 1}컷`,

              scene:
                cleanText(
                  panel.scene
                ),

              characters:
                cleanText(
                  panel.characters
                ),

              dialogue,
            };
          }
        );

    if (
      panels.length !== 4 ||
      panels.some(
        (panel) =>
          !panel.scene ||
          !panel.characters ||
          panel.dialogue.length === 0
      )
    ) {
      throw new Error(
        "4컷 설계안을 완성하지 못했습니다."
      );
    }

    let summary =
      cleanText(
        parsed?.summary
      ) ||
      "본문 흐름 한눈에 보기";

    if (summary.length > 22) {
      summary =
        summary.slice(
          0,
          22
        );
    }

    const plan: ComicPlan = {
      title:
        cleanText(
          parsed?.title
        ) ||
        title,

      summary,

      panels,
    };

    return Response.json(
      plan
    );
  } catch (
    error: unknown
  ) {
    console.error(
      "MIDDLE PASSAGE PLAN ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류";

    return Response.json(
      {
        error:
          message,

        detail:
          message,
      },
      {
        status: 500,
      }
    );
  }
}