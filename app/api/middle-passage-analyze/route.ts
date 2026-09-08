import OpenAI from "openai";

export const maxDuration = 300;

type Passage = {
  title: string;
  content: string;
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

export async function POST(
  request: Request
) {
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

    const text =
      cleanText(body?.text);

    if (!text) {
      return Response.json(
        {
          error:
            "분석할 교재 내용이 없습니다.",
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
당신은 대한민국 중학교 영어 교재의
READING 본문을 정확히 추출하는 전문 편집자입니다.

아래에는 PDF에서 추출한
영어 교재 전체 텍스트가 있습니다.

이 텍스트에서
실제 영어 읽기 본문만 찾아
원문 그대로 반환하십시오.

==================================================
가장 중요한 규칙: 실제 Reading 단위를 정확히 구분하십시오
==================================================

목표는 두 가지를 동시에 만족하는 것입니다.

1. 하나의 Reading 본문을 중간에서 쪼개지 않는다.
2. 서로 다른 Reading 본문을 하나로 합치지 않는다.

"무조건 합치기"도,
"무조건 나누기"도 하지 마십시오.

교재에서 실제로 하나의 읽기 본문인지
서로 독립된 두 개 이상의 읽기 본문인지 판단하십시오.

==================================================
같은 본문으로 유지해야 하는 경우
==================================================

다음은 새 passage의 근거가 아닙니다.

- PDF 페이지가 바뀜
- 본문이 다음 페이지에 계속 이어짐
- 단순한 문단 변경
- 한 글 내부의 소제목
- 같은 사건이나 설명이 계속 이어짐
- 인터뷰 한 편의 질문과 답변이 이어짐
- 같은 글 안에서 관점이나 화제가 일부 전환됨

페이지 표시:

--- 1페이지 ---
--- 2페이지 ---

등은 PDF 구조일 뿐이며
그 자체로 새로운 본문을 의미하지 않습니다.

==================================================
새로운 passage로 반드시 분리해야 하는 경우
==================================================

다음과 같은 독립성의 신호가 있으면
새로운 passage로 분리하십시오.

- 새로운 Reading / Read 제목이 시작됨
- 새로운 독립 제목과 함께 새 글이 시작됨
- 앞 글이 문맥상 완전히 끝난 뒤 새 도입부가 시작됨
- 새로운 인물 소개가 처음부터 다시 시작됨
- 새로운 직업, 인물, 사건, 장소, 주제를 별개의 글로 소개함
- 앞 글과 관계없는 새로운 상황 설명이 시작됨
- 교재 구성상 별개의 Reading 본문이 연속해서 배치됨
- 각각 따로 읽어도 완결되는 독립된 글이 두 개 이상 존재함

중요:

같은 단원 안에 있다는 이유만으로
여러 Reading을 하나로 합치면 안 됩니다.

비슷한 주제라는 이유만으로도
하나의 passage로 합치면 안 됩니다.

예를 들어 같은 단원에서
서로 다른 직업을 각각 소개하는 독립된 글이 있다면
각각 별도의 passage입니다.

같은 '직업'이라는 공통 주제가 있어도
한 글로 합치지 마십시오.

==================================================
경계 판단 방법
==================================================

새로운 글이 시작되는 지점에서 다음을 확인하십시오.

A. 앞 문장을 이어받지 않고 새로운 도입으로 시작하는가?
B. 새 인물이나 새 대상이 처음부터 소개되는가?
C. 제목 또는 주제가 독립적으로 새로 시작되는가?
D. 앞부분 없이 읽어도 하나의 완결된 글이 되는가?

A~D 중 여러 항목이 해당되면
새 passage로 분리하는 것이 맞습니다.

반대로 뒤 내용이 앞 문장을 직접 이어받거나
앞 설명 없이는 이해하기 어려운 연속 내용이라면
같은 passage로 유지하십시오.

==================================================
최종 경계 검수
==================================================

JSON을 반환하기 직전에
모든 passage 경계를 다시 확인하십시오.

각 passage 사이에 다음 질문을 하십시오.

"이 둘은 실제 교재에서 하나의 글이 이어진 것인가,
아니면 같은 단원에 들어 있는 서로 다른 독립 글인가?"

- 하나의 글이 페이지 때문에 끊긴 것이라면 합치십시오.
- 서로 독립된 두 글이라면 반드시 나누십시오.
- 같은 인물이나 같은 주제라는 이유만으로 자동 병합하지 마십시오.
- 같은 장소가 등장한다는 이유만으로 자동 병합하지 마십시오.
- 각각 독립적인 도입과 완결성을 가지면 별도 passage로 유지하십시오.

최우선 목표는
'교재에 존재하는 실제 Reading 본문 개수'를
그대로 찾아내는 것입니다.

==================================================
추출 대상
==================================================

다음과 같은 실제 읽기 본문을 찾으십시오.

- Read
- Reading
- 본문
- 장문의 영어 설명문
- 영어 이야기
- 영어 인터뷰형 읽기 본문
- 인물 소개글
- 직업 소개글
- 에세이
- 정보 전달 글

==================================================
제외
==================================================

다음은 passage로 추출하지 마십시오.

- Listen
- Speak
- Listen & Speak
- 대화문 연습
- Grammar
- Vocabulary
- 단어 목록
- 문제
- 선택지
- 정답
- 해설
- 한국어 번역
- 문법 설명
- 활동 지시문
- 단순 예문 모음
- 제목만 있는 부분
- 짧은 질문
- 보기 문장

==================================================
원문 보존
==================================================

content에는 실제 영어 본문만 넣으십시오.

절대로:

- 요약하지 마십시오.
- 문장을 다시 쓰지 마십시오.
- 원문의 문장 순서를 바꾸지 마십시오.
- 일부 문장을 생략하지 마십시오.
- 한국어 번역을 섞지 마십시오.

PDF에서 줄이 끊어진 것은
자연스럽게 한 문장으로 연결해도 됩니다.

그러나 영어 원문의 내용 자체는
그대로 유지하십시오.

==================================================
제목
==================================================

교재에 실제 제목이 있으면
그 제목을 사용하십시오.

제목이 명확하지 않으면
짧게:

"본문 1"
"본문 2"

처럼 표시하십시오.

제목을 이유로
같은 본문을 여러 개로 분할하지 마십시오.

==================================================
JSON
==================================================

반드시 아래 JSON만 반환하십시오.

{
  "passages": [
    {
      "title": "본문 제목",
      "content": "해당 영어 본문 전체"
    }
  ]
}

JSON 밖의 설명은 출력하지 마십시오.

==================================================
PDF 추출 텍스트
==================================================

${text}
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
        "본문 추출 결과가 비어 있습니다."
      );
    }

    const parsed =
      parseJsonOutput(output);

    const rawPassages =
      Array.isArray(
        parsed?.passages
      )
        ? parsed.passages
        : [];

    const passages: Passage[] =
      rawPassages
        .map(
          (
            raw: unknown,
            index: number
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
              title:
                cleanText(
                  item.title
                ) ||
                `본문 ${
                  index + 1
                }`,

              content:
                cleanText(
                  item.content
                ),
            };
          }
        )
        .filter(
          (passage: Passage) =>
            passage.content.length >
            80
        );

    if (
      passages.length === 0
    ) {
      throw new Error(
        "영어 본문을 찾지 못했습니다."
      );
    }

    return Response.json({
      passages,
    });
  } catch (
    error: unknown
  ) {
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