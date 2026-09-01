import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey,
    });

    const body = await request.json();

    const {
      title,
      summary,
      panels,
      keyExpressions,
      keyWords,
    } = body;

    if (!panels || !Array.isArray(panels) || panels.length !== 4) {
      return Response.json(
        { error: "4컷 설계안이 없습니다." },
        { status: 400 }
      );
    }

    const panelText = panels
      .map(
        (panel: any, index: number) => `
컷 ${index + 1}
장면: ${panel.scene}
등장인물: ${panel.characters}
영어 대사: ${panel.english}
한글 뜻: ${panel.korean}
`
      )
      .join("\n");

    const expressionText = (keyExpressions || [])
      .map(
        (item: any) =>
          `${item.english} (${item.korean})`
      )
      .join("\n");

    const wordText = (keyWords || [])
      .map(
        (item: any) =>
          `${item.english} (${item.korean})`
      )
      .join("\n");

    const prompt = `
Create ONE polished educational four-panel comic sheet for Korean middle-school English learners.

FORMAT:
- Landscape orientation.
- One single finished page.
- Four comic panels arranged horizontally from left to right.
- Clear panel borders.
- Warm, clean, friendly educational comic illustration style.
- Same characters must look consistent in every panel.
- Natural facial expressions and gestures.
- Not childish preschool art.
- Suitable for a Korean English academy handout.

TITLE:
${title || "SUMMIT FOUR-CUT"}

SUMMARY:
${summary || ""}

FOUR PANELS:
${panelText}

TEXT RULES:
- Preserve the supplied English dialogue accurately.
- Put the English dialogue naturally inside speech bubbles.
- Under or near the dialogue, include the Korean meaning in smaller readable text.
- Do not invent extra dialogue.
- Do not omit important dialogue.
- English spelling must be accurate.
- Korean text must be accurate and readable.
- Avoid decorative fake text.

BOTTOM LEARNING SECTION:
Include a neat learning box across the bottom.

핵심표현:
${expressionText}

주요단어:
${wordText}

BRANDING:
- Add the text "SUMMIT EDU" neatly at the bottom.
- Leave a clean small logo area near the bottom corner.
- Do not invent a fake logo symbol.

DESIGN:
- Landscape study sheet.
- Four panels are the main focus.
- Learning expressions and vocabulary are smaller than the comic but clearly readable.
- Plenty of white space.
- Clean print-friendly composition.
`;

    const result = await openai.images.generate({
      model: "gpt-image-2",
      prompt,
      size: "1536x1024",
      quality: "medium",
      n: 1,
    });

    const imageBase64 = result.data?.[0]?.b64_json;

    if (!imageBase64) {
      return Response.json(
        { error: "이미지 결과를 받지 못했습니다." },
        { status: 500 }
      );
    }

    return Response.json({
      image: `data:image/png;base64,${imageBase64}`,
    });
  } catch (error: any) {
    console.error("IMAGE GENERATION ERROR:", error);

    return Response.json(
      {
        error: "만화 이미지 생성 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          error?.error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}