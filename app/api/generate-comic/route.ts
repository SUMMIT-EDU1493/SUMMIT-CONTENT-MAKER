import OpenAI from "openai";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

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

    const {
      title,
      summary,
      panels,
      keyWords,
      keyExpressions,
    } = body;

    if (!panels || !Array.isArray(panels) || panels.length !== 4) {
      return Response.json(
        { error: "4컷 설계안이 없습니다." },
        { status: 400 }
      );
    }

    const panelGuide = panels
      .map(
        (panel: any, index: number) => `
패널 ${index + 1}
장면 설명: ${panel.scene}
등장인물: ${panel.characters}
원본 영어 내용: ${panel.english}
원본 한글 의미: ${panel.korean}
`
      )
      .join("\n");

    const vocabHints = (keyWords || [])
      .slice(0, 10)
      .map((item: any) => `${item.korean}(${item.english})`)
      .join(", ");

    const expressionHints = (keyExpressions || [])
      .slice(0, 8)
      .map((item: any) => `${item.korean}(${item.english})`)
      .join(", ");

    const prompt = `
Create ONE polished educational four-panel comic for Korean middle-school English learners.

This should feel like a real "SUMMIT four-cut comic", not a worksheet.

LAYOUT
- Landscape orientation
- Exactly four panels
- 2 x 2 grid
- Equal-sized panels
- Clear comic borders
- Warm, clean, friendly educational comic style
- Characters must stay visually consistent across all panels

TEXT STYLE
- Dialogue must feel like natural comic speech.
- Use large, bold, highly readable speech-bubble lettering.
- Do NOT use worksheet-style tiny typed text.
- Keep speech bubbles visually clear and easy to read.

KOREAN DIALOGUE TONE
- The speakers are friends or classmates.
- Use casual Korean speech only.
- No polite Korean endings such as "~요", "~습니다", "~해요".
- Use friendly, lively, natural 반말.
- The dialogue should sound like a real comic, not like a textbook translation.
- Good examples of tone:
  "대박이다!"
  "와, 진짜?"
  "넌 꼭 훌륭한 축구선수가 될 거야!"
  "좋은 생각이다!"
  "같이 해보자!"

VERY IMPORTANT CONTENT RULES
- Do NOT reproduce the original dialogue line by line.
- Do NOT make it sound like a literal translation.
- Adapt only the key meaning into short, lively comic dialogue.
- Each panel should contain about 1 or 2 short speech bubbles.
- Keep the wording concise and punchy.

ENGLISH LEARNING RULE
- Each panel should naturally include at least one important English learning word or expression if appropriate.
- Across the whole comic, include about 4 to 6 important English learning items in total.
- Blend them naturally into the Korean dialogue.
- Preferred style:
  한글(English)
- Examples:
  계획(plan)
  약속(appointment)
  축구선수(soccer player)
  좋은 생각이야.(That's a good idea.)
- Do NOT create a separate vocabulary box.
- Do NOT create a separate key-expression box.
- The English should appear naturally inside the comic dialogue only.

DO NOT
- Do not print full English dialogue.
- Do not print English sentence + Korean translation.
- Do not add a study note section.
- Do not add a fake logo.
- Do not draw a logo.
- Do not draw a blank white logo box.
- Do not write SUMMIT EDU inside the comic artwork.

TITLE
${title || "SUMMIT FOUR-CUT"}

SUMMARY
${summary || ""}

SOURCE MATERIAL
${panelGuide}

IMPORTANT WORD HINTS
${vocabHints}

IMPORTANT EXPRESSION HINTS
${expressionHints}
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
    const logoBuffer = await fs.readFile(logoPath);

    const resizedLogo = await sharp(logoBuffer)
      .resize({
        width: 170,
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    // 만화 바깥쪽에 흰 여백 추가
    const extendedComic = await sharp(comicBuffer)
      .extend({
        top: 20,
        bottom: 90,
        left: 20,
        right: 140,
        background: "#ffffff",
      })
      .png()
      .toBuffer();

    const finalImage = await sharp(extendedComic)
      .composite([
        {
          input: resizedLogo,
          gravity: "southeast",
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