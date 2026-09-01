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

    const openai = new OpenAI({
      apiKey,
    });

    const body = await request.json();

    const {
      title,
      summary,
      panels,
      keyWords,
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
      .slice(0, 8)
      .map((item: any) => `${item.korean}(${item.english})`)
      .join(", ");

    const prompt = `
Create ONE finished educational four-panel comic page for Korean middle-school English learners.

IMPORTANT:
This must feel like a polished "Summit four-cut comic", NOT a worksheet.

LAYOUT:
- Landscape orientation.
- Four panels in a 2 x 2 grid.
- Equal-sized panels.
- Clear comic panel borders.
- Clean, warm, friendly educational comic style.
- Consistent character appearance across all four panels.

TEXT STYLE:
- Use large, bold, highly readable comic speech-bubble lettering.
- Text should feel like real comic dialogue.
- Avoid small typed worksheet-style text.
- Strong readability is very important.

VERY IMPORTANT TEXT RULES:
- Do NOT reproduce the full original English dialogue.
- Do NOT print English one line and Korean one line.
- Do NOT create a vocabulary box.
- Do NOT create a key expressions box.
- Adapt the source meaning into short, natural comic dialogue.
- Each panel should contain only 1 or 2 short speech-bubble lines.
- Use mostly Korean dialogue for readability.
- If helpful, include only a few important vocabulary items inline in Korean(English) format.
- Keep the dialogue concise, lively, and educational.
- Focus only on the main idea of each scene.

VISUAL GOAL:
- Feels like a neat academy four-cut learning comic.
- Main focus is the four comic scenes.
- Speech bubbles should be clear and visually prominent.
- Avoid clutter.
- No bottom study section.
- No long explanation blocks.

LOGO RULE:
- Leave a clean blank area near the bottom-right corner.
- Do NOT invent or draw any logo.
- Do NOT write SUMMIT EDU inside the generated artwork.
- The official logo will be overlaid later by the app.

TITLE:
${title || "SUMMIT FOUR-CUT"}

SUMMARY:
${summary || ""}

SOURCE MATERIAL:
${panelGuide}

VOCAB HINTS:
${vocabHints}
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

    let logoBuffer: Buffer;

    try {
      logoBuffer = await fs.readFile(logoPath);
    } catch {
      return Response.json(
        {
          error:
            "public/summit-logo.png 파일을 찾지 못했습니다.",
        },
        { status: 500 }
      );
    }

    const resizedLogo = await sharp(logoBuffer)
      .resize({
        width: 220,
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    const finalImage = await sharp(comicBuffer)
      .composite([
        {
          input: resizedLogo,
          gravity: "southeast",
          left: 35,
          top: 35,
        },
      ])
      .png()
      .toBuffer();

    return Response.json({
      image: `data:image/png;base64,${finalImage.toString(
        "base64"
      )}`,
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