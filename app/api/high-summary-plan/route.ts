import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 300;

type RequestBody = {
  schoolName?: string;
  gradeName?: string;
  lessonName?: string;
  sourceText?: string;
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

    const sourceText =
      body.sourceText?.trim() ||
      "";

    if (!sourceText) {
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
        apiKey:
          process.env.OPENAI_API_KEY,
      });

    const prompt = `
너는 고등학교 영어 본문을
'시험 직전 한눈에 복습하는 시각형 요약집'으로 설계하는 전문 편집자다.

==================================================
가장 중요한 기준
==================================================

입력 자료에는 서로 독립된 영어 지문이 여러 개 들어 있을 수 있다.

반드시:

독립 영어 지문 1개
=
요약 페이지 1개
=
pages 배열의 항목 1개

로 만들어라.

예:

영어 지문 1개 → pages 1개
영어 지문 6개 → pages 6개
영어 지문 10개 → pages 10개
영어 지문 15개 → pages 15개

지문 개수를 임의로 줄이거나 합치지 마라.

전체 페이지 수를 4~6장으로 제한하지 마라.

==================================================
독립 영어 지문 판단 기준
==================================================

입력 텍스트에는 다음이 섞여 있을 수 있다.

- 연도
- 월 모의고사
- 문제 번호
- 영어 원문
- 한국어 해석
- 문장 번호
- 페이지 번호
- 제목
- 저작권 문구
- 안내 문구

다음과 같은 패턴은 새로운 독립 영어 지문의 시작일 가능성이 높다.

예:

21번 I suspect fungi are...
23번 Empathy is frequently...
24번 We tend to break up time...

문제 번호 뒤에서 새로운 영어 문장이 시작되면
새 지문의 시작점으로 우선 판단한다.

또한 "지문 읽기" 이후에 등장하는 영어 원문을 중요하게 본다.

==================================================
한국어 해석 처리
==================================================

영어 지문 뒤에는 같은 내용을 번역한 한국어 해석이 붙어 있을 수 있다.

한국어 해석은 별도의 지문으로 세지 않는다.

영어 원문 1개 + 해당 한국어 해석
=
지문 1개

한국어 해석은 영어 원문의 의미를 확인하는 보조 자료로만 사용한다.

==================================================
페이지가 넘어가는 경우
==================================================

한 지문의 영어 원문 또는 한국어 해석이 다음 PDF 페이지까지 이어질 수 있다.

페이지가 바뀌었다는 이유만으로 새로운 지문으로 판단하지 마라.

반대로 다음 요소가 새롭게 등장하면
새 독립 지문인지 확인한다.

- 새로운 연도/월 정보
- 새로운 문제 번호
- 새로운 영어 제목
- "지문 읽기"

==================================================
요약집 목적
==================================================

각 독립 영어 지문 하나를
시험 직전 한눈에 복습할 수 있는
시각형 요약 페이지 한 장으로 정리한다.

목표:

- 원문의 논리 구조 파악
- 시험 직전 빠른 복습
- 핵심 개념과 사례 연결
- 중요 영어 표현 암기

줄거리 요약만 하지 말고
"이 지문이 어떤 구조로 전개되는지"
보이게 정리한다.

==================================================
학교
==================================================

${body.schoolName || ""}

==================================================
학년
==================================================

${body.gradeName || ""}

==================================================
자료명
==================================================

${body.lessonName || ""}

==================================================
각 페이지 구성
==================================================

각 독립 지문마다 반드시 다음 항목을 만든다.

- englishTitle
  짧은 영어 핵심 제목

- koreanTitle
  학생이 바로 이해할 수 있는 한국어 제목

- oneLineSummary
  해당 지문의 핵심을 한 문장으로 요약

- keyPoints
  반드시 기억해야 할 핵심 내용 3~5개

- keyWords
  중요 어휘/표현 5~8개

  형식:
  한국어 뜻(English)

- sourceRange
  가능한 경우 출처 표시

  예:
  2024년 03월 모의고사 21번
  2024년 06월 모의고사 24번

- visualType
  아래 중 가장 적합한 하나 선택

  FLOW
  COMPARE
  CAUSE_EFFECT
  TIMELINE
  CONCEPT
  PERSON_STORY
  PROCESS

- visualIdea
  이 페이지를 어떻게 한눈에 이해되도록 보여줄지
  한국어로 짧고 구체적으로 설명

==================================================
요약 규칙
==================================================

1. 원문의 순서를 절대 바꾸지 않는다.

2. 서로 다른 독립 지문을 하나의 페이지에 합치지 않는다.

3. 하나의 독립 지문을 여러 페이지로 쪼개지 않는다.

4. keyPoints는 긴 문장으로 쓰지 않는다.

5. 시험 직전 빠르게 볼 수 있도록 짧고 압축한다.

6. 단순 번역을 하지 않는다.

7. 핵심 논리와 전개 구조가 보이도록 정리한다.

8. 원문에 없는 사실은 추가하지 않는다.

9. 사람이나 실제 사례 중심이면 PERSON_STORY를 적극 활용한다.

10. 과정이면 PROCESS 또는 FLOW를 활용한다.

11. A/B 차이면 COMPARE를 활용한다.

12. 원인→결과면 CAUSE_EFFECT를 활용한다.

13. 모든 페이지를 똑같은 visualType으로 만들지 않는다.

14. 각 지문의 내용에 가장 적합한 구조를 선택한다.

==================================================
누락 방지 최종 검수
==================================================

JSON 출력 전 반드시 다음을 다시 확인한다.

1. 입력 전체에서 독립 영어 지문의 시작점을 처음부터 끝까지 센다.

2. pages 배열의 개수를 센다.

3. 독립 영어 지문 수와 pages 수가 같은지 확인한다.

4. 빠진 지문이 있으면 반드시 추가한다.

5. 서로 다른 지문 두 개가 한 페이지로 합쳐지지 않았는지 확인한다.

6. 같은 지문이 중복되어 있지 않은지 확인한다.

특히 독립 영어 지문이 10개라면
pages도 반드시 10개여야 한다.

==================================================
출력 형식
==================================================

JSON만 출력한다.

설명문 금지.
머리말 금지.
코드블록 금지.

{
  "overallTitle": "전체 자료 핵심 제목",
  "overallSummary": "전체 자료에 대한 짧은 설명",
  "pageCount": 10,
  "pages": [
    {
      "id": "summary-1",
      "englishTitle": "",
      "koreanTitle": "",
      "oneLineSummary": "",
      "keyPoints": [
        "",
        "",
        ""
      ],
      "keyWords": [
        "한국어 뜻(English)"
      ],
      "sourceRange": "",
      "visualType": "FLOW",
      "visualIdea": ""
    }
  ]
}

==================================================
본문
==================================================

${sourceText}
`;

    const response =
      await openai.responses.create({
        model:
          "gpt-5-mini",
        max_output_tokens:
          16000,
        input:
          prompt,
      });

    let output =
      response.output_text?.trim() ||
      "";

    output =
      output
        .replace(
          /^```json\s*/i,
          ""
        )
        .replace(
          /^```\s*/i,
          ""
        )
        .replace(
          /\s*```$/i,
          ""
        )
        .trim();

    let result;

    try {
      result =
        JSON.parse(
          output
        );
    } catch {
      console.error(
        "HIGH SUMMARY JSON PARSE ERROR:",
        output
      );

      return Response.json(
        {
          error:
            "요약집 계획 JSON 변환에 실패했습니다.",
          raw:
            output,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !Array.isArray(
        result?.pages
      ) ||
      result.pages.length ===
        0
    ) {
      return Response.json(
        {
          error:
            "요약집 페이지 계획이 생성되지 않았습니다.",
        },
        {
          status: 500,
        }
      );
    }

    return Response.json({
      ...result,
      pageCount:
        result.pages.length,
    });
  } catch (
    error: any
  ) {
    console.error(
      "HIGH SUMMARY PLAN ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "고등 요약집 계획 생성 중 오류가 발생했습니다.",
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