import OpenAI from "openai";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const body = await request.json();

    const {
      title,
      summary,
      panels,
      keyWords,
      keyExpressions,
    } = body;

    if (!panels || !Array.isArray(panels) || panels.length !== 4) {
      return Response.json(
        { error: "4컷 설계안이 없습니다." },
        { status: 400 }
      );
    }

    const panelGuide = panels
      .map(
        (panel: any, index: number) => `
패널 ${index + 1}
장면 설명: ${panel.scene}
등장인물: ${panel.characters}
원본 영어 내용: ${panel.english}
원본 한글 의미: ${panel.korean}
`
      )
      .join("\n");

    const vocabHints = (keyWords || [])
      .slice(0, 10)
      .map((item: any) => `${item.korean}(${item.english})`)
      .join(", ");

    const expressionHints = (keyExpressions || [])
      .slice(0, 8)
      .map((item: any) => `${item.korean}(${item.english})`)
      .join(", ");

    const prompt = `
Create ONE polished educational four-panel comic.

This is a Korean English-academy learning comic called "SUMMIT FOUR-CUT".
It must look like a real comic, NOT a worksheet.

LAYOUT
- Landscape page
- Exactly four panels
- 2 x 2 grid
- Equal-sized panels
- Clear panel borders
- Consistent characters in all panels
- Warm, modern educational comic illustration style

DIALOGUE STYLE
- Use short, natural Korean comic dialogue.
- Do NOT reproduce the original dialogue line by line.
- Summarize and adapt the important meaning into lively comic speech.
- Each panel should have about 1 to 2 speech bubbles.
- Text must be large, bold, and highly readable.
- Use a comic speech-bubble lettering feel, not small typed worksheet text.

VERY IMPORTANT ENGLISH LEARNING RULE
- Each of the four panels should include at least ONE useful English word or expression.
- Across the whole comic, include about 4 to 6 important English learning items.
- Blend them naturally into the Korean dialogue.
- Preferred format:
  한글(English)

Examples:
계획(plan)
약속(appointment)
도와줄래?(Can you help me?)
좋은 생각이야.(That's a good idea.)

- Do NOT make a separate vocabulary box.
- Do NOT make a separate key-expression box.
- The English must appear naturally inside the comic dialogue.
- Prioritize the most important words or phrases from the source material.

DO NOT
- Do not write the full English dialogue.
- Do not put English sentence + Korean translation underneath.
- Do not add study notes below the comic.
- Do not add a fake logo.
- Do not create a blank white logo box.
- Do not add a watermark.
- Do not write SUMMIT EDU inside the AI-generated artwork.

TITLE
${title || "SUMMIT FOUR-CUT"}

SUMMARY
${summary || ""}

SOURCE MATERIAL
${panelGuide}

IMPORTANT WORD HINTS
${vocabHints}

IMPORTANT EXPRESSION HINTS
${expressionHints}
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

    const comicBuffer = Buffer.from(imageBase64, "base64");

    const logoPath = path.join(
      process.cwd(),
      "public",
      "summit-logo.png"
    );

    const logoBuffer = await fs.readFile(logoPath);

    const resizedLogo = await sharp(logoBuffer)
      .resize({
        width: 180,
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    const finalImage = await sharp(comicBuffer)
      .composite([
        {
          input: resizedLogo,
          gravity: "southeast",
        },
      ])
      .png()
      .toBuffer();

    return Response.json({
      image: `data:image/png;base64,${finalImage.toString("base64")}`,
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