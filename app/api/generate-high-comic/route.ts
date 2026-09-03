import OpenAI from "openai";
import sharp from "sharp";

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
          error: "고등 써밋네컷 설계안은 정확히 4컷이어야 합니다.",
        },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const panelText = panels
      .map((panel, index) => {
        const dialogueText = Array.isArray(panel.dialogue)
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

    const keyWords = Array.isArray(plan.keyWords)
      ? plan.keyWords.join(", ")
      : "";

    const prompt = `
Create ONE polished landscape 4-panel Korean webtoon page for high-school students.

This is part of a series called "SUMMIT FOUR-CUT".

IMPORTANT:
This is NOT a children's educational comic.

The page should feel like:
- a stylish modern Korean webtoon
- an Instagram comic
- an entertaining visual story

FIRST.

Educational content should be naturally embedded inside it.

==================================================
PAGE STRUCTURE
==================================================

- exactly 4 panels
- 2x2 grid
- landscape composition
- clean panel borders
- no page title inside artwork
- no footer
- no logo
- no vocabulary box
- no study-note box
- no extra captions outside the intended comic content

==================================================
HIGH-SCHOOL VISUAL STYLE
==================================================

Target audience:
Korean high-school students, approximately ages 16–18.

Art direction:
- polished modern Korean webtoon
- mature teenage visual style
- cinematic composition
- expressive faces
- dynamic posing
- stylish lighting
- strong visual storytelling
- attractive but natural character design
- crisp digital illustration
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
CHARACTER CONSISTENCY
==================================================

If the same character appears in multiple panels:
- keep hairstyle consistent
- keep age consistent
- keep clothing consistent unless the story clearly changes time/place
- keep facial identity consistent

If real historical or public figures are described in the plan,
depict them as recognizable fictionalized educational representations based on the description,
without adding unrelated people.

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

1. exactly 4 panels
2. 2x2 grid
3. high-school visual tone
4. mature teenage proportions
5. no childish/chibi look
6. visually engaging modern Korean webtoon style
7. at least 3 clearly different camera framings
8. supplied story order preserved
9. dialogue meaning preserved
10. Korean text readable
11. speech-bubble font bold and thick
12. no separate vocabulary box
13. key vocabulary appears naturally if supplied
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

    const imageBuffer = Buffer.from(
      imageData,
      "base64"
    );

    const finalBuffer = await sharp(imageBuffer)
      .resize({
        width: 1536,
        height: 1024,
        fit: "cover",
      })
      .png()
      .toBuffer();

    const base64 =
      finalBuffer.toString("base64");

    return Response.json({
      image: `data:image/png;base64,${base64}`,
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
          error?.message || "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}