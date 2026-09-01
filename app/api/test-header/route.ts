import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import TextToSVG from "text-to-svg";

export async function GET() {
  try {
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
      .trim()
      .resize({
        width: 250,
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    const summaryText = "성격 유형과 직업";

    const summarySvgString = textToSVG.getSVG(
      summaryText,
      {
        x: 0,
        y: 0,
        fontSize: 64,
        anchor: "top",
        attributes: {
          fill: "#111827",
        },
      }
    );

    const summarySvgBuffer =
      Buffer.from(summarySvgString);

    const canvasWidth = 1700;
    const canvasHeight = 230;

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
          left: 65,
          top: 75,
        },
        {
          input: summarySvgBuffer,
          left: 350,
          top: 72,
        },
      ])
      .png()
      .toBuffer();

    return new Response(finalImage, {
      headers: {
        "Content-Type": "image/png",
      },
    });
  } catch (error: any) {
    return Response.json(
      {
        error:
          error?.message ||
          "헤더 테스트 실패",
      },
      { status: 500 }
    );
  }
}