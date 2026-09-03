import OpenAI from "openai";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import TextToSVG from "text-to-svg";

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
for example on torn grid paper, memo paper,
a notebook label, or a taped study note.

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

Reserve a calm area in the upper-left part of the page.

Approximate area:
x = 70 to 520
y = 55 to 245

Inside this top-left area:
- no major illustration
- no folder or notebook edge crossing it
- no large doodles
- no icons
- no important decorative elements
- no text

Do NOT draw:
- a placeholder
- a dotted rectangle
- an empty label
- a blank box

Simply keep this corner visually calm.

==================================================
BOTTOM LOGO SAFETY ZONE
==================================================

The official SUMMIT logo will be composited later by software.

Reserve a clean horizontal zone
across the bottom-center,
approximately 160 px high.

Inside this bottom-center area:

- no folder edge
- no notebook edge
- no pencil
- no sticky note
- no tape
- no major doodle
- no title
- no important illustration

Do NOT visibly mark this reserved area.

==================================================
COMPOSITION
==================================================

Keep the main collage mostly in the center
and slightly above center.

The cover must still feel complete and balanced
before the software overlays the labels and logo.

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

    // --------------------------------
    // 공식 로고
    // --------------------------------

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

    // --------------------------------
    // 한글 폰트 → 실제 SVG PATH로 변환
    // 중등에서 사용한 안전한 방식
    // --------------------------------

    const fontPath =
      path.join(
        process.cwd(),
        "public",
        "fonts",
        "NotoSansKR-Bold.ttf"
      );

    const textToSVG =
      TextToSVG.loadSync(
        fontPath
      );

    const schoolGradeText =
      [schoolName, gradeName]
        .filter(Boolean)
        .join(" · ");

    const schoolTextSvg =
      textToSVG.getSVG(
        schoolGradeText ||
          "고등부",
        {
          x: 0,
          y: 0,
          fontSize: 31,
          anchor: "top",
          attributes: {
            fill: "#111111",
          },
        }
      );

    const lessonTextSvg =
      textToSVG.getSVG(
        lessonName ||
          "Lesson",
        {
          x: 0,
          y: 0,
          fontSize: 40,
          anchor: "top",
          attributes: {
            fill: "#111111",
          },
        }
      );

    const schoolTextBuffer =
      await sharp(
        Buffer.from(
          schoolTextSvg
        )
      )
        .png()
        .toBuffer();

    const lessonTextBuffer =
      await sharp(
        Buffer.from(
          lessonTextSvg
        )
      )
        .png()
        .toBuffer();

    // --------------------------------
    // 라벨 배경
    // 글자는 여기 넣지 않음
    // --------------------------------

    const labelBackgroundSvg = `
<svg
  width="1536"
  height="1024"
  xmlns="http://www.w3.org/2000/svg"
>
  <!-- 학교/학년 노란 메모 -->
  <rect
    x="82"
    y="68"
    width="365"
    height="68"
    rx="20"
    fill="#FFF2A8"
  />

  <!-- Lesson 민트 메모 -->
  <rect
    x="82"
    y="151"
    width="270"
    height="78"
    rx="21"
    fill="#D8F1E7"
  />

  <!-- 위쪽 테이프 -->
  <rect
    x="105"
    y="54"
    width="60"
    height="18"
    rx="4"
    fill="#E9DCB5"
    transform="rotate(-7 105 54)"
  />

  <rect
    x="365"
    y="56"
    width="58"
    height="18"
    rx="4"
    fill="#E9DCB5"
    transform="rotate(7 365 56)"
  />

  <!-- 아래쪽 테이프 -->
  <rect
    x="103"
    y="140"
    width="55"
    height="17"
    rx="4"
    fill="#E9DCB5"
    transform="rotate(-6 103 140)"
  />

  <rect
    x="292"
    y="142"
    width="55"
    height="17"
    rx="4"
    fill="#E9DCB5"
    transform="rotate(6 292 142)"
  />
</svg>
`;

    const labelBackgroundBuffer =
      Buffer.from(
        labelBackgroundSvg
      );

    // --------------------------------
    // 최종 합성
    // --------------------------------

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
          // 메모지
          {
            input:
              labelBackgroundBuffer,
            left: 0,
            top: 0,
          },

          // 학교 · 학년
          {
            input:
              schoolTextBuffer,
            left: 112,
            top: 87,
          },

          // Lesson
          {
            input:
              lessonTextBuffer,
            left: 112,
            top: 169,
          },

          // 공식 SUMMIT 로고
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