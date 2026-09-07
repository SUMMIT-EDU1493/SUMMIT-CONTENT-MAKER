import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const body = await req.json();

    const sourceText =
      typeof body?.sourceText === "string"
        ? body.sourceText.trim()
        : "";

    if (!sourceText) {
      return Response.json(
        { error: "분석할 PDF 텍스트가 없습니다." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const prompt = `
당신은 대한민국 고등학교 국어 시험지 분석 전문가입니다.

아래 텍스트는 고등학교 국어 시험 PDF에서 추출한 텍스트입니다.

학생이 읽는 '본문 지문'만 찾아 각각 분리하세요.

[중요 규칙]

- 문제 번호와 선택지는 제거합니다.
- "24. 윗글을..." 같은 문제는 제외합니다.
- <보기> 문제 자료도 원칙적으로 제외합니다.
- 본문의 각주·용어 설명은 본문 이해에 필요하면 유지합니다.
- 서로 다른 독립 지문은 각각 분리합니다.
- [24~27], [33~35]처럼 문제 묶음 앞에 제시된 본문을 하나의 지문으로 봅니다.
- 문학 작품과 비문학 설명문을 구분합니다.
- 이번 요약.ZIP은 우선 비문학 지문을 대상으로 하므로
  설명문, 논설문, 과학·사회·인문 지문을 우선 추출합니다.
- 원문 내용을 요약하거나 고쳐 쓰지 마세요.
- OCR 또는 PDF 추출 과정에서 생긴 단순 줄바꿈만 자연스럽게 연결합니다.
- 본문 문장을 임의로 추가하지 마세요.

각 지문의 title은 내용을 알아볼 수 있는 짧은 제목으로 작성합니다.

예:
"최저소득보장제와 기본소득제"
"동물의 눈동자 모양과 생존 방식"

JSON만 반환하세요.

{
  "passages": [
    {
      "title": "지문 제목",
      "source": "원문 전체"
    }
  ]
}

[PDF 추출 텍스트]

${sourceText}
`;

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: prompt,
    });

    const raw = response.output_text?.trim();

    if (!raw) {
      throw new Error("지문 분석 결과가 없습니다.");
    }

    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    const passages = Array.isArray(parsed?.passages)
      ? parsed.passages
          .filter(
            (item: any) =>
              typeof item?.source === "string" &&
              item.source.trim()
          )
          .map((item: any, index: number) => ({
            id: `kor-passage-${Date.now()}-${index}`,
            title:
              typeof item.title === "string"
                ? item.title.trim()
                : `국어 지문 ${index + 1}`,
            source: item.source.trim(),
          }))
      : [];

    return Response.json({
      passages,
    });
  } catch (error) {
    console.error("Korean passage extraction error:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "국어 지문 분리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}