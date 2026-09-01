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

    const { title, summary, panels } = body;

    if (!panels || !Array.isArray(panels) || panels.length !== 4) {
      return Response.json(
        { error: "4컷 설계안이 없습니다." },
        { status: 400 }
      );
    }

    const panelGuide = panels
      .map(
        (panel: any, index: number) => `
PANEL ${index + 1}
Scene: ${panel.scene}
Characters: ${panel.characters}
Korean dialogue that must be preserved:
${panel.korean}
`
      )
      .join("\n");

    const prompt = `
Create ONE polished four-panel educational comic image.

STYLE:
- Korean middle-school academy comic
- warm, clean, modern illustration
- real comic feeling, NOT worksheet
- friendly but not childish
- consistent character faces, hair, clothing, and proportions across all four panels

LAYOUT:
- landscape image
- exactly four panels
- 2 x 2 grid
- equal-sized panels
- clean borders
- comic only
- DO NOT create a title area
- DO NOT create a logo area
- DO NOT add a fake logo
- DO NOT add a footer
- DO NOT add a vocabulary section

TEXT:
- Use the supplied Korean dialogue.
- Dialogue must appear inside natural speech bubbles.
- Large, thick, bold, highly readable comic lettering.
- Avoid small typed-looking text.
- Keep the text visually prominent.

IMPORTANT:
- Preserve Korean(English) placement exactly.
- If the supplied dialogue says 직업(job), keep 직업(job).
- Do not move "(job)" to the end of the sentence.
- Do not separate Korean and English onto different lines.
- Do not turn it into English sentence + Korean translation.
- Do not invent extra study text.

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

    const logoPath = path.join(
      process.cwd(),
      "public",
      "summit-logo.png"
    );

    const logoBuffer = await fs.readFile(logoPath);

    const resizedLogo = await sharp(logoBuffer)
      .resize({
        width: 170,
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    const comicMeta = await sharp(comicBuffer).metadata();

    const comicWidth = comicMeta.width || 1536;
    const comicHeight = comicMeta.height || 1024;

    const headerHeight = 180;
    const sideMargin = 70;
    const bottomMargin = 70;

    const resizedComicWidth = comicWidth;
    const resizedComicHeight = comicHeight;

    const canvasWidth =
      resizedComicWidth + sideMargin * 2;

    const canvasHeight =
      headerHeight +
      resizedComicHeight +
      bottomMargin;

    const summaryText = summary || title || "SUMMIT FOUR-CUT";

    const safeSummary = summaryText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const svgHeader = Buffer.from(`
      <svg
        width="${canvasWidth}"
        height="${headerHeight}"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          width="100%"
          height="100%"
          fill="white"
        />

        <text
          x="300"
          y="108"
          font-size="58"
          font-weight="800"
          font-family="Arial, sans-serif"
          fill="#111827"
        >
          ${safeSummary}
        </text>
      </svg>
    `);

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
          input: svgHeader,
          left: 0,
          top: 0,
        },
        {
          input: resizedLogo,
          left: 70,
          top: 45,
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