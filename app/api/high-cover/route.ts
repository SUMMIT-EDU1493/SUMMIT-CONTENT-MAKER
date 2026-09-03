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
        { error: "OPENAI_API_KEY가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as RequestBody;

    const schoolName = body?.schoolName?.trim() || "고등부";
    const gradeName = body?.gradeName?.trim() || "고등";
    const lessonName = body?.lessonName?.trim() || "Lesson";

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
Create a polished horizontal cover page for a Korean educational comic PDF.

IMPORTANT:
- clean white background
- print-friendly
- elegant and neat
- unified with a premium study handout style
- NOT dark
- NOT black background
- do NOT place the logo too low
- leave safe space for the logo near the lower center area

LAYOUT:
- A4 landscape style
- top-left aligned text block
- show:
  1) school and grade line
  2) lesson line
  3) content type line: "고등 · 써밋네컷"
- keep those information lines left-aligned and readable

MAIN TITLE:
- centered large black film-strip motif
- 4 frames
- each frame contains one big Korean character:
  "써" "밋" "네" "컷"
- the inside of each frame should be white
- the overall feeling should match a clean series cover
- do NOT write "SUMMIT FOUR-CUT" anywhere

STYLE:
- modern
- crisp
- high readability
- refined
- slightly lively but not childish
- should look consistent with a study-material series

TEXT TO SHOW:
- ${schoolName} · ${gradeName}
- ${lessonName}
- 고등 · 써밋네컷

DO NOT:
- use black full-page background
- place logo text inside the art
- create tiny unreadable text
- add random extra English text
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
      throw new Error("표지 이미지 데이터가 없습니다.");
    }

    const baseImage = Buffer.from(imageData, "base64");

    const logoPath = path.join(process.cwd(), "public", "summit-logo.png");
    const logoFile = await fs.readFile(logoPath);

    const logoBuffer = await sharp(logoFile)
      .resize({ width: 300 })
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
          left: 618,
          top: 800,
        },
      ])
      .png()
      .toBuffer();

    return Response.json({
      image: toDataUri(finalImage),
    });
  } catch (error: any) {
    console.error("HIGH COVER ERROR:", error);

    return Response.json(
      {
        error: "고등 표지 생성 중 오류가 발생했습니다.",
        detail: error?.message || "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}