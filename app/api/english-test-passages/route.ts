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
        {
          error: "OPENAI_API_KEY가 설정되어 있지 않습니다.",
        },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey,
    });

    const body = await req.json();

    const sourceText =
      typeof body?.sourceText === "string"
        ? body.sourceText.trim()
        : "";

    if (!sourceText) {
      return Response.json(
        {
          error: "분석할 본문이 없습니다.",
        },
        { status: 400 }
      );
    }

    const prompt = `
당신은 한국 고등학교 영어 교재와 부교재를 분석하는 전문가입니다.

아래 텍스트는 사용자가 업로드한 영어 교재 PDF에서 추출한 텍스트입니다.

시험문제 제작에 사용할 독립된 영어 지문들을 찾아 분리하세요.

반드시 다음 규칙을 지키세요.

1. 하나의 완결된 영어 글을 하나의 passage로 분리합니다.
2. 동일한 지문이 여러 페이지에서 반복되면 가장 완전한 것 하나만 남깁니다.
3. 문제 발문, 객관식 선지, 정답, 해설, 페이지 번호는 제외합니다.
4. 한국어 해석은 제외합니다.
5. 영어 지문은 가능한 한 원문 그대로 보존합니다.
6. 원문을 요약하거나 임의로 새로 작성하지 않습니다.
7. 원래 영어 제목이 있으면 그대로 사용합니다.
8. 제목이 없으면 내용을 대표하는 짧은 영어 제목만 생성합니다.
9. 짧은 문장 조각이나 객관식 선지는 passage로 만들지 않습니다.
10. 서로 다른 글을 절대 합치지 않습니다.
11. PDF에 처음 등장한 순서를 유지합니다.

반환 형식은 반드시 아래 JSON 형식만 사용하세요.

{
  "passages": [
    {
      "title": "English Title",
      "source": "Complete English Passage"
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
        {
          error: "지문 분석 결과가 없습니다.",
        },
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
        {
          error: "지문 분석 결과를 읽지 못했습니다.",
        },
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
        {
          error: "사용 가능한 영어 지문을 찾지 못했습니다.",
        },
        { status: 400 }
      );
    }

    return Response.json({
      passages,
    });
  } catch (error) {
    console.error("English passage analysis error:", error);

    return Response.json(
      {
        error: "영어 지문 분석 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}