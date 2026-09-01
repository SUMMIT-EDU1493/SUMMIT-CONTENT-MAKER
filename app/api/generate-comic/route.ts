import OpenAI from "openai";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import TextToSVG from "text-to-svg";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const body = await request.json();
    const { title, summary, panels } = body;

    if (!panels || !Array.isArray(panels) || panels.length !== 4) {
      return Response.json(
        { error: "4컷 설계안이 없습니다." },
        { status: 400 }
      );
    }

    const panelGuide = panels
      .map((panel: any, index: number) => {
        const dialogueText = Array.isArray(panel.dialogue)
          ? panel.dialogue
              .map(
                (d: any) =>
                  `SPEAKER: ${d.speaker}
DIALOGUE: ${d.text}`
              )
              .join("\n\n")
          : "";

        return `
PANEL ${index + 1}

SCENE:
${panel.scene}

CHARACTERS:
${panel.characters}

${dialogueText}
`;
      })
      .join("\n\n");

    const prompt = `
Create ONE polished educational four-panel comic.

STYLE
- Korean middle-school educational comic
- clean and modern
- warm and lively
- friendly but not childish
- high-quality academy learning material
- visually polished like a professionally illustrated educational comic

LAYOUT
- landscape orientation
- exactly four panels
- 2 x 2 grid
- equal-sized panels
- clean panel borders
- balanced spacing
- no title inside the generated comic
- no logo
- no footer
- no vocabulary box
- no separate study section

CHARACTER CONSISTENCY
- Keep every recurring character visually identical across all four panels.
- Same face
- Same hairstyle
- Same clothing
- Same age
- Same general proportions

VERY IMPORTANT: DO NOT DUPLICATE CHARACTERS
- In each panel, draw each character only ONCE.
- Never duplicate the same person just because that person has more than one line of dialogue.
- If one speaker has two or more dialogue lines in the same panel, show ONE character with multiple speech bubbles.
- Multiple speech bubbles from the same speaker must point to the SAME single character.
- Do not create a second copy, clone, twin, reflection, or duplicate version of the same speaker.
- The number of visible people in the panel must match the actual number of distinct characters in the scene, NOT the number of dialogue lines.
- Example: if two friends are talking and one friend speaks twice, the panel must still contain only TWO people.

SPEECH BUBBLE ACCURACY
- Every speech bubble must clearly belong to the correct speaker.
- Put each bubble close to the person speaking.
- The bubble tail must point toward the actual speaker's mouth or head.
- Never point the tail toward the listener.
- Never attach a bubble to the wrong person.
- If two different people speak in one panel, use separate speech bubbles for each person.
- If the same person speaks twice, use two bubbles pointing to that same single person.
- Avoid ambiguous bubble placement.
- Avoid crossed bubble tails.

FACIAL EXPRESSIONS
- Facial expressions must match the dialogue and situation.
- A character asking a question should look curious or questioning.
- A character answering should look like they are responding, thinking, agreeing, explaining, or reacting as appropriate.
- Do not give the answering character a confused expression unless the scene actually requires it.

DECORATIVE SYMBOL RULE
- Floating question marks, exclamation marks, sparkles, motion marks, and comic reaction symbols are allowed.
- Every decorative symbol must belong to the correct character and emotion.
- A question mark should appear only near the character who is confused, curious, or asking a question.
- Do not place a question mark beside the answering character unless that character is also genuinely confused.
- Exclamation marks should appear near the character who is surprised, excited, or strongly reacting.
- Sparkles may be used to emphasize excitement, confidence, dreams, success, or a positive moment.
- Decorative symbols should support the scene and must not confuse who is speaking or reacting.

DIALOGUE
- Use the supplied dialogue as the source.
- Keep the meaning and natural conversational tone.
- Dialogue should feel like real Korean teen conversation.
- Avoid stiff, literal, translated, or textbook-like Korean.
- Keep dialogue short and lively.
- Use large, thick, bold, highly readable comic lettering.
- Speech should look like real comic dialogue, not worksheet text.
- Do not turn dialogue into explanatory captions.

ENGLISH FORMAT
- Preserve the supplied 한글(English) format.
- English must remain immediately after the matching Korean word.

Correct examples:
직업(job)
성격(personality)
흥미(interest)
계획(plan)

Incorrect example:
이 직업이 좋아. (job)

- Never move English to the end of the full sentence.
- Never separate Korean and English onto different lines.
- Never turn it into English sentence + Korean translation.

DO NOT
- invent unnecessary extra dialogue
- invent extra study notes
- invent a logo
- create a fake logo
- create a logo placeholder
- create title text inside the comic
- create vocabulary lists
- create captions below the comic
- create a watermark

PANEL INFORMATION:

${panelGuide}
`;

    const result = await openai.images.generate({
      model: "gpt-image-2",
      prompt,
      size: "1536x1024",
      quality: "medium",
      n: 1,
    });

    const imageBase64 = result.data?.[0]?.b64_json;

    if (!imageBase64) {
      return Response.json(
        { error: "이미지 결과를 받지 못했습니다." },
        { status: 500 }
      );
    }

    const comicBuffer = Buffer.from(imageBase64, "base64");

    const logoPath = path.join(process.cwd(), "public", "summit-logo.png");

    const fontPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "NotoSansKR-Bold.ttf"
    );

    const logoBuffer = await fs.readFile(logoPath);
    await fs.access(fontPath);

    const textToSVG = TextToSVG.loadSync(fontPath);

    const resizedLogo = await sharp(logoBuffer)
      .trim()
      .resize({
        width: 250,
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    const comicMeta = await sharp(comicBuffer).metadata();

    const comicWidth = comicMeta.width || 1536;
    const comicHeight = comicMeta.height || 1024;

    const sideMargin = 80;
    const headerHeight = 230;
    const bottomMargin = 70;

    const canvasWidth = comicWidth + sideMargin * 2;
    const canvasHeight = headerHeight + comicHeight + bottomMargin;

    const summaryText = (summary || title || "SUMMIT FOUR-CUT").trim();

    const summarySvgString = textToSVG.getSVG(summaryText, {
      x: 0,
      y: 0,
      fontSize: 64,
      anchor: "top",
      attributes: {
        fill: "#111827",
      },
    });

    const summarySvgBuffer = Buffer.from(summarySvgString);

    const whiteCanvas = await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: "#ffffff",
      },
    })
      .png()
      .toBuffer();

    const finalImage = await sharp(whiteCanvas)
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

    return Response.json({
      image: `data:image/png;base64,${finalImage.toString("base64")}`,
    });
  } catch (error: any) {
    console.error("IMAGE GENERATION ERROR:", error);

    return Response.json(
      {
        error: "만화 이미지 생성 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          error?.error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}