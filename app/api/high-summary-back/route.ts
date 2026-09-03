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
Create ONE landscape final page for a Korean high-school English visual summary booklet.

This final page must match the SAME visual language
as the inside summary pages.

==================================================
STYLE
==================================================

- landscape 1536x1024
- warm ivory notebook-paper background
- soft mint and yellow accents
- black hand-drawn pen lines
- scrapbook / stationery aesthetic
- torn paper
- sticky notes
- masking tape
- notebook sheets
- paper clips
- pencil doodles
- highlighter marks
- small stars and celebratory doodles
- polished but handmade
- modern Korean high-school study-note style
- mature high-school level
- print-friendly

Do NOT make this look like:
- a corporate presentation slide
- a clean vector poster
- a children's worksheet
- a dark poster

==================================================
MAIN CONCEPT
==================================================

Create a satisfying "study complete" ending scene.

It should feel like:
- the student has finished organizing the whole lesson
- the key flow is understood
- exam review is complete
- study materials are neatly wrapped up

Use study-themed visual elements such as:
- checked notes
- hand-drawn A+ mark
- highlighter
- pencil
- sticky note
- notebook
- checklist
- small paper scraps
- tiny celebration doodles
- stars
- check marks

Do NOT use people.

==================================================
MAIN MESSAGE
==================================================

Include only ONE short Korean encouragement phrase:

"핵심 흐름까지 완벽하게 잡았다!"

The phrase may appear naturally on:
- a sticky note
- torn memo paper
- notebook card

Keep it readable and prominent,
but not oversized.

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

Do NOT add long paragraphs.

==================================================
BOTTOM LOGO SAFETY ZONE
==================================================

The official SUMMIT logo will be composited later by software.

Reserve a clean horizontal zone
across the bottom-center of the page,
approximately 160 px high.

Inside the bottom-center logo zone:

- no notebook edge
- no folder edge
- no sticky note
- no stationery
- no pencil
- no tape
- no confetti
- no A+ mark
- no major doodle
- no important text
- no important illustration

IMPORTANT:

Do NOT draw a rectangle.
Do NOT draw a dotted placeholder.
Do NOT label this as a logo area.

Simply allow the notebook-paper background
to continue naturally through this space.

==================================================
COMPOSITION
==================================================

Place the main study-complete illustration
mostly in the center and slightly above center.

Keep the bottom-center area visually calm.

The page must still feel complete and balanced
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
        "마지막장 이미지 데이터가 없습니다."
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
      "HIGH SUMMARY BACK ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "요약집 마지막장 생성 중 오류가 생겼어.",
        detail:
          error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}