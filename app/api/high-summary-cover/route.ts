import OpenAI from "openai";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

type RequestBody = {
  schoolName?: string;
  gradeName?: string;
  lessonName?: string;
};

function toDataUri(buffer: Buffer) {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되어 있지 않아." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as RequestBody;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
Create a landscape cover for a Korean high-school English visual summary booklet.

STYLE:
- same design language as a premium hand-drawn Korean study note
- warm ivory notebook-paper background
- soft mint and yellow accents
- scrapbook / stationery feeling
- torn paper, sticky note, paperclip, masking tape, pencil doodles
- small hand-drawn stars, arrows, underline marks
- polished but handmade
- mature high-school level
- print-friendly
- not childish
- not corporate
- not minimalist vector poster
- not a presentation slide

MAIN VISUAL:
A stylish study folder or notebook collage in the center.

The main visual should strongly suggest:
"compact lesson summary / compressed study notes / ZIP file"

IMPORTANT:
Do NOT write school name.
Do NOT write grade.
Do NOT write Lesson.
Do NOT draw or invent any SUMMIT logo.

You may include only this large Korean title:
"요약.ZIP"

The page should still look finished and balanced.

Leave enough visual breathing room near the upper-left
for school/grade/Lesson text that will be added later by software.

Do not create a blank box or dotted placeholder there.
`;

    const imageResponse = await openai.images.generate({
      model: "gpt-image-2",
      size: "1536x1024",
      quality: "medium",
      n: 1,
      prompt,
    });

    const imageData = imageResponse.data?.[0]?.b64_json;

    if (!imageData) {
      throw new Error("앞표지 이미지 데이터가 없습니다.");
    }

    const baseImage = Buffer.from(imageData, "base64");

    const logoPath = path.join(
      process.cwd(),
      "public",
      "summit-logo.png"
    );

    const logoFile = await fs.readFile(logoPath);

    const logoBuffer = await sharp(logoFile)
      .trim()
      .resize({ width: 280 })
      .png()
      .toBuffer();

    const finalImage = await sharp(baseImage)
      .resize({
        width: 1536,
        height: 1024,
        fit: "cover",
      })
      .composite([
        {
          input: logoBuffer,
          left: 628,
          top: 835,
        },
      ])
      .png()
      .toBuffer();

    return Response.json({
      image: toDataUri(finalImage),
      schoolName: body.schoolName || "",
      gradeName: body.gradeName || "",
      lessonName: body.lessonName || "",
    });
  } catch (error: any) {
    console.error("HIGH SUMMARY COVER ERROR:", error);

    return Response.json(
      {
        error: "요약집 앞표지 생성 중 오류가 생겼어.",
        detail: error?.message || "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}