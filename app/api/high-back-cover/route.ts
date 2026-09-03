import OpenAI from "openai";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

type Dialogue = {
  speaker?: string;
  text?: string;
};

type Panel = {
  scene?: string;
  characters?: string;
  dialogue?: Dialogue[];
};

type Plan = {
  id?: string;
  englishTitle?: string;
  koreanSubtitle?: string;
  blockSummary?: string;
  panels?: Panel[];
};

type RequestBody = {
  schoolName?: string;
  gradeName?: string;
  lessonName?: string;
  plans?: Plan[];
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
    const plans = Array.isArray(body.plans) ? body.plans : [];

    const rawHints: string[] = [];

    for (const plan of plans) {
      for (const panel of plan.panels || []) {
        if (panel.characters?.trim()) {
          rawHints.push(panel.characters.trim());
        }

        for (const line of panel.dialogue || []) {
          if (line.speaker?.trim()) {
            rawHints.push(line.speaker.trim());
          }
        }

        if (panel.scene?.trim()) {
          rawHints.push(panel.scene.trim());
        }
      }
    }

    const uniqueHints = [...new Set(rawHints)]
      .filter(Boolean)
      .slice(0, 20);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    let castSummary = uniqueHints.join("\n");

    if (uniqueHints.length > 0) {
      const castResponse = await openai.responses.create({
        model: "gpt-5-mini",
        input: `
다음은 같은 학습만화 여러 장에서 추출한 등장인물/장면 정보다.

중복을 제거하고,
실제로 반복 등장한 대표 인물만 최대 5명으로 정리해라.

중요:
- 학생이 아닌 인물도 반드시 유지
- 교사, 연구원, 부모, 직원, 어른 등이 있으면 학생으로 바꾸지 말 것
- "학생 여러 명"처럼 뭉뚱그리지 말 것
- 각 인물은 역할 + 외형 단서가 있으면 같이 남길 것
- 없는 정보를 새로 만들지 말 것

정보:
${uniqueHints.join("\n")}

출력은 인물 한 명당 한 줄.
`,
      });

      const text =
        castResponse.output_text?.trim();

      if (text) {
        castSummary = text;
      }
    }

    const cheerMessages = [
      "오늘도 여기까지 온 너, 진짜 잘하고 있어!",
      "끝까지 해낸 힘, 그게 진짜 실력이야!",
      "차근차근 쌓아온 만큼 좋은 결과가 따라올 거야!",
      "열심히 달려온 너라면 분명 해낼 수 있어!",
    ];

    const cheerText =
      cheerMessages[
        Math.floor(Math.random() * cheerMessages.length)
      ];

    const prompt = `
Create a bright final back-cover illustration for a Korean educational comic PDF.

IMPORTANT:
Use ONLY the representative cast described below.
Do not replace them with generic students.

CAST:
${castSummary || "No cast details available."}

RULES:
- 3 to 5 characters maximum
- preserve roles from the cast
- if an adult appears in the cast, keep them as an adult
- if a teacher appears, keep them as a teacher
- if a researcher or worker appears, keep that role
- do not turn everyone into high-school students
- do not invent a random school-uniform crowd
- do not make clone-like faces

SCENE:
- warm ending scene
- white or very light background
- print-friendly
- characters cheering or encouraging together
- one simple banner, placard, or speech bubble

TEXT:
"${cheerText}"

STYLE:
- modern Korean webtoon
- polished
- mature teen level
- bright
- clean
- not chibi
- not childish

DO NOT:
- use a dark background
- add random extra English text
- add a logo inside the generated artwork
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

    const logoPath = path.join(
      process.cwd(),
      "public",
      "summit-logo.png"
    );

    const logoFile = await fs.readFile(logoPath);

    const logoBuffer = await sharp(logoFile)
      .trim()
      .resize({ width: 300 })
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
          left: 618,
          top: 845,
        },
      ])
      .png()
      .toBuffer();

    return Response.json({
      image: toDataUri(finalImage),
      cheerText,
      castSummary,
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