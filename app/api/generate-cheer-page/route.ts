import OpenAI from "openai";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

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
  title: string;
  summary: string;
  panels: ComicPanel[];
};

type RequestBody = {
  plans: ComicPlan[];
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

    const plans = body?.plans;

    if (!Array.isArray(plans) || plans.length === 0) {
      return Response.json(
        {
          error: "응원장에 사용할 설계안이 없습니다.",
        },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const characterDescriptions = plans
      .flatMap((plan) =>
        plan.panels.map((panel) => panel.characters?.trim()).filter(Boolean)
      )
      .filter(Boolean);

    const combinedCharacters = characterDescriptions.join("\n");

    const cheerTextResponse = await openai.responses.create({
      model: "gpt-5-mini",
      input: `
다음은 중학생 영어 학습 만화 한 Lesson에 등장한 캐릭터 설명들이다.

${combinedCharacters}

이 Lesson의 학습을 마친 학생에게 보여줄 마지막 응원장 문구를 만들어라.

조건:
- 한국어
- 한 문장
- 18~32자 정도
- 특정 시험명이나 중간고사, 기말고사라는 표현은 사용하지 말 것
- 부담스럽거나 지나치게 감성적이지 않게
- 밝고 자신감을 주는 문장
- 학생에게 자연스럽게 말하듯 쓸 것
- 매번 다른 문구가 나올 수 있게 표현을 다양하게 할 것
- 따옴표 없이 문장만 출력

예시 분위기:
열심히 쌓아온 만큼 좋은 결과가 따라올 거야!
여기까지 해낸 너, 정말 잘하고 있어!
차근차근 준비한 만큼 자신 있게 보여주자!
`,
    });

    const cheerText =
      cheerTextResponse.output_text?.trim() ||
      "차근차근 준비한 만큼 자신 있게 보여주자!";

    const imagePrompt = `
Create a polished final encouragement illustration for a Korean middle-school English study workbook.

This is the LAST PAGE after a series of educational four-panel comics.

CHARACTERS:
Use the following character descriptions as reference.

${combinedCharacters}

IMPORTANT CHARACTER RULES:
- Represent the distinct recurring characters described above.
- Do not merge different characters into identical-looking people.
- Especially distinguish same-gender and same-age characters clearly.
- Use differences such as hairstyle, hair length, face shape, glasses, clothing, bag, accessories, height impression, and silhouette.
- Keep each character visually believable and consistent with the descriptions.
- Do not duplicate or clone the same character.
- If the descriptions repeat the same person across panels, treat them as one recurring character rather than multiple copies.

SCENE:
- Show the characters gathered together naturally, encouraging the student.
- Bright, energetic, friendly Korean educational webtoon style.
- Clean polished illustration.
- Warm but not childish.
- Suitable for middle-school students.
- Characters may raise fists, wave, smile, give thumbs-up, hold notebooks, or cheer naturally.
- Use varied poses.
- Avoid lining everyone up stiffly.
- Use a simple bright background with a sense of completion and achievement.
- No classroom-heavy boring composition unless natural.
- No speech bubbles.
- No text inside the generated artwork.
- No logos inside the AI-generated artwork.

COMPOSITION:
- Landscape image.
- Leave generous clean open space near the TOP CENTER for an encouragement sentence to be added later.
- Leave clean space near the BOTTOM CENTER for the SUMMIT EDU logo.
- Characters should mainly occupy the middle area.
- Do not place important faces or objects in the reserved text/logo areas.

STYLE:
- modern Korean educational webtoon
- warm clean linework
- polished
- expressive faces
- natural proportions
- cohesive color palette
- professional workbook finish
`;

    const imageResponse = await openai.images.generate({
      model: "gpt-image-2",
      prompt: imagePrompt,
      size: "1536x1024",
      quality: "medium",
      n: 1,
    });

    const imageBase64 = imageResponse.data?.[0]?.b64_json;

    if (!imageBase64) {
      return Response.json(
        {
          error: "응원장 이미지가 생성되지 않았습니다.",
        },
        { status: 500 }
      );
    }

    const aiImageBuffer = Buffer.from(imageBase64, "base64");

    const logoPath = path.join(
      process.cwd(),
      "public",
      "summit-logo.png"
    );

    const logoBuffer = await fs.readFile(logoPath);

    const resizedLogo = await sharp(logoBuffer)
      .trim()
      .resize({
        width: 330,
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    const canvasWidth = 1536;
    const canvasHeight = 1024;

    const resizedArtwork = await sharp(aiImageBuffer)
      .resize(canvasWidth, canvasHeight, {
        fit: "cover",
      })
      .png()
      .toBuffer();

    const textSvg = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${canvasWidth}"
        height="${canvasHeight}"
      >
        <style>
          .title {
            font-family: "Arial", "Noto Sans KR", sans-serif;
            font-size: 52px;
            font-weight: 800;
            fill: #111111;
          }
        </style>

        <rect
          x="118"
          y="70"
          width="1300"
          height="120"
          rx="34"
          ry="34"
          fill="rgba(255,255,255,0.88)"
        />

        <text
          x="768"
          y="145"
          text-anchor="middle"
          class="title"
        >
          ${escapeXml(cheerText)}
        </text>
      </svg>
    `;

    const textBuffer = Buffer.from(textSvg);

    const finalImage = await sharp(resizedArtwork)
      .composite([
        {
          input: textBuffer,
          left: 0,
          top: 0,
        },
        {
          input: resizedLogo,
          left: 603,
          top: 835,
        },
      ])
      .png()
      .toBuffer();

    return Response.json({
      image: `data:image/png;base64,${finalImage.toString("base64")}`,
      cheerText,
    });
  } catch (error: any) {
    console.error("GENERATE CHEER PAGE ERROR:", error);

    return Response.json(
      {
        error: "응원장 생성 중 오류가 발생했습니다.",
        detail: error?.message || "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}