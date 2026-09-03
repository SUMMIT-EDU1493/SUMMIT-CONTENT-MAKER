import OpenAI from "openai";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import TextToSVG from "text-to-svg";

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

type ComicPlan = {
  title?: string;
  summary?: string;
  panels?: ComicPanel[];
};

export async function POST(request: Request) {
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

    const body: ComicPlan = await request.json();

    const panels = body.panels;
    const summaryText =
      body.summary?.trim() || "써밋네컷";

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
        { status: 400 }
      );
    }

    const panelGuide = panels
      .map((panel, panelIndex) => {
        const dialogueGuide = (
          panel.dialogue || []
        )
          .map(
            (dialogue) => `
SPEAKER: ${dialogue.speaker}
DIALOGUE: ${dialogue.text}
`
          )
          .join("\n");

        return `
==============================
PANEL ${panelIndex + 1}
==============================

SCENE:
${panel.scene}

CHARACTERS:
${panel.characters}

DIALOGUE:
${dialogueGuide}
`;
      })
      .join("\n");

    const prompt = `
Create one polished educational four-panel comic for Korean middle-school students.

This is a finished comic illustration, not a storyboard or worksheet.

==================================================
LAYOUT
==================================================

- Landscape image.
- EXACTLY 4 comic panels.
- Arrange them as a 2 x 2 grid.
- Panel 1: upper left.
- Panel 2: upper right.
- Panel 3: lower left.
- Panel 4: lower right.
- Clear clean gutters between panels.
- Do NOT create one horizontal row of four panels.
- Do NOT create extra panels.

Do NOT place a title, logo, footer, vocabulary box,
study box, explanation box, or separate learning section
inside the generated artwork.

The title and official logo will be added separately later.

==================================================
OVERALL VISUAL STYLE
==================================================

Make it feel like a modern Korean educational webtoon.

The artwork should be:

- warm
- clean
- polished
- expressive
- visually engaging
- appropriate for middle-school students
- not preschool-like
- not overly childish
- not stiff like a textbook illustration

Use expressive but natural facial expressions,
body language, gestures, props and environmental details.

The reader should enjoy looking through all four panels.

==================================================
VERY IMPORTANT: FOUR PANELS MUST NOT LOOK THE SAME
==================================================

Avoid repetitive staging.

Do NOT draw all four panels as:
"two people standing side-by-side in the same place talking."

Do NOT use the exact same camera angle,
same distance, same poses and same composition
for every panel.

Each panel should have a noticeably different visual composition
while still respecting the scene instructions.

Use visual variety such as:

- establishing shot
- medium shot
- close-up
- over-the-shoulder view
- three-quarter view
- seated conversation
- walking conversation
- character holding or pointing to an object
- phone or book being shown
- character reacting
- one character foreground, another background
- expressive facial close-up
- wider environmental view

At least THREE of the four panels must use clearly different
camera framing or character positioning.

If all four panels occur in the same location,
vary the camera angle, crop, pose, actions and focus.

==================================================
VERY IMPORTANT: DISTINCT CHARACTERS
==================================================

Different people must look clearly different.

This is especially important when:
- both characters are boys
- both characters are girls
- characters are similar ages
- characters wear school-style clothing

DO NOT make two separate people look like twins or clones.

For each distinct character, preserve the appearance
described in CHARACTERS.

Different characters should visibly differ in several features,
for example:

- hairstyle
- hair length
- face shape
- glasses
- clothing style
- outerwear
- bag
- accessories
- height impression
- overall visual silhouette

If there are two male students,
they must be immediately distinguishable.

If there are two female students,
they must also be immediately distinguishable.

Do not merely change shirt color while keeping
the exact same face and hair.

==================================================
VERY IMPORTANT: STUDENT AGE AND BODY PROPORTIONS
==================================================

Unless the source clearly says otherwise,
student characters should be treated as middle-school classmates
of approximately the same age.

Male and female classmates should have comparable
teenage age impression, body scale and adolescent proportions.

VERY IMPORTANT:
- Do NOT automatically make a female student much shorter,
  much smaller-bodied or younger-looking simply because she is female.
- Do NOT make a female classmate look like an elementary-school child
  standing next to a male classmate.
- Female students should look like teenagers,
  not little girls.
- Male students should also look like teenagers,
  not adult men.

Natural individual height differences are allowed,
but classmates should still clearly look like peers
from the same general age group.

Use:
- teenage facial proportions
- teenage body proportions
- age-appropriate middle-school styling
- natural adolescent height and build

Avoid:
- chibi proportions
- preschool proportions
- oversized childlike heads
- extremely tiny female bodies
- toddler-like facial features
- exaggerated adult male proportions

If a boy and a girl are friends or classmates,
their visual scale should communicate:
"same-age middle-school peers."

Only show a clearly larger age or body difference
when the source explicitly describes:
- parent and child
- teacher and student
- adult and student
- siblings of different ages
or another genuine age difference.

==================================================
CHARACTER CONSISTENCY
==================================================

Once a character's appearance is established,
keep that exact same person consistent across all panels.

Same character:
- same hairstyle
- same clothing
- same glasses or accessories
- same general facial features

Do NOT randomly redesign a character between panels.

However:

CONSISTENCY DOES NOT MEAN
DIFFERENT PEOPLE SHOULD LOOK IDENTICAL.

Each distinct person must remain distinct.

==================================================
VERY IMPORTANT: DO NOT DUPLICATE CHARACTERS
==================================================

Each character should appear only ONCE per panel
unless the scene genuinely requires otherwise.

If one speaker has multiple dialogue lines,
show ONE person with multiple speech bubbles.

DO NOT create:
- clones
- twins
- reflections that look like extra characters
- duplicate versions of the same speaker
- one visible person per dialogue line

The number of visible people should correspond
to the number of distinct characters in that panel,
NOT the number of dialogue entries.

If one person says two sentences,
draw that person once.

==================================================
SPEECH BUBBLES
==================================================

Use natural comic-style speech bubbles.

Text should be:
- large
- bold enough to read
- visually clear
- not tiny worksheet text

Each speech bubble tail must clearly point
to the correct speaker.

If the same character speaks more than once
in one panel, multiple bubbles may point
to that same single character.

Do not swap speakers.

Do not attribute one person's line
to the other person.

==================================================
DIALOGUE ACCURACY
==================================================

Use the supplied DIALOGUE as the source.

Preserve:
- meaning
- speaker
- dialogue order
- Korean wording as closely as possible
- English learning words inside parentheses

IMPORTANT:
Expressions such as:

직업(job)
성격(personality)
흥미(interest)

must remain in the same
Korean-meaning(English) structure.

Do NOT separate the English word from its Korean meaning.

Do NOT turn it into:
English on one line + Korean on another line.

Do NOT invent long extra dialogue.

==================================================
RELATIONSHIPS AND TONE
==================================================

Respect the relationship implied by the supplied dialogue.

If the conversation is:
- friends / classmates -> casual peer interaction is appropriate
- child and parent -> visually show parent/child relationship naturally
- student and teacher -> clearly distinguish adult teacher and student
- student and adult -> make age/role difference visually understandable

Do not visually turn a parent into another teenage classmate.

Do not make a teacher look identical in age and styling
to the student.

==================================================
EXPRESSIONS AND ACTION
==================================================

Characters should react to what is being said.

Use natural visual storytelling:

- smiling
- surprised expression
- thinking
- pointing
- showing an object
- holding a phone
- looking at a page
- turning toward the other person
- walking
- sitting
- changing posture

Avoid four panels of motionless characters
with arms hanging straight down.

Decorative comic symbols such as:
- ?
- !
- small sparkles
- thought marks

are allowed when appropriate.

They must appear near the correct character
and match that character's emotion.

==================================================
SCENE FIDELITY
==================================================

Follow the scene instructions below.

Do not create a completely unrelated setting.

However, interpret the scenes cinematically
so that the four panels feel visually varied
and enjoyable.

Do not invent a major new event
that changes the meaning of the dialogue.

==================================================
PANEL INSTRUCTIONS
==================================================

${panelGuide}

==================================================
FINAL CHECK BEFORE GENERATING
==================================================

Before generating, verify:

1. Exactly four panels in a 2x2 grid.
2. No title or logo inside the AI artwork.
3. No extra learning boxes.
4. Dialogue order is correct.
5. Speech bubbles point to correct speakers.
6. One character is not duplicated because they speak twice.
7. Different people do NOT look like clones.
8. Same character remains consistent across panels.
9. At least three panels have visibly different composition/framing.
10. Characters perform actions rather than standing identically.
11. Backgrounds and camera angles are not monotonously repeated.
12. Korean(English) learning expressions remain intact.
13. Parent/teacher/adult roles are visually distinguishable from students.
14. Male and female classmates look like same-age middle-school peers.
15. Female students do NOT look like small elementary-school children.

Produce only the comic artwork.
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
      comicWidth +
      sideMargin * 2;

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
            input:
              summarySvgBuffer,
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
      "GENERATE COMIC ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "써밋네컷 이미지 생성 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          error?.error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}