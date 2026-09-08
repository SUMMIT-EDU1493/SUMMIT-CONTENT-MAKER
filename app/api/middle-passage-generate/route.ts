import OpenAI from "openai";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import TextToSVG from "text-to-svg";

export const maxDuration = 300;

type Panel = {
  cut: string;
  sourceText: string;
  scene: string;
  caption: string;
};

type PassagePlan = {
  title?: string;
  summary?: string;
  panels?: Panel[];
};

export async function POST(request: Request) {
  try {
    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "OPENAI_API_KEY가 설정되지 않았습니다.",
        },
        {
          status: 500,
        }
      );
    }

    const openai =
      new OpenAI({
        apiKey,
      });

    const body: PassagePlan =
      await request.json();

    const panels =
      body.panels;

    const summaryText =
      body.summary?.trim() ||
      body.title?.trim() ||
      "써밋네컷";

    if (
      !panels ||
      !Array.isArray(panels) ||
      panels.length !== 4
    ) {
      return Response.json(
        {
          error:
            "써밋네컷 설계안은 정확히 4컷이어야 합니다.",
        },
        {
          status: 400,
        }
      );
    }

    const panelGuide =
      panels
        .map(
          (
            panel,
            index
          ) => `
================================
PANEL ${index + 1}
================================

ORIGINAL SOURCE CONTEXT:
${panel.sourceText}

VISUAL SCENE:
${panel.scene}

CORE MEANING:
${panel.caption}
`
        )
        .join("\n");

    const prompt = `
Create ONE polished educational four-panel comic illustration.

The audience is Korean middle-school English students.

The purpose is to help students understand
the flow of an English textbook passage visually.

This must be a FINISHED comic illustration,
not a storyboard, worksheet, infographic,
poster, or textbook page.

==================================================
ABSOLUTE LAYOUT RULES
==================================================

- Landscape orientation.
- EXACTLY FOUR PANELS.
- Arrange them as a strict 2 x 2 grid.

Panel 1 = upper left.
Panel 2 = upper right.
Panel 3 = lower left.
Panel 4 = lower right.

- Use clear, clean gutters.
- All four panels should have similar overall size.
- Do NOT make a horizontal strip of four panels.
- Do NOT create five or more panels.
- Do NOT create mini-panels inside panels.
- Do NOT create inset frames.
- Do NOT create montage boxes that look like extra panels.

==================================================
VERY IMPORTANT: NO TEXT
==================================================

DO NOT place readable text anywhere in the artwork.

Do NOT include:

- speech bubbles
- narration boxes
- captions
- English sentences
- Korean sentences
- labels
- titles
- headings
- logos
- signs containing readable words
- worksheets
- vocabulary boxes
- explanation boxes
- page numbers

The official title and SUMMIT EDU logo
will be added later programmatically.

If a scene naturally contains a book,
phone, poster, board, monitor, sign,
or paper, any visible writing on it
must be abstract/unreadable marks only.

==================================================
VISUAL STYLE
==================================================

Use a modern Korean educational webtoon style.

The artwork should feel:

- polished
- clean
- warm
- intelligent
- expressive
- visually engaging
- suitable for middle-school students
- not preschool-like
- not babyish
- not stiff
- not overly realistic
- not photographic

Use appealing webtoon-style characters
and clear visual storytelling.

==================================================
PASSAGE FIDELITY
==================================================

The four panels represent the passage
from beginning to end.

Follow the supplied panel scenes carefully.

Do not change the meaning.

Do not invent a major new event.

Do not introduce unrelated characters,
objects, locations, or story developments.

For abstract or informational passages,
use visually clear conceptual scenes
without changing the factual meaning.

==================================================
VISUAL FLOW
==================================================

The student should understand the passage flow
just by looking from:

1 → 2 → 3 → 4.

Each panel must clearly communicate
its assigned part of the passage.

==================================================
VERY IMPORTANT:
PANELS MUST LOOK DIFFERENT
==================================================

Do NOT use the same composition four times.

Do NOT show four almost-identical scenes.

At least THREE panels must clearly differ
in camera framing or composition.

Use visual variation such as:

- wide establishing shot
- medium shot
- close-up
- over-the-shoulder view
- top-down view
- object-focused composition
- action scene
- reaction scene
- environmental view
- conceptual visualization

If the same character appears repeatedly,
keep that character visually consistent,
but vary pose, angle, framing, and action.

==================================================
CHARACTER CONSISTENCY
==================================================

If the same person appears in multiple panels,
keep the same:

- hairstyle
- facial appearance
- clothes
- accessories
- age
- overall identity

Do NOT randomly redesign the same person.

==================================================
DISTINCT CHARACTERS
==================================================

Different people must visibly look different.

Do not create clones or twins unless
the passage actually requires twins.

Different characters should differ in:

- hairstyle
- face
- clothes
- accessories
- silhouette

==================================================
NO CHARACTER DUPLICATION
==================================================

A person should normally appear only once
inside one panel.

Do not duplicate the same character
inside a single panel unless the actual scene
requires multiple versions.

Avoid reflections or background figures
that accidentally look like clones.

==================================================
EXPRESSIONS AND ACTION
==================================================

Use expressive but natural poses.

Characters should do things
rather than simply stand still.

Use:

- gestures
- walking
- sitting
- observing
- holding relevant objects
- reacting
- pointing
- working
- thinking
- interacting with the environment

==================================================
PANEL INSTRUCTIONS
==================================================

${panelGuide}

==================================================
FINAL CHECK BEFORE GENERATING
==================================================

Before generating verify all of these:

1. Exactly 4 panels.
2. Strict 2 x 2 grid.
3. No extra panels.
4. No readable text anywhere.
5. No speech bubbles.
6. No logo.
7. No title.
8. Passage order is preserved.
9. Each panel follows its assigned scene.
10. At least three panels have different framing.
11. Same character remains consistent.
12. Different characters do not look like clones.
13. No duplicated character inside a panel.
14. Artwork looks like a finished educational webtoon.

Produce ONLY the four-panel artwork.
`;

    const result =
      await openai.images.generate({
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

    const comicBuffer =
      Buffer.from(
        imageBase64,
        "base64"
      );

    const logoPath =
      path.join(
        process.cwd(),
        "public",
        "summit-logo.png"
      );

    const fontPath =
      path.join(
        process.cwd(),
        "public",
        "fonts",
        "NotoSansKR-Bold.ttf"
      );

    const [logoBuffer] =
      await Promise.all([
        fs.readFile(
          logoPath
        ),
        fs.access(
          fontPath
        ),
      ]);

    const textToSVG =
      TextToSVG.loadSync(
        fontPath
      );

    const resizedLogo =
      await sharp(
        logoBuffer
      )
        .trim()
        .resize({
          width: 250,
          withoutEnlargement:
            true,
        })
        .png()
        .toBuffer();

    const comicMetadata =
      await sharp(
        comicBuffer
      ).metadata();

    const comicWidth =
      comicMetadata.width ||
      1536;

    const comicHeight =
      comicMetadata.height ||
      1024;

    const sideMargin = 80;
    const headerHeight = 230;
    const bottomMargin = 70;

    const finalWidth =
      comicWidth +
      sideMargin * 2;

    const finalHeight =
      headerHeight +
      comicHeight +
      bottomMargin;

    const safeSummary =
      summaryText.length > 32
        ? `${summaryText.slice(
            0,
            32
          )}…`
        : summaryText;

    const summarySvg =
      textToSVG.getSVG(
        safeSummary,
        {
          x: 0,
          y: 0,
          fontSize: 54,
          anchor: "top",
          attributes: {
            fill: "#111827",
          },
        }
      );

    const summarySvgBuffer =
      Buffer.from(
        summarySvg
      );

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
            input:
              resizedLogo,
            left: 65,
            top: 75,
          },
          {
            input:
              summarySvgBuffer,
            left: 350,
            top: 78,
          },
          {
            input:
              comicBuffer,
            left:
              sideMargin,
            top:
              headerHeight,
          },
        ])
        .png()
        .toBuffer();

    const finalBase64 =
      finalImage.toString(
        "base64"
      );

    return Response.json({
      image:
        `data:image/png;base64,${finalBase64}`,
    });
  } catch (error: any) {
    console.error(
      "MIDDLE PASSAGE GENERATE ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "중등 본문 써밋네컷 이미지 생성 중 오류가 발생했습니다.",

        detail:
          error?.message ||
          error?.error
            ?.message ||
          "알 수 없는 오류",
      },
      {
        status: 500,
      }
    );
  }
}