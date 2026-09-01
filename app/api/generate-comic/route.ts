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
              .map(
                (d: any, dialogueIndex: number) =>
                  `Speaker ${dialogueIndex + 1}: ${d.speaker}
Exact dialogue: ${d.text}`
              )
              .join("\n\n")
          : "";

        return `
PANEL ${index + 1}

SCENE:
${panel.scene}

CHARACTERS:
${panel.characters}

DIALOGUE:
${dialogueText}
`;
      })
      .join("\n\n");

    const prompt = `
Create ONE polished educational four-panel comic image.

TARGET STYLE
- Korean middle-school academy comic
- warm, clean, modern illustration
- friendly and lively
- not childish
- not a worksheet
- visually polished and print-friendly

CHARACTER CONSISTENCY
- Keep the same characters consistent across all four panels.
- Maintain the same face, hairstyle, clothing, age, and overall appearance.
- Do not randomly change character appearance between panels.

LAYOUT
- Landscape orientation
- Exactly 4 panels
- 2 x 2 grid
- Equal-sized comic panels
- Clear panel borders
- Balanced composition
- No title area
- No logo
- No footer
- No vocabulary section
- No extra study box

SPEECH BUBBLE ACCURACY
This is extremely important.

- Every speech bubble must belong to the correct speaker.
- The bubble tail must point toward the actual person speaking.
- The tail should visually connect toward the speaker's mouth or head.
- Never point a bubble tail at the listener.
- Never attach a bubble to the wrong person.
- If two characters speak in the same panel, create two clearly separate speech bubbles.
- Position each speech bubble close to its speaker.
- Avoid crossing bubble tails.
- Avoid ambiguous speaker placement.
- Facial expressions and body language should match what each character is saying.

DIALOGUE
- Use the supplied dialogue as the source.
- Do not rewrite it into textbook translation language.
- Keep it short, casual, lively, and comic-like.
- Large, bold, highly readable lettering.
- Speech should look like real comic dialogue, not small typed worksheet text.

ENGLISH LEARNING FORMAT
- Preserve Korean(English) placement exactly.
- The English word must stay immediately after its Korean meaning.
- Examples:
  성격(personality)
  직업(job)
  계획(plan)
  자신감(confidence)

- Never move the English word to the end of the sentence.
- Never put English alone in separate parentheses after the full sentence.
- Never put Korean and English on separate lines.
- Never change the format into English sentence + Korean translation.

TEXT ACCURACY
- Do not invent additional study phrases.
- Do not add unnecessary English.
- Do not add captions under the panels.
- Do not add fake logos.
- Do not add watermarks.
- Do not create a blank logo box.
- Do not add title text inside the comic.

PANEL INFORMATION:
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

    const logoPath = path.join(
      process.cwd(),
      "public",
      "summit-logo.png"
    );

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
        width: 230,
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    const comicMeta = await sharp(comicBuffer).metadata();

    const comicWidth = comicMeta.width || 1536;
    const comicHeight = comicMeta.height || 1024;

    const headerHeight = 230;
    const sideMargin = 80;
    const bottomMargin = 80;

    const canvasWidth =
      comicWidth + sideMargin * 2;

    const canvasHeight =
      headerHeight +
      comicHeight +
      bottomMargin;

    const summaryText = (
      summary ||
      title ||
      "SUMMIT FOUR-CUT"
    ).trim();

    const summarySvgString = textToSVG.getSVG(
      summaryText,
      {
        x: 0,
        y: 0,
        fontSize: 62,
        anchor: "top",
        attributes: {
          fill: "#111827",
        },
      }
    );

    const summarySvgBuffer = Buffer.from(
      summarySvgString
    );

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
          left: 60,
          top: 30,
        },
        {
          input: summarySvgBuffer,
          left: 340,
          top: 82,
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
      image: `data:image/png;base64,${finalImage.toString(
        "base64"
      )}`,
    });
  } catch (error: any) {
    console.error(
      "IMAGE GENERATION ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "만화 이미지 생성 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          error?.error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}