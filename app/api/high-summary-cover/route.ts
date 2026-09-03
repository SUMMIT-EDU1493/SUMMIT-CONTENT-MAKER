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
        {
          error:
            "OPENAI_API_KEY가 설정되어 있지 않아.",
        },
        { status: 500 }
      );
    }

    const body =
      (await request.json()) as RequestBody;

    const openai = new OpenAI({
      apiKey:
        process.env.OPENAI_API_KEY,
    });

    const prompt = `
Create ONE landscape cover for a Korean high-school English visual summary booklet.

This cover must match the same visual language as the inside summary pages.

==================================================
STYLE
==================================================

- landscape 1536x1024
- warm ivory notebook-paper background
- soft mint and yellow accents
- black hand-drawn pen lines
- scrapbook / stationery aesthetic
- torn paper pieces
- masking tape
- sticky notes
- paper clips
- notebook sheets
- pencil doodles
- small stars and arrows
- subtle highlighter marks
- polished but handmade
- modern Korean high-school study-note aesthetic
- print-friendly
- mature high-school level

Do NOT make this look like:
- a corporate presentation slide
- a clean vector poster
- a children's worksheet
- a dark dramatic poster

==================================================
MAIN CONCEPT
==================================================

Create a beautiful central study-folder / notebook collage
that communicates:

"all important lesson ideas compressed into one study pack"

The visual concept should feel like:
- collected notes
- organized study materials
- compressed lesson summary
- ready for quick exam review

The large central title must be:

"요약.ZIP"

The title should look naturally integrated into the stationery collage,
for example on:
- torn grid paper
- memo paper
- a notebook label
- a taped study note

==================================================
DECORATION
==================================================

Use tasteful supporting elements such as:
- mint folder
- notebook pages
- grid paper
- yellow memo
- pencil
- paper clip
- highlighter strokes
- checklist
- small hand-drawn stars
- arrows
- tiny ZIP-file doodle

Do not overcrowd the page.

==================================================
TEXT RULE
==================================================

Do NOT write:
- school name
- grade
- Lesson number
- SUMMIT
- SUMMIT EDU
- academy name
- random English slogans

Only the large Korean title
"요약.ZIP"
may appear as major text.

==================================================
BOTTOM LOGO SAFETY ZONE
==================================================

The official SUMMIT logo will be composited later by software.

Reserve a clean horizontal zone
across the bottom-center of the page,
approximately 160 px high.

Inside the bottom-center logo zone:

- no folder edge
- no notebook edge
- no pencil
- no sticky note
- no tape
- no major doodle
- no title
- no important text
- no important illustration

IMPORTANT:

Do NOT draw a rectangle.
Do NOT draw a dotted placeholder.
Do NOT label this space as a logo area.
Do NOT make the empty zone look intentional.

Simply keep the bottom-center visually calm
and let the background continue naturally.

==================================================
COMPOSITION
==================================================

The main stationery collage should sit mostly
in the center and slightly above center.

Keep the bottom-center area unobstructed.

The page should still feel complete and beautifully balanced
before the official logo is added.

Do NOT draw or invent a SUMMIT logo.
`;

    const imageResponse =
      await openai.images.generate({
        model: "gpt-image-2",
        size: "1536x1024",
        quality: "medium",
        n: 1,
        prompt,
      });

    const imageData =
      imageResponse.data?.[0]
        ?.b64_json;

    if (!imageData) {
      throw new Error(
        "앞표지 이미지 데이터가 없습니다."
      );
    }

    const generatedImage =
      Buffer.from(
        imageData,
        "base64"
      );

    const logoPath =
      path.join(
        process.cwd(),
        "public",
        "summit-logo.png"
      );

    const logoFile =
      await fs.readFile(
        logoPath
      );

    const logoBuffer =
      await sharp(logoFile)
        .trim()
        .resize({
          width: 250,
        })
        .png()
        .toBuffer();

    const finalImage =
      await sharp(
        generatedImage
      )
        .resize({
          width: 1536,
          height: 1024,
          fit: "cover",
        })
        .composite([
          {
            input:
              logoBuffer,
            left: 643,
            top: 875,
          },
        ])
        .png()
        .toBuffer();

    return Response.json({
      image:
        toDataUri(
          finalImage
        ),
      schoolName:
        body.schoolName || "",
      gradeName:
        body.gradeName || "",
      lessonName:
        body.lessonName || "",
    });
  } catch (error: any) {
    console.error(
      "HIGH SUMMARY COVER ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "요약집 앞표지 생성 중 오류가 생겼어.",
        detail:
          error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}