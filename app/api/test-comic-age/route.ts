import OpenAI from "openai";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import TextToSVG from "text-to-svg";

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error: "OPENAI_API_KEY가 설정되지 않았습니다.",
        },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey,
    });

    const summaryText = "같이 준비하니까 더 든든해!";

    const prompt = `
Create one polished educational four-panel comic for Korean middle-school students.

This is a finished comic illustration.

==================================================
LAYOUT
==================================================

- Landscape image.
- EXACTLY 4 comic panels.
- Arrange them as a 2 x 2 grid.
- Clear clean gutters.
- No title or logo inside the AI artwork.

==================================================
STYLE
==================================================

Modern Korean educational webtoon.

- warm
- clean
- polished
- expressive
- age-appropriate for middle-school students
- not childish
- not preschool-like
- not chibi

==================================================
MAIN CHARACTERS
==================================================

There are exactly TWO recurring student characters.

STUDENT A:
- Korean middle-school boy
- approximately 14 to 15 years old
- short slightly wavy black hair
- navy sweatshirt
- friendly expression
- average middle-school build

STUDENT B:
- Korean middle-school girl
- approximately 14 to 15 years old
- shoulder-length dark brown hair
- cream cardigan
- green backpack
- confident friendly expression
- average middle-school build

They are SAME-AGE CLASSMATES AND FRIENDS.

==================================================
VERY IMPORTANT: AGE AND BODY PROPORTIONS
==================================================

The boy and girl must clearly look like classmates
from the same middle-school age group.

VERY IMPORTANT:

- Do NOT make the girl look like a younger child.
- Do NOT make the girl dramatically shorter or smaller
  simply because she is female.
- Do NOT use elementary-school proportions for the girl.
- Do NOT give the girl an oversized childlike head.
- Do NOT make the boy look like an adult man.

Both students should have comparable teenage body scale,
teenage facial proportions and adolescent appearance.

A small natural height difference is acceptable,
but they should visually read as:

"same-age middle-school friends."

They should both look approximately 14 to 15 years old.

==================================================
DISTINCT CHARACTERS
==================================================

The two students must clearly look like different people.

Keep their appearances consistent across all four panels.

Boy:
- short wavy black hair
- navy sweatshirt

Girl:
- shoulder-length dark brown hair
- cream cardigan
- green backpack

Do not redesign them between panels.

Do not duplicate either character in a panel.

==================================================
FOUR PANEL SCENES
==================================================

PANEL 1:
School hallway after class.
The boy and girl stand near a classroom door.
Use a medium-wide shot.
The girl is holding a notebook.

Boy says:
"오늘 같이 준비할래?"

Girl says:
"좋아! 같이 하면 더 잘할 수 있을 것 같아."

PANEL 2:
They are sitting together at a library table.
Use a different camera angle.
The girl points to a page in the notebook.

Girl says:
"이 부분부터 먼저 정리하자."

Boy says:
"응, 중요한 것부터 해보자."

PANEL 3:
Closer view.
The boy looks slightly surprised while checking his notes.
The girl smiles confidently.

Boy says:
"생각보다 많이 정리됐네!"

Girl says:
"그러게, 같이 하니까 훨씬 빠르다."

PANEL 4:
They walk out of the library together,
both looking satisfied and relaxed.
Use a wider final shot.

Girl says:
"이제 좀 자신 있지?"

Boy says:
"응! 같이 준비하니까 더 든든해!"

==================================================
SPEECH BUBBLES
==================================================

- Clear natural comic speech bubbles.
- Correct speaker for every line.
- Large readable Korean text.
- Do not invent extra dialogue.
- Do not duplicate a person because they speak twice.

==================================================
FINAL CHECK
==================================================

Before generating, verify:

1. Exactly 4 panels in a 2x2 grid.
2. Only two recurring student characters.
3. Boy and girl clearly look like same-age middle-school classmates.
4. Girl does NOT look like an elementary-school child.
5. Boy does NOT look like an adult.
6. Their body scale is comparable.
7. Character appearance stays consistent.
8. No duplicate characters.
9. Each panel has different framing or action.
10. No title or logo inside the AI artwork.

Produce only the comic artwork.
`;

    const result = await openai.images.generate({
      model: "gpt-image-2",
      prompt,
      size: "1536x1024",
      quality: "medium",
      n: 1,
    });

    const imageBase64 =
      result.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error(
        "생성된 이미지 데이터를 받지 못했습니다."
      );
    }

    const comicBuffer = Buffer.from(
      imageBase64,
      "base64"
    );

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

    const textToSVG =
      TextToSVG.loadSync(fontPath);

    const resizedLogo = await sharp(
      logoBuffer
    )
      .trim()
      .resize({
        width: 250,
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    const comicMetadata =
      await sharp(
        comicBuffer
      ).metadata();

    const comicWidth =
      comicMetadata.width || 1536;

    const comicHeight =
      comicMetadata.height || 1024;

    const sideMargin = 80;
    const headerHeight = 230;
    const bottomMargin = 70;

    const finalWidth =
      comicWidth + sideMargin * 2;

    const finalHeight =
      headerHeight +
      comicHeight +
      bottomMargin;

    const summarySvg =
      textToSVG.getSVG(
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
      Buffer.from(summarySvg);

    const finalImage =
      await sharp({
        create: {
          width: finalWidth,
          height: finalHeight,
          channels: 4,
          background: {
            r: 255,
            g: 255,
            b: 255,
            alpha: 1,
          },
        },
      })
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
          {
            input: comicBuffer,
            left: sideMargin,
            top: headerHeight,
          },
        ])
        .png()
        .toBuffer();

    return new Response(
      new Uint8Array(finalImage),
      {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "TEST COMIC AGE ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "캐릭터 연령 테스트 이미지 생성 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          error?.error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}