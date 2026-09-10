import OpenAI from "openai";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import TextToSVG from "text-to-svg";

export const runtime = "nodejs";

type ComicDialogue = {
  speaker: string;
  text: string;
};

type ComicPanel = {
  cut: string;
  scene: string;
  characters: string;
  dialogue: ComicDialogue[];
};

type HighComicPlan = {
  id?: string;
  englishTitle?: string;
  koreanSubtitle?: string;
  blockSummary?: string;
  sourceRange?: string;
  visualStyle?: string;
  storyMode?: string;
  keyWords?: string[];
  panels?: ComicPanel[];
};

type RequestBody = {
  plan?: HighComicPlan;
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        {
          error: "OPENAI_API_KEY가 설정되어 있지 않습니다.",
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as RequestBody;
    const plan = body?.plan;

    if (!plan) {
      return Response.json(
        {
          error: "고등 써밋네컷 설계안이 없습니다.",
        },
        { status: 400 }
      );
    }

    const panels = Array.isArray(plan.panels)
      ? plan.panels
      : [];

    if (panels.length !== 4) {
      return Response.json(
        {
          error:
            "고등 써밋네컷 설계안은 정확히 4컷이어야 합니다.",
        },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const panelText = panels
      .map((panel, index) => {
        const dialogueText = Array.isArray(
          panel.dialogue
        )
          ? panel.dialogue
              .map(
                (line) =>
                  `${line.speaker}: ${line.text}`
              )
              .join("\n")
          : "";

        return `
==============================
PANEL ${index + 1}
==============================

CUT:
${panel.cut || `${index + 1}컷`}

SCENE:
${panel.scene || ""}

CHARACTERS:
${panel.characters || ""}

DIALOGUE:
${dialogueText}
`;
      })
      .join("\n");

    const keyWords = Array.isArray(
      plan.keyWords
    )
      ? plan.keyWords.join(", ")
      : "";

    const prompt = `
Create ONE polished landscape 4-panel illustrated comic page for Korean high-school students.

This is part of a series called "SUMMIT FOUR-CUT".

IMPORTANT:
This is NOT a children's educational comic.

The page must strongly follow the ASSIGNED VISUAL STYLE below.

Do not default to a generic Korean webtoon aesthetic.
Different requests in this series must visibly look like different artists or different publication styles.

It should still feel polished, contemporary, engaging, and suitable for high-school students.

Educational content should be naturally embedded inside it.

==================================================
PAGE STRUCTURE
==================================================

- exactly 4 panels
- 2x2 grid
- landscape composition
- thick, solid, clearly visible dark panel borders with bright gutters
- no page title inside artwork
- no footer
- no logo
- no vocabulary box
- no study-note box
- no extra captions outside the intended comic content


==================================================
THIS PAGE'S ASSIGNED VISUAL DIRECTION
==================================================

VISUAL STYLE:
${plan.visualStyle || "modern webtoon"}

STORY MODE:
${plan.storyMode || "visual storytelling"}

The assigned VISUAL STYLE above is mandatory.

Do not automatically fall back to the same generic Korean webtoon look
for every request.

Interpret the requested style strongly through:
- line quality
- shading
- texture
- framing
- lighting
- visual rhythm
- background treatment
- panel composition

The four panels must still form one coherent page,
but the overall artistic language should clearly reflect
the assigned VISUAL STYLE.

The assigned STORY MODE must also affect composition.

If STORY MODE is:
- visual metaphor: show the concept visually rather than through people explaining it
- comparison: make the contrast immediately visible
- process sequence: emphasize progression from panel to panel
- cause and effect: visually separate cause and consequence
- narrator driven: allow narration-led visual scenes with fewer speaking characters
- symbolic scene: use objects, spaces, scale, or imagery as symbols
- real world example: dramatize a concrete situation
- documentary style: use observational, real-world framing
- inner monologue: focus on one person's thought process
- character dialogue: conversation is allowed, but still vary staging strongly

IMPORTANT:
Do not force two or three characters into every panel.

At least ONE panel should work visually even without a conversation.
Whenever the source allows it, make TWO panels primarily visual,
narrative, symbolic, environmental, or action-based.

Avoid the repetitive formula:
"student A explains -> student B reacts -> student A explains again."



==================================================
MANDATORY FOUR-PANEL BORDERS
==================================================

The page MUST visibly read as exactly four separate comic panels.

Use:
- exact 2 x 2 grid
- thick, solid, dark panel borders
- clearly visible vertical center divider
- clearly visible horizontal center divider
- bright clean gutters between all panels
- outer frame clearly visible

The divider lines must remain clearly visible
even over very dark or highly detailed artwork.

Do NOT:
- blend adjacent scenes together
- use borderless cinematic montage
- let scenery cross from one panel into another
- hide the center divider behind characters or speech bubbles

At first glance, the viewer must immediately see FOUR separate rectangles.

==================================================
HIGH-SCHOOL VISUAL STYLE
==================================================

Target audience:
Korean high-school students, approximately ages 16–18.

Art direction:
- follow the assigned VISUAL STYLE strongly
- mature high-school visual tone
- cinematic composition
- expressive faces
- dynamic posing
- stylish lighting
- strong visual storytelling
- attractive but natural character design
- rendering technique must match the assigned visual style
- slightly dramatic
- slightly trendy
- visually memorable

The comic should attract attention even before the viewer realizes it is educational material.

AVOID:
- elementary-school illustration style
- childish educational workbook look
- chibi proportions
- preschool-like characters
- static classroom explanation scenes
- four panels with identical framing
- overly cute children's-book style


==================================================
MANDATORY STYLE INTERPRETATION
==================================================

The value of VISUAL STYLE is not a small suggestion.
It must cause an OBVIOUS visual difference.

Interpret styles as follows:

graphic novel:
- dramatic inked linework
- deep shadows and high contrast
- cinematic lighting
- realistic or semi-realistic anatomy
- bold graphic compositions
- NOT soft pastel webtoon rendering

editorial illustration:
- sophisticated magazine illustration
- conceptual imagery
- simplified but stylish figures
- bold shapes and clever visual metaphors
- contemporary editorial-art feeling

cinematic storyboard:
- movie-like cinematography
- realistic lighting
- dramatic wide shots and close-ups
- depth, atmosphere, lens-like framing
- restrained comic exaggeration

modern webtoon:
- polished Korean digital webtoon
- clean expressive characters
- brighter digital rendering
- contemporary youth aesthetic

ink drawing comic:
- visible pen-and-ink texture
- crosshatching
- black-and-white or very limited-color feeling
- expressive hand-drawn lines
- print-comic character

painterly illustration:
- visible painted texture
- atmospheric light
- soft brushwork
- rich illustrated-book or concept-art finish
- NOT clean flat webtoon cel shading

collage magazine comic:
- layered paper, cutout, photography-inspired shapes
- typography-like graphic elements only where appropriate
- bold editorial composition
- mixed-media feeling

retro comic book:
- vintage printed comic feeling
- halftone dots
- bold black outlines
- punchy framing
- classic comic-book energy

minimal conceptual illustration:
- sophisticated minimal shapes
- symbolic composition
- strong negative space
- fewer but meaningful elements
- still retain readable comic storytelling

infographic comic:
- visual comparison and information hierarchy
- diagrams integrated into scenes
- arrows, scale, spatial relationships where useful
- characters may interact with the visual information
- must still look like an illustrated comic, not a worksheet

Do NOT render every one of these as the same anime/webtoon face style.

==================================================
CHARACTER AGE & BODY PROPORTIONS
==================================================

Any high-school student characters should look approximately 16–18 years old.

They must have:
- mature teenage facial proportions
- natural adolescent body proportions
- believable high-school appearance
- natural height variation

Male and female classmates of the same age should look like peers.

Do NOT:
- make female students look dramatically younger or smaller just because they are female
- make male students look like full-grown adult men
- make teenagers look like elementary-school children

If an actual adult is required by the scene,
make the age difference visually clear.

==================================================
WEBTOON ENERGY
==================================================

Use visual variety aggressively.

Across the 4 panels, include several of these:
- close-up
- medium shot
- wide shot
- over-the-shoulder angle
- low angle
- high angle
- dramatic perspective
- action movement
- strong facial reaction
- cinematic lighting
- visual metaphor
- humorous reaction
- exaggerated comic timing

At least 3 of the 4 panels must use clearly different framing.

Do not simply show people standing and talking.

==================================================
COMEDIC ELEMENTS
==================================================

Comedy is allowed and encouraged when appropriate.

Possible techniques:
- reaction faces
- tiny background reaction character
- visual exaggeration
- comedic pause
- playful contrast
- dry humor
- short reaction text
- trendy visual joke

But comedy must never distort the actual meaning of the source content.

The tone can feel MZ-style,
but avoid forced or excessive slang.

==================================================
DIALOGUE STYLE
==================================================

Use the supplied Korean dialogue as faithfully as possible.

Do NOT rewrite the meaning.

Minor natural adjustments are allowed only when needed for:
- speech-bubble readability
- natural spoken Korean
- comic timing

Dialogue should feel:
- conversational
- witty
- current
- natural
- energetic
- high-school appropriate

Avoid:
- textbook translation tone
- teacher lecture tone
- stiff explanatory language
- childish baby talk


==================================================
MANDATORY LANGUAGE AND VOCABULARY
==================================================

All full dialogue sentences must be Korean.

Do NOT create full English dialogue sentences.

English is allowed only inside Korean learning expressions in this form:

한글뜻(English)

Examples:
다양성(diversity)
회복력(resilience)
안정성(stability)

The finished page should visibly contain approximately 5–8 useful English vocabulary expressions
distributed naturally through the four panels whenever they are supplied in the plan.

Do not omit most of the supplied keyWords.

Preserve the Korean(English) format exactly.

If the supplied plan accidentally contains an English-only dialogue sentence,
do NOT reproduce it as English.
Render the meaning naturally in Korean instead,
while retaining useful English vocabulary only in parentheses.

==================================================
SPEECH BUBBLES
==================================================

This is VERY important.

Use:
- clear Korean speech bubbles
- bold Korean lettering
- noticeably thick font weight
- highly readable text
- comfortable internal padding
- clean modern webtoon lettering

Avoid:
- thin fonts
- tiny text
- overly long dense text blocks
- decorative fonts that hurt readability

The speech bubble font should look stronger and bolder than ordinary educational worksheet text.

==================================================
KOREAN + ENGLISH KEY WORDS
==================================================

Important vocabulary may appear naturally in this format:

한글뜻(English)

Examples:
원동력(driving force)
적응하다(adapt)
회복력(resilience)

Do not create a separate word list.

Do not dump vocabulary at the bottom of a panel.

Vocabulary should naturally appear within dialogue or scene context.

Suggested key vocabulary for this page:
${keyWords || "Use only the vocabulary already present in the supplied dialogue."}


==================================================
CHARACTER / SCENE BALANCE
==================================================

Do not remove people from most of the comic.

Normally:
- at least 2 of the 4 panels should contain meaningful human characters
- no more than 1 panel should be a pure environment/object/symbol-only panel

A panel without people is useful only when it communicates
a strong visual metaphor, event, comparison, or consequence.

Do not turn the comic into four disconnected poster illustrations.

The four panels should feel like one flowing visual story.

==================================================
CHARACTER CONSISTENCY
==================================================

If the same character appears in multiple panels:
- keep hairstyle consistent
- keep age consistent
- keep clothing consistent unless the story clearly changes time/place
- keep facial identity consistent

Do not randomly change a character's gender, age, hairstyle, or clothing.

==================================================
NO CLONING
==================================================

Within each panel:

- each intended person should appear only once
- do not duplicate the same character
- do not create cloned background versions of the same person
- do not add random students unless the scene explicitly requires them

One character may have multiple speech bubbles.
That does NOT mean the character should be drawn multiple times.

==================================================
TEXT ACCURACY
==================================================

Korean text accuracy is extremely important.

Preserve supplied dialogue closely.

Do not invent unrelated Korean text.

Do not replace meaningful Korean dialogue with gibberish.

Do not add random English labels.

If a speech bubble has a speaker,
make its tail clearly point to the correct speaker.

==================================================
CURRENT PAGE
==================================================

English title:
${plan.englishTitle || ""}

Korean subtitle:
${plan.koreanSubtitle || ""}

Page summary:
${plan.blockSummary || ""}

Source position:
${plan.sourceRange || ""}

==================================================
EXACT 4-PANEL PLAN
==================================================

${panelText}

==================================================
FINAL CHECK BEFORE GENERATING
==================================================

Verify all of the following:

1. exactly 4 panels with thick, unmistakable dark borders and bright gutters
2. 2x2 grid
3. high-school visual tone
4. mature teenage proportions
5. no childish/chibi look
6. visually engaging assigned visual style is clearly visible
7. at least 3 clearly different camera framings
8. supplied story order preserved
9. dialogue meaning preserved
10. every full dialogue sentence is Korean; English appears only as Korean(English) vocabulary
11. speech-bubble font bold and thick
12. no separate vocabulary box
13. approximately 5–8 supplied English learning words appear naturally in Korean(English) format
14. no duplicate/cloned characters inside a panel
15. no unnecessary random people
16. recurring characters remain visually consistent
17. speech-bubble tails point to correct speakers
18. comic can contain humor and MZ tone without becoming childish
19. page does not look like a school textbook illustration
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
      imageResponse.data?.[0]?.b64_json;

    if (!imageData) {
      throw new Error(
        "고등 써밋네컷 이미지 데이터가 없습니다."
      );
    }

    const comicBuffer = Buffer.from(
      imageData,
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

    // 중등과 동일한 최종 합성 규격
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

    // 고등은 한글 부제를 상단 한 줄 요약으로 사용
    const summaryText =
      plan.koreanSubtitle?.trim() ||
      plan.blockSummary?.trim() ||
      "핵심 내용을 한눈에 정리해보자!";

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

    const finalBase64 =
      finalImage.toString("base64");

    return Response.json({
      image: `data:image/png;base64,${finalBase64}`,
    });
  } catch (error: any) {
    console.error(
      "GENERATE HIGH COMIC ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "고등 써밋네컷 이미지 생성 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          error?.error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}