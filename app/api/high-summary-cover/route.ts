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

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

    const schoolName =
      body.schoolName?.trim() || "";
    const gradeName =
      body.gradeName?.trim() || "";
    const lessonName =
      body.lessonName?.trim() || "";

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
TOP-LEFT INFO SAFETY ZONE
==================================================

Software will later overlay:
- school name
- grade
- lesson name

Reserve a calm area in the upper-left part of the page
for those labels.

Approximate area:
from x=90 to x=520,
from y=70 to y=250.

Inside this top-left info area:
- no major illustration
- no notebook edge crossing the text area
- no strong doodles
- no large icons
- no important decorative elements
- no large text

Do NOT draw a placeholder box.
Do NOT draw a dotted box.
Do NOT label the area.
Simply keep it visually calm.

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

Keep the top-left info area and bottom-center logo area unobstructed.

The page should still feel complete and beautifully balanced
before the official text and logo are added.

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

    const fontPath =
      path.join(
        process.cwd(),
        "public",
        "fonts",
        "NotoSansKR-Bold.ttf"
      );

    const fontFile =
      await fs.readFile(
        fontPath
      );

    const fontBase64 =
      fontFile.toString("base64");

    const logoBuffer =
      await sharp(logoFile)
        .trim()
        .resize({
          width: 250,
        })
        .png()
        .toBuffer();

    const schoolGradeText =
      [schoolName, gradeName]
        .filter(Boolean)
        .join(" · ");

    const lessonText =
      lessonName || "Lesson";

    const safeSchoolGrade =
      escapeXml(schoolGradeText);
    const safeLesson =
      escapeXml(lessonText);

    const headerSvg = `
<svg width="1536" height="1024" viewBox="0 0 1536 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: 'NotoSansKRCustom';
        src: url("data:font/ttf;base64,${fontBase64}") format("truetype");
        font-weight: 700;
        font-style: normal;
      }
      .labelText {
        font-family: 'NotoSansKRCustom', sans-serif;
        fill: #111111;
      }
    </style>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.10)"/>
    </filter>
  </defs>

  <!-- 상단 왼쪽 라벨 배경 -->
  <g filter="url(#shadow)">
    <rect x="88" y="74" rx="20" ry="20" width="300" height="64" fill="#FFF4A8"/>
    <rect x="88" y="152" rx="22" ry="22" width="250" height="74" fill="#D9F3E8"/>
  </g>

  <!-- 마스킹테이프 느낌 -->
  <g opacity="0.9">
    <rect x="108" y="58" width="56" height="18" rx="4" ry="4" fill="#EBDDB0" transform="rotate(-8 108 58)"/>
    <rect x="300" y="62" width="58" height="18" rx="4" ry="4" fill="#EBDDB0" transform="rotate(7 300 62)"/>
    <rect x="104" y="140" width="52" height="18" rx="4" ry="4" fill="#EBDDB0" transform="rotate(-6 104 140)"/>
    <rect x="282" y="143" width="56" height="18" rx="4" ry="4" fill="#EBDDB0" transform="rotate(6 282 143)"/>
  </g>

  <!-- 텍스트 -->
  <text x="114" y="117" class="labelText" font-size="31" font-weight="700">
    ${safeSchoolGrade}
  </text>

  <text x="114" y="201" class="labelText" font-size="40" font-weight="700">
    ${safeLesson}
  </text>
</svg>
`;

    const headerBuffer =
      Buffer.from(headerSvg);

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
              headerBuffer,
            top: 0,
            left: 0,
          },
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
      schoolName,
      gradeName,
      lessonName,
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