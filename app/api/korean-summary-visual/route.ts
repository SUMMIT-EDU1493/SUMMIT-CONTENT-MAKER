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

    const visualPrompt =
      typeof body?.visualPrompt === "string"
        ? body.visualPrompt.trim()
        : "";

    if (!visualPrompt) {
      return Response.json(
        { error: "일러스트 생성 프롬프트가 없습니다." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const finalPrompt = `
Create a clean educational infographic illustration for a Korean high school study guide.

STYLE:
- modern Korean educational workbook illustration
- flat editorial illustration
- clean white or very light background
- soft but vivid colors
- visually clear at a glance
- suitable for high school students
- sophisticated, not childish
- concept-focused
- balanced composition
- 16:9 landscape layout

VERY IMPORTANT:
- DO NOT include Korean text
- DO NOT include English text
- DO NOT include letters, numbers, captions, labels, speech bubbles, or readable signage
- communicate the concept only through illustrations, icons, objects, people, arrows, spatial relationships, and visual contrast
- no decorative logo
- no watermark

LEARNING CONCEPT:
${visualPrompt}
`;

    const result = await openai.images.generate({
      model: "gpt-image-2",
      prompt: finalPrompt,
      size: "1536x1024",
      quality: "medium",
    });

    const image = result.data?.[0];

    if (!image) {
      throw new Error("이미지가 생성되지 않았습니다.");
    }

    if (image.b64_json) {
      return Response.json({
        imageUrl: `data:image/png;base64,${image.b64_json}`,
      });
    }

    if (image.url) {
      return Response.json({
        imageUrl: image.url,
      });
    }

    throw new Error("이미지 데이터를 찾을 수 없습니다.");
  } catch (error) {
    console.error("Korean summary visual error:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "일러스트 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}