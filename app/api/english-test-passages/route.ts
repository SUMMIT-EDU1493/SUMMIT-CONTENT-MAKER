import OpenAI from "openai";

type Passage = {
  title: string;
  source: string;
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const body = await req.json();

    const sourceText =
      typeof body?.sourceText === "string"
        ? body.sourceText.trim()
        : "";

    if (!sourceText) {
      return Response.json(
        { error: "분석할 본문이 없습니다." },
        { status: 400 }
      );
    }

    const prompt = `
당신은 대한민국 고등학교 영어 내신·모의고사 변형문제를 제작하기 위해
교과서와 부교재의 영어 본문을 "시험 출제 단위"로 분리하는 전문가입니다.

아래 텍스트는 PDF에서 추출한 영어 교재 텍스트입니다.

중요:
이번 작업의 목적은 "글 하나 전체를 passage 하나로 저장"하는 것이 아닙니다.
실제 학교 시험과 모의고사 변형문제에 사용할 수 있도록
긴 글을 적절한 길이의 여러 출제 지문으로 분할해야 합니다.

━━━━━━━━━━━━━━━━━━━━
[분할 원칙]
━━━━━━━━━━━━━━━━━━━━

1. 서로 다른 원문 글은 절대 합치지 마세요.

2. 하나의 긴 원문 글은 내용의 의미 흐름을 기준으로 여러 Part로 나누세요.

3. 각 Part는 가급적 120~250 영어 단어 정도가 되게 하세요.

4. 단, 기계적으로 단어 수만 맞추지 말고
   문단 전환, 화제 전환, 원인→결과, 주장→근거 등
   의미가 자연스럽게 끊기는 지점을 우선하세요.

5. 절대로 문장 중간에서 자르지 마세요.

6. 120단어보다 약간 짧더라도 하나의 독립된 의미 단위가 명확하면 허용합니다.

7. 반대로 250단어를 조금 넘더라도
   억지로 자르면 흐름이 깨지는 경우에는 하나의 Part로 유지할 수 있습니다.

8. 너무 짧은 조각은 앞 또는 뒤 Part와 합치세요.

9. 주제·제목, 빈칸, 어휘, 어법, 요약, 문장 삽입, 순서 배열 문제를
   만들 수 있을 정도의 충분한 문맥을 유지하세요.

10. 같은 지문이 PDF 여러 페이지에서 반복되면 중복 제거하고
    가장 완전한 버전 하나만 사용하세요.

11. 문제 발문, 객관식 선지, 정답, 해설, 한국어 해석,
    페이지 번호, 단순 문장 조각은 passage에 포함하지 마세요.

12. 영어 원문은 가능한 한 그대로 보존하세요.
    문장을 요약하거나 새로 작성하지 마세요.

━━━━━━━━━━━━━━━━━━━━
[제목 규칙]
━━━━━━━━━━━━━━━━━━━━

원래 제목이 있는 경우:

Keeping Secrets Secret — Part 1
Keeping Secrets Secret — Part 2

처럼 작성하세요.

원래 제목이 없는 경우에는
내용을 대표하는 짧은 영어 제목을 만든 뒤 Part 번호를 붙이세요.

각 Part의 제목은 서로 구분되어야 합니다.

━━━━━━━━━━━━━━━━━━━━
[중요 예시]
━━━━━━━━━━━━━━━━━━━━

700단어짜리 글 1개가 있다면
그 전체를 passage 1개로 반환하면 안 됩니다.

예:
- Part 1: 배경과 문제 제시
- Part 2: 핵심 원리와 사례
- Part 3: 결과와 의미

처럼 3~4개의 출제 단위로 분리하세요.

━━━━━━━━━━━━━━━━━━━━
[반환 형식]
━━━━━━━━━━━━━━━━━━━━

반드시 아래 JSON만 반환하세요.

{
  "passages": [
    {
      "title": "Original Title — Part 1",
      "source": "시험 출제용으로 분리된 영어 원문 전체"
    },
    {
      "title": "Original Title — Part 2",
      "source": "시험 출제용으로 분리된 영어 원문 전체"
    }
  ]
}

PDF 추출 텍스트:

${sourceText}
`;

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: prompt,
    });

    const raw = response.output_text?.trim();

    if (!raw) {
      return Response.json(
        { error: "지문 분석 결과가 없습니다." },
        { status: 500 }
      );
    }

    let parsed: {
      passages?: Passage[];
    };

    try {
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Passage JSON parse failed:", raw);

      return Response.json(
        { error: "지문 분석 결과를 읽지 못했습니다." },
        { status: 500 }
      );
    }

    const passages = Array.isArray(parsed.passages)
      ? parsed.passages
          .filter(
            (item) =>
              typeof item?.title === "string" &&
              typeof item?.source === "string" &&
              item.source.trim().length > 80
          )
          .map((item) => ({
            title: item.title.trim(),
            source: item.source.trim(),
          }))
      : [];

    if (passages.length === 0) {
      return Response.json(
        { error: "사용 가능한 영어 지문을 찾지 못했습니다." },
        { status: 400 }
      );
    }

    return Response.json({
      passages,
    });
  } catch (error) {
    console.error("English passage analysis error:", error);

    return Response.json(
      { error: "영어 지문 분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}