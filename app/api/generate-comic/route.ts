import OpenAI from "openai";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import TextToSVG from "text-to-svg";

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
    const { title, summary, panels } = body;

    if (!panels || !Array.isArray(panels) || panels.length !== 4) {
      return Response.json(
        { error: "4컷 설계안이 없습니다." },
        { status: 400 }
      );
    }

    const panelGuide = panels
      .map((panel: any, index: number) => {
        const dialogueText = Array.isArray(panel.dialogue)
          ? panel.dialogue
              .map((d: any) => `${d.speaker}: ${d.text}`)
              .join("\n")
          : "";

        return `
PANEL ${index + 1}
Scene: ${panel.scene}
Characters: ${panel.characters}

Dialogue:
${dialogueText}
`;
      })
      .join("\n");

    const prompt = `
Create ONE polished educational four-panel comic image.

STYLE:
- Korean middle-school academy comic
- warm, clean, modern illustration
- friendly but not childish
- visually polished
- consistent character faces, hair, clothing, age, and proportions across all four panels

LAYOUT:
- landscape image
- exactly four panels
- 2 x 2 grid
- equal-sized panels
- clear borders
- comic only
- no title
- no logo
- no footer
- no vocabulary box

SPEECH BUBBLES:
- Every speech bubble must clearly belong to the correct speaker.
- The speech bubble tail must point directly toward the mouth or head of the actual speaker.
- Never point a speech bubble tail toward the wrong character.
- If two characters speak in one panel, use separate speech bubbles.
- Position each bubble near its speaker.
- Avoid ambiguous bubble placement.

TEXT:
- Use the supplied Korean dialogue exactly as the dialogue source.
- Large, bold, highly readable comic lettering.
- Natural comic speech bubble style.
- No small worksheet-like typed text.

ENGLISH FORMAT:
- Preserve Korean(English) placement exactly.
- Example: 직업(job), 성격(personality)
- Never move the English to the end of the sentence.
- Never separate Korean and English onto different lines.
- Never rewrite it as English sentence + Korean translation.

DO NOT:
- do not invent extra educational notes
- do not invent extra dialogue
- do not create a logo or logo area
- do not create a blank white logo box
- do not add watermark

PANELS:
${panelGuide}
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

    const logoPath = path.join(process.cwd(), "public", "summit-logo.png");
    const fontPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "NotoSansKR-Bold.ttf"
    );

    const logoBuffer = await fs.readFile(logoPath);
    await fs.access(fontPath);

    const textToSVG = TextToSVG.loadSync(fontPath);

    const resizedLogo = await sharp(logoBuffer)
      .resize({
        width: 180,
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    const comicMeta = await sharp(comicBuffer).metadata();
    const comicWidth = comicMeta.width || 1536;
    const comicHeight = comicMeta.height || 1024;

    const headerHeight = 220;
    const sideMargin = 80;
    const bottomMargin = 80;

    const canvasWidth = comicWidth + sideMargin * 2;
    const canvasHeight = headerHeight + comicHeight + bottomMargin;

    const summaryText = (summary || title || "SUMMIT FOUR-CUT").trim();

    const summarySvgString = textToSVG.getSVG(summaryText, {
      x: 0,
      y: 0,
      fontSize: 60,
      anchor: "top",
      attributes: {
        fill: "#111827",
      },
    });

    const summarySvgBuffer = Buffer.from(summarySvgString);

    const whiteCanvas = await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: "#ffffff",
      },
    })
      .png()
      .toBuffer();

    const finalImage = await sharp(whiteCanvas)
      .composite([
        {
          input: resizedLogo,
          left: 80,
          top: 40,
        },
        {
          input: summarySvgBuffer,
          left: 320,
          top: 78,
        },
        {
          input: comicBuffer,
          left: sideMargin,
          top: headerHeight,
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