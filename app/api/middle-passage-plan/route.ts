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
학생이 내용을 쉽게 기억할 수 있도록
정확히 4컷의 학습만화로 구성하십시오.

이 설계안은 이후 이미지 생성 AI에 그대로 전달됩니다.

==================================================
핵심 목표
==================================================

네 컷을 순서대로 보면
원문의 처음부터 끝까지의 흐름과 핵심 내용을
학생이 직관적으로 이해할 수 있어야 합니다.

단순히 그림 네 장을 만드는 것이 아닙니다.

각 컷에는:

1. 명확한 장면
2. 등장인물
3. 자연스러운 한국어 대사 또는 내레이션

이 들어가야 합니다.

==================================================
매우 중요: 정확히 4컷
==================================================

반드시 정확히 네 컷입니다.

1컷 → 본문 앞부분
2컷 → 다음 흐름
3컷 → 다음 흐름
4컷 → 결론 또는 마지막 흐름

원문의 사건이나 논리 순서를 바꾸지 마십시오.

본문 전체의 핵심 흐름이
네 컷에 고르게 담겨야 합니다.

==================================================
만화 상단 한줄 제목
==================================================

summary는 만화 이미지 맨 위에 크게 들어가는
"한 줄 제목"입니다.

따라서 아주 짧아야 합니다.

규칙:

- 한국어 기준 가급적 10~18자
- 한 줄로 읽혀야 함
- 마침표 금지
- 설명문처럼 길게 쓰지 말 것
- 본문의 핵심 메시지를 압축할 것
- 원래 영어 제목을 그대로 번역할 필요 없음

좋은 예:
"작은 선택이 만드는 변화"
"편견을 깨는 새로운 시선"
"실패 끝에 찾은 성공"
"자연이 알려 준 지혜"

나쁜 예:
"우리가 일상 속에서 어떤 선택을 하느냐에 따라 결과가 달라질 수 있다는 이야기"

==================================================
SCENE
==================================================

scene은 이미지 생성 AI가
실제 장면을 그릴 수 있도록 한국어로 씁니다.

장소, 사람, 행동, 표정,
중요한 물건을 구체적으로 적습니다.

예:

"학교 급식실. 학생들이 음료 냉장고 앞에 서 있다. 생수는 눈높이에 잘 보이고 탄산음료는 아래쪽에 놓여 있다. 한 학생이 자연스럽게 생수를 고른다."

설명문이나 추상적인 본문이라도
가능하면 장면으로 시각화하십시오.

하지만 원문에 없는 핵심 사건을
새로 만들면 안 됩니다.

==================================================
CHARACTERS
==================================================

characters에는 해당 컷의
등장인물 외형을 구체적으로 적습니다.

같은 인물이 여러 컷에 나오면
반드시 동일한 외모가 유지될 수 있도록
같은 설명을 반복하십시오.

예:

"민준: 한국인 중학생 남학생, 짧은 검은 머리, 둥근 안경, 네이비 후드티.
지우: 한국인 중학생 여학생, 어깨까지 오는 검은 머리, 흰 셔츠와 연두색 가디건."

실존 인물이나 역사적 인물이 본문에 등장한다면
본문의 인물 관계와 연령을 존중합니다.

본문이 특정 등장인물 없이
개념이나 사례 중심이라면,
각 사례에 필요한 사람만 자연스럽게 설정할 수 있습니다.

==================================================
DIALOGUE
==================================================

각 컷에는 dialogue 배열이 반드시 있어야 합니다.

대화가 가능한 장면:
등장인물이 자연스럽게 말하게 하십시오.

설명문 또는 혼자 있는 장면:
speaker를 "내레이션"으로 두고
짧은 설명을 넣어도 됩니다.

대사는 한국어 중심으로 작성합니다.

영어 학습에 중요한 핵심 단어나 표현은
자연스럽게 괄호 안에 영어를 넣을 수 있습니다.

예:

{
  "speaker": "민준",
  "text": "이런 작은 유도도 넛지(nudge)라고 해."
}

또는:

{
  "speaker": "내레이션",
  "text": "선택을 금지하지 않고 더 나은 방향으로 이끄는 것이 넛지다."
}

==================================================
대사 길이
==================================================

말풍선이 너무 길어지면 안 됩니다.

한 대사는 가급적:

- 한국어 15~35자 정도
- 최대 두 문장
- 학생이 한눈에 읽을 수 있는 길이

각 컷 대사는 보통 1~2개면 충분합니다.

대사가 필요 이상으로 많으면 안 됩니다.

==================================================
대사의 역할
==================================================

대사는 단순 재미용이 아닙니다.

그 컷에서 학생이 반드시 기억해야 할
본문의 핵심 의미를 전달해야 합니다.

네 컷의 대사를 차례로 읽어도
본문의 핵심 흐름이 이해되어야 합니다.

==================================================
원문 충실성
==================================================

절대로:

- 원문의 핵심 의미를 바꾸지 마십시오.
- 중요한 원인과 결과를 뒤집지 마십시오.
- 본문에 없는 결론을 만들지 마십시오.
- 등장인물 관계를 임의로 바꾸지 마십시오.
- 과장된 사건을 새로 만들지 마십시오.

그러나 학습만화이므로
원문의 긴 문장을 그대로 말풍선에 복사할 필요는 없습니다.

학생이 이해하기 쉬운
짧고 정확한 한국어 대사로 변환하십시오.

==================================================
컷 구성 다양성
==================================================

네 컷이 전부
"두 사람이 서서 이야기하는 장면"이 되지 않게 하십시오.

가능하면:

- 전체 장면
- 행동 장면
- 반응 장면
- 클로즈업
- 사물 중심 장면
- 결과 장면

등을 적절히 섞으십시오.

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
      "characters": "등장인물 외형 설명",
      "dialogue": [
        {
          "speaker": "화자",
          "text": "짧은 대사"
        }
      ]
    },
    {
      "cut": "2컷",
      "scene": "장면 설명",
      "characters": "등장인물 외형 설명",
      "dialogue": [
        {
          "speaker": "화자",
          "text": "짧은 대사"
        }
      ]
    },
    {
      "cut": "3컷",
      "scene": "장면 설명",
      "characters": "등장인물 외형 설명",
      "dialogue": [
        {
          "speaker": "화자",
          "text": "짧은 대사"
        }
      ]
    },
    {
      "cut": "4컷",
      "scene": "장면 설명",
      "characters": "등장인물 외형 설명",
      "dialogue": [
        {
          "speaker": "화자",
          "text": "짧은 대사"
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

            if (
              dialogue.length ===
              0
            ) {
              dialogue.push({
                speaker:
                  "내레이션",

                text:
                  "이 장면의 핵심 내용을 확인해 보자.",
              });
            }

            return {
              cut: `${
                index + 1
              }컷`,

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
      panels.length !==
        4 ||
      panels.some(
        (
          panel
        ) =>
          !panel.scene ||
          !panel.characters ||
          panel.dialogue
            .length === 0
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

    if (
      summary.length >
      22
    ) {
      summary =
        summary.slice(
          0,
          22
        );
    }

    const plan: ComicPlan =
      {
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
      error instanceof
      Error
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