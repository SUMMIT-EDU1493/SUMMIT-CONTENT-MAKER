import OpenAI from "openai";

export const maxDuration = 300;

type Panel = {
  cut: string;
  sourceText: string;
  scene: string;
  caption: string;
};

type PassagePlan = {
  title: string;
  summary: string;
  panels: Panel[];
};

function parseJsonOutput(output: string) {
  const cleaned = output
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: Request) {
  try {
    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
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
당신은 대한민국 중학교 영어 수업용
시각 학습자료를 설계하는 전문 영어교사입니다.

아래 영어 본문을
정확히 4개의 흐름으로 나누어
"써밋네컷" 설계안을 만드십시오.

중요:
이 단계에서는 이미지를 만들지 않습니다.
본문을 네 컷으로 어떻게 시각화할지만 설계합니다.

==================================================
가장 중요한 원칙
==================================================

1. 반드시 정확히 4컷이어야 합니다.

2. 본문의 처음부터 끝까지
전체 흐름이 빠지지 않도록 나눕니다.

3. 본문의 문장 순서를 바꾸지 않습니다.

4. 같은 내용을 여러 컷에서
중복하지 않습니다.

5. 네 컷을 순서대로 보면
학생이 본문 전체 흐름을 이해할 수 있어야 합니다.

6. 임의의 새로운 사건이나
본문에 없는 정보를 만들지 않습니다.

==================================================
sourceText
==================================================

각 컷에 해당하는
영어 본문 원문 부분을 넣습니다.

반드시 실제 원문의 표현을 사용하십시오.

요약하거나 다른 영어 표현으로
바꾸지 마십시오.

각 컷끼리 sourceText가
겹치지 않도록 하십시오.

본문 전체가
1컷 → 2컷 → 3컷 → 4컷에
순서대로 배분되어야 합니다.

==================================================
scene
==================================================

이미지 생성 AI가 이해할 수 있도록
그 컷에서 보여줄 장면을
한국어로 구체적으로 설명합니다.

예:

"학교 복도에서 한 학생이 친구에게 새로운 아이디어를 설명하고 있고, 친구는 놀란 표정으로 듣고 있다."

장소, 인물, 행동, 표정,
중요 소품 등을 포함하십시오.

단,
본문에 없는 사건을 새로 만들면 안 됩니다.

본문이 추상적인 설명문이면
억지로 등장인물을 만들기보다
개념을 시각적으로 표현할 수 있는
장면을 설계하십시오.

==================================================
caption
==================================================

학생이 그림을 보며
해당 컷의 핵심을 빠르게 이해하도록
한국어 한 문장으로 작성합니다.

길게 해설하지 마십시오.

본문의 핵심 흐름을
쉽고 정확하게 표현하십시오.

==================================================
summary
==================================================

본문 전체의 핵심을
한국어 1~2문장으로 정리합니다.

==================================================
JSON
==================================================

반드시 아래 형식의 JSON만 출력하십시오.

{
  "title": "본문 제목",
  "summary": "본문 전체 핵심 요약",
  "panels": [
    {
      "cut": "1컷",
      "sourceText": "1컷에 해당하는 영어 원문",
      "scene": "장면 설명",
      "caption": "한국어 핵심 문장"
    },
    {
      "cut": "2컷",
      "sourceText": "2컷에 해당하는 영어 원문",
      "scene": "장면 설명",
      "caption": "한국어 핵심 문장"
    },
    {
      "cut": "3컷",
      "sourceText": "3컷에 해당하는 영어 원문",
      "scene": "장면 설명",
      "caption": "한국어 핵심 문장"
    },
    {
      "cut": "4컷",
      "sourceText": "4컷에 해당하는 영어 원문",
      "scene": "장면 설명",
      "caption": "한국어 핵심 문장"
    }
  ]
}

JSON 밖의 설명은 쓰지 마십시오.

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

    const panels: Panel[] =
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

            return {
              cut: `${index + 1}컷`,
              sourceText:
                cleanText(
                  panel.sourceText
                ),
              scene:
                cleanText(
                  panel.scene
                ),
              caption:
                cleanText(
                  panel.caption
                ),
            };
          }
        );

    if (
      panels.length !== 4 ||
      panels.some(
        (panel) =>
          !panel.sourceText ||
          !panel.scene ||
          !panel.caption
      )
    ) {
      throw new Error(
        "4컷 설계안을 완성하지 못했습니다."
      );
    }

    const plan: PassagePlan = {
      title:
        cleanText(parsed?.title) ||
        title,

      summary:
        cleanText(
          parsed?.summary
        ),

      panels,
    };

    return Response.json(plan);
  } catch (error: unknown) {
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
        error: message,
        detail: message,
      },
      {
        status: 500,
      }
    );
  }
}