import OpenAI from "openai";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

type RequestBody = {
  schoolName?: string;
  gradeName?: string;
  lessonName?: string;
  characterHints?: string[];
};

function toDataUri(buffer: Buffer) {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as RequestBody;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const messages = [
      "오늘도 여기까지 온 너, 진짜 잘하고 있어!",
      "차근차근 쌓아온 만큼 좋은 결과가 따라올 거야!",
      "끝까지 해낸 힘, 그게 진짜 실력이야!",
      "열심히 달려온 너라면 분명 해낼 수 있어!",
    ];

    const pickedMessage =
      messages[Math.floor(Math.random() * messages.length)];

    const characterHints = Array.isArray(body.characterHints)
      ? body.characterHints
          .map((v) => v.trim())
          .filter(Boolean)
      : [];

    const uniqueCharacterHints = [...new Set(characterHints)].slice(0, 10);

    const characterPrompt =
      uniqueCharacterHints.length > 0
        ? `
IMPORTANT CHARACTER REUSE:
Use the SAME main characters that appeared in the comic pages.
Do NOT replace them with random generic students.

Here are the character hints collected from the comic pages:
${uniqueCharacterHints.map((v, i) => `${i + 1}. ${v}`).join("\n")}

Rules:
- show only 3 to 5 representative recurring characters
- do not overcrowd the page
- do not create duplicated clone-like people
- if there are both boys and girls in the hints, reflect that
- keep them looking like Korean high-school students
- make them feel like the cast of the comic pages
`
        : `
If specific character information is limited,
show 3 to 5 Korean high-school students with clear visual variety,
but avoid a generic crowd.
`;

    const prompt = `
Create a polished final back-cover page for a Korean educational comic PDF.

IMPORTANT:
- white background
- print-friendly
- clean and bright
- no black full-page background
- same overall series feeling as the front cover
- suitable for printing and handout distribution

${characterPrompt}

SCENE:
- warm final-page illustration
- supportive and encouraging mood
- high-school age appearance
- refined and slightly lively
- characters can smile, cheer, gesture supportively, or hold a simple banner
- clean composition with enough empty space for the encouragement line
- not too many people
- avoid clone-like repeated faces
- the characters should feel like they have just appeared throughout the comic pages

TEXT:
Show one short encouraging Korean phrase naturally inside the image,
for example on a banner, speech bubble, or sign:

"${pickedMessage}"

STYLE:
- mature teenage vibe
- neat
- warm
- light
- clean
- visually consistent with an educational comic series
- suitable as a final page

DO NOT:
- use black background
- create a very text-heavy layout
- add random extra English text
- make the page look like a dark poster
`;

    const imageResponse = await openai.images.generate({
      model: "gpt-image-2",
      size: "1536x1024",
      quality: "medium",
      n: 1,
      prompt,
    });

    const imageData = imageResponse.data?.[0]?.b64_json;

    if (!imageData) {
      throw new Error("뒷표지 이미지 데이터가 없습니다.");
    }

    const baseImage = Buffer.from(imageData, "base64");

    const logoPath = path.join(process.cwd(), "public", "summit-logo.png");
    const logoFile = await fs.readFile(logoPath);

    const logoBuffer = await sharp(logoFile)
      .trim()
      .resize({ width: 260 })
      .png()
      .toBuffer();

    const finalImage = await sharp(baseImage)
      .resize({
        width: 1536,
        height: 1024,
        fit: "cover",
      })
      .composite([
        {
          input: logoBuffer,
          left: 638,
          top: 860,
        },
      ])
      .png()
      .toBuffer();

    return Response.json({
      image: toDataUri(finalImage),
    });
  } catch (error: any) {
    console.error("HIGH BACK COVER ERROR:", error);

    return Response.json(
      {
        error: "고등 뒷표지 생성 중 오류가 발생했습니다.",
        detail: error?.message || "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}