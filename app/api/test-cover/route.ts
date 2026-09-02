import sharp from "sharp";
import type { OverlayOptions } from "sharp";
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

    const [logoBuffer] = await Promise.all([
      fs.readFile(logoPath),
      fs.access(fontPath),
    ]);

    const textToSVG = TextToSVG.loadSync(fontPath);

    const width = 1600;
    const height = 1131;

    const bg = "#f8f7f3";
    const black = "#111111";
    const gray = "#505050";

    const schoolGrade = "발안중 · 3";
    const lessonLine = "Lesson 5 · 대화문";

    // 학교/학년: 조금 작게
    const schoolSvg = textToSVG.getSVG(schoolGrade, {
      x: 0,
      y: 0,
      fontSize: 36,
      anchor: "top",
      attributes: {
        fill: black,
      },
    });

    // Lesson/대화문: 조금 작게
    const lessonSvg = textToSVG.getSVG(lessonLine, {
      x: 0,
      y: 0,
      fontSize: 42,
      anchor: "top",
      attributes: {
        fill: gray,
      },
    });

    const schoolBuffer = Buffer.from(schoolSvg);
    const lessonBuffer = Buffer.from(lessonSvg);

    const filmX = 150;
    const filmY = 330;
    const filmWidth = 1300;
    const filmHeight = 390;

    const innerMarginX = 48;
    const frameGap = 20;
    const frameTop = filmY + 72;
    const frameHeight = filmHeight - 144;

    const totalInnerWidth = filmWidth - innerMarginX * 2;
    const frameWidth =
      (totalInnerWidth - frameGap * 3) / 4;

    const letters = ["써", "밋", "네", "컷"];

    const filmSvgParts: string[] = [];

    filmSvgParts.push(`
      <rect
        x="${filmX}"
        y="${filmY}"
        width="${filmWidth}"
        height="${filmHeight}"
        rx="26"
        ry="26"
        fill="${black}"
      />
    `);

    const holeWidth = 52;
    const holeHeight = 24;
    const holeGap = 30;

    for (
      let x = filmX + 35;
      x < filmX + filmWidth - holeWidth - 20;
      x += holeWidth + holeGap
    ) {
      filmSvgParts.push(`
        <rect
          x="${x}"
          y="${filmY + 22}"
          width="${holeWidth}"
          height="${holeHeight}"
          rx="8"
          ry="8"
          fill="${bg}"
        />
      `);

      filmSvgParts.push(`
        <rect
          x="${x}"
          y="${filmY + filmHeight - holeHeight - 22}"
          width="${holeWidth}"
          height="${holeHeight}"
          rx="8"
          ry="8"
          fill="${bg}"
        />
      `);
    }

    for (let index = 0; index < 4; index++) {
      const x =
        filmX +
        innerMarginX +
        index * (frameWidth + frameGap);

      filmSvgParts.push(`
        <rect
          x="${x}"
          y="${frameTop}"
          width="${frameWidth}"
          height="${frameHeight}"
          fill="#ffffff"
        />
      `);
    }

    const filmSvg = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${width}"
        height="${height}"
      >
        ${filmSvgParts.join("\n")}
      </svg>
    `;

    const filmBuffer = Buffer.from(filmSvg);

    // 써밋네컷: 더 크게 + 더 굵게
    const letterBuffers = letters.map((letter) =>
      Buffer.from(
        textToSVG.getSVG(letter, {
          x: 0,
          y: 0,
          fontSize: 138,
          anchor: "top",
          attributes: {
            fill: black,
            stroke: black,
            "stroke-width": "2",
          },
        })
      )
    );

    const resizedLogo = await sharp(logoBuffer)
      .trim()
      .resize({
        width: 430,
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    const composites: OverlayOptions[] = [
      {
        input: schoolBuffer,
        left: 150,
        top: 125,
      },
      {
        input: lessonBuffer,
        left: 150,
        top: 180,
      },
      {
        input: filmBuffer,
        left: 0,
        top: 0,
      },
    ];

    for (let index = 0; index < 4; index++) {
      const x =
        filmX +
        innerMarginX +
        index * (frameWidth + frameGap);

      const metadata = await sharp(
        letterBuffers[index]
      ).metadata();

      const letterWidth = metadata.width || 140;
      const letterHeight = metadata.height || 140;

      const left = Math.round(
        x + frameWidth / 2 - letterWidth / 2
      );

      const top = Math.round(
        frameTop + frameHeight / 2 - letterHeight / 2
      );

      composites.push({
        input: letterBuffers[index],
        left,
        top,
      });
    }

    composites.push({
      input: resizedLogo,
      left: 585,
      top: 850,
    });

    const image = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: {
          r: 248,
          g: 247,
          b: 243,
          alpha: 1,
        },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();

    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("TEST COVER ERROR:", error);

    return Response.json(
      {
        error: "표지 미리보기 생성 중 오류가 발생했습니다.",
        detail: error?.message || "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}