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
가장 중요한 규칙: 한 본문을 절대로 쪼개지 마십시오
==================================================

한 개의 Reading 본문은
반드시 하나의 passage로 반환하십시오.

특히 다음 경우는 절대로
서로 다른 본문으로 나누면 안 됩니다.

- PDF 페이지가 바뀐 경우
- 본문이 다음 페이지에 이어진 경우
- 문단이 바뀐 경우
- 소제목이 중간에 있는 경우
- 같은 인물의 이야기가 계속 이어지는 경우
- 같은 주제와 사건이 계속되는 경우
- 인터뷰 답변이 여러 문단으로 이어지는 경우
- 같은 글 안에서 화제가 조금 전환되는 경우

페이지 구분:

--- 1페이지 ---
--- 2페이지 ---

등은 단순한 PDF 페이지 표시일 뿐입니다.

페이지가 바뀌었다는 이유로
본문을 새 passage로 나누면 안 됩니다.

==================================================
새로운 본문으로 나누는 기준
==================================================

아래가 명확한 경우에만
새로운 passage로 나누십시오.

- 완전히 새로운 Reading 제목이 시작됨
- 이전 글이 확실히 끝나고 독립된 새 글이 시작됨
- 등장인물, 주제, 상황이 완전히 새로 시작됨
- 교재에서 별개의 Read / Reading 본문임이 명백함

조금이라도 같은 본문의 연속일 가능성이 있다면
나누지 말고 하나로 합치십시오.

==================================================
반드시 최종 병합 검수
==================================================

JSON을 반환하기 직전에
서로 이웃한 passages를 다시 확인하십시오.

다음 중 하나라도 해당되면
두 passage를 반드시 하나로 합치십시오.

- 앞 passage의 마지막 문장이
  뒤 passage 내용으로 자연스럽게 이어짐
- 같은 인물이 계속 등장함
- 같은 장소나 사건이 이어짐
- 뒤 passage가 앞 passage 설명의 계속임
- 뒤 passage가 독립적인 도입부 없이 바로 이어짐
- 단순히 PDF 페이지가 달라졌을 뿐임

한 본문을 둘로 나누는 오류보다
연속된 내용을 하나로 유지하는 것을 우선하십시오.

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
          (passage) =>
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