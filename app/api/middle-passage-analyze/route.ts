import OpenAI from "openai";

export const maxDuration = 300;

type Passage = {
  title: string;
  content: string;
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
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error: "OPENAI_API_KEY가 설정되어 있지 않습니다.",
        },
        {
          status: 500,
        }
      );
    }

    const body = await request.json();

    const text =
      typeof body?.text === "string"
        ? body.text.trim()
        : "";

    if (!text) {
      return Response.json(
        {
          error: "분석할 교재 텍스트가 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const openai = new OpenAI({
      apiKey,
    });

    const prompt = `
당신은 대한민국 중학교 영어 교과서와 부교재를 분석하는
전문 영어 교사입니다.

아래 텍스트는 중학교 영어 교재 PDF에서 추출한 전체 텍스트입니다.

이번 작업의 목적은
"본문 써밋네컷 제작에 사용할 영어 본문 원문"을 찾는 것입니다.

새로운 문장을 만들거나 요약하지 마십시오.

==================================================
찾아야 하는 것
==================================================

교재에서 실제 수업용 영어 본문을 찾으십시오.

예:

- Reading
- 본문
- Main Reading
- Read
- Communication 본문이 아닌 긴 읽기 지문
- Lesson의 중심 읽기 자료
- 이야기형 본문
- 설명문형 본문
- 인물 소개 본문
- 문화·과학·사회 주제의 본문

한 Lesson에 본문이 여러 개라면
내용상 독립된 본문 단위로 나누어 반환할 수 있습니다.

==================================================
제외
==================================================

다음은 본문으로 추출하지 마십시오.

- 대화문
- Listen and Speak
- 짧은 회화 예문
- 문법 예문
- 단어 목록
- 어휘 문제
- 객관식 문제
- 빈칸 문제
- 정답
- 해설
- 한국어 해석만 있는 부분
- 단순 활동 지시문
- 목차
- 제목 페이지만 있는 부분
- 본문과 관계없는 짧은 캡션

==================================================
CONTENT
==================================================

content에는 영어 본문 원문만 넣습니다.

절대로:

- 요약하지 마십시오.
- 쉬운 영어로 바꾸지 마십시오.
- 문장을 추가하지 마십시오.
- 문장을 삭제하지 마십시오.
- 순서를 바꾸지 마십시오.

PDF 추출 때문에 문장이 줄바꿈되어 있다면
자연스러운 문장 단위로 연결해도 됩니다.

하지만 원문의 단어와 문장 내용은 유지하십시오.

본문 중간에 문단이 바뀌는 경우
문단 구분은 유지하십시오.

==================================================
TITLE
==================================================

교재에 실제 본문 제목이 있으면 그대로 사용하십시오.

제목이 명확하지 않다면
본문 내용을 바탕으로 아주 짧은 식별용 제목을 붙이십시오.

예:

"본문 1"
"본문 2"

처럼 해도 됩니다.

==================================================
중요
==================================================

하나의 긴 본문을
임의로 여러 개의 작은 지문으로 잘게 나누지 마십시오.

같은 이야기나 같은 설명문이 이어지는 경우
하나의 본문으로 유지하십시오.

페이지가 바뀌어도
내용이 이어지면 같은 본문입니다.

==================================================
JSON
==================================================

반드시 아래 형식의 JSON만 출력하십시오.

{
  "passages": [
    {
      "title": "본문 제목",
      "content": "영어 본문 전체 원문"
    }
  ]
}

JSON 밖의 설명은 쓰지 마십시오.

==================================================
교재 전체 텍스트
==================================================

${text}
`;

    const result =
      await openai.responses.create({
        model: "gpt-5-mini",
        input: prompt,
      });

    const output =
      result.output_text?.trim() ?? "";

    if (!output) {
      throw new Error(
        "본문 분석 결과가 비어 있습니다."
      );
    }

    const parsed =
      parseJsonOutput(output);

    const rawPassages: unknown[] =
      Array.isArray(parsed?.passages)
        ? parsed.passages
        : [];

    const passages: Passage[] =
      rawPassages
        .map((rawPassage: unknown) => {
          const passage =
            rawPassage &&
            typeof rawPassage === "object"
              ? (rawPassage as Record<
                  string,
                  unknown
                >)
              : {};

          return {
            title:
              cleanText(passage.title) ||
              "본문",
            content: cleanText(
              passage.content
            ),
          };
        })
        .filter(
          (passage: Passage) =>
            passage.content.length > 80
        );

    if (passages.length === 0) {
      throw new Error(
        "영어 본문을 찾지 못했습니다."
      );
    }

    return Response.json({
      passages,
    });
  } catch (error: unknown) {
    console.error(
      "MIDDLE PASSAGE ANALYZE ERROR:",
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