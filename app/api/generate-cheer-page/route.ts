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
          error: "뒷표지에 사용할 설계안이 없습니다.",
        },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const characterDescriptions = plans
      .flatMap((plan) =>
        plan.panels
          .map((panel) => panel.characters?.trim())
          .filter(Boolean)
      )
      .filter(Boolean);

    const combinedCharacters =
      characterDescriptions.join("\n");

    const cheerTextResponse =
      await openai.responses.create({
        model: "gpt-5-mini",
        input: `
중학생 영어 학습 교재 한 Lesson의 마지막 뒷표지에 들어갈
짧은 응원 문구를 한 문장으로 만들어라.

조건:
- 한국어
- 18~32자 정도
- 학생에게 자연스럽게 말하듯 쓸 것
- 밝고 힘을 주는 느낌
- 너무 감성적이거나 유치하지 않을 것
- 특정 시험명은 사용하지 말 것
- 중간고사, 기말고사라는 표현도 사용하지 말 것
- 따옴표 없이 문장만 출력
- 매번 조금씩 다른 표현을 사용할 것

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
Create a polished LANDSCAPE back-cover illustration
for a Korean middle-school English study workbook.

This is the FINAL PAGE of a workbook called "써밋네컷".

--------------------------------------------------
CHARACTERS
--------------------------------------------------

Use the recurring characters described below.

${combinedCharacters}

IMPORTANT CHARACTER RULES:

- Identify recurring characters across repeated descriptions.
- If the same character appears repeatedly across multiple panels,
  treat that person as ONE character, not several copies.
- Do not duplicate or clone characters.
- Do not merge different characters into identical-looking people.
- Especially distinguish same-gender and similar-age characters clearly.
- Use differences such as:
  hairstyle,
  hair length,
  face shape,
  glasses,
  clothing,
  backpack,
  accessories,
  height impression,
  silhouette.
- Keep the characters appropriate to their described relationships.
- Parents and teachers should look clearly adult.
- Students should look like Korean middle-school students.
- Keep all characters visually natural and consistent.

--------------------------------------------------
MAIN SCENE
--------------------------------------------------

Show the recurring characters gathered together
in a bright, celebratory final scene.

They are encouraging the student
after finishing this Lesson.

Use natural varied poses.

Possible actions:
- raising fists
- smiling
- waving
- giving thumbs-up
- holding notebooks
- cheering together
- holding a large banner together

Do NOT line everyone up stiffly.

The illustration should feel like a satisfying
"Lesson complete!" ending.

--------------------------------------------------
IMPORTANT BANNER
--------------------------------------------------

The encouragement sentence MUST BE PART OF THE ARTWORK.

Do NOT leave a blank text area.
Do NOT add the sentence later as a separate caption.

Create a large natural celebratory banner,
placard, hanging fabric sign, or similar object
that is physically integrated into the scene.

For example:
- characters holding a large banner
- a festive banner hanging behind them
- a large hand-painted placard
- a school-festival style sign

Write ONLY this Korean sentence on the banner:

"${cheerText}"

VERY IMPORTANT:

- Korean spelling must be accurate.
- The full sentence must be visible.
- The Korean letters must be large, bold, clear and readable.
- Do not cut off any letters.
- Do not add extra Korean or English words.
- Do not add speech bubbles.
- Do not add captions.
- Do not add fake logos.

The banner should feel like a natural part of the illustration,
not like a digital text box pasted onto the image.

--------------------------------------------------
COMPOSITION
--------------------------------------------------

LANDSCAPE format.

Suggested layout:

TOP / UPPER MIDDLE:
large celebratory banner containing the Korean sentence

CENTER:
the Lesson characters cheering naturally together

BOTTOM:
leave a calm, uncluttered space
for the official SUMMIT EDU logo
which will be composited afterward.

Do not place faces or important objects
inside the bottom logo area.

--------------------------------------------------
STYLE
--------------------------------------------------

- modern Korean educational webtoon
- warm clean linework
- polished workbook illustration
- expressive faces
- natural proportions
- energetic but not childish
- suitable for middle-school students
- visually cohesive
- professional educational material finish
- simple attractive background
- no photorealism
- no preschool style
`;

    const imageResponse =
      await openai.images.generate({
        model: "gpt-image-2",
        prompt: imagePrompt,
        size: "1536x1024",
        quality: "medium",
        n: 1,
      });

    const imageBase64 =
      imageResponse.data?.[0]?.b64_json;

    if (!imageBase64) {
      return Response.json(
        {
          error: "뒷표지 이미지가 생성되지 않았습니다.",
        },
        { status: 500 }
      );
    }

    const aiImageBuffer = Buffer.from(
      imageBase64,
      "base64"
    );

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

    const finalImage = await sharp(aiImageBuffer)
      .resize(1536, 1024, {
        fit: "cover",
      })
      .composite([
        {
          input: resizedLogo,
          left: 603,
          top: 855,
        },
      ])
      .png()
      .toBuffer();

    return Response.json({
      image: `data:image/png;base64,${finalImage.toString(
        "base64"
      )}`,
      cheerText,
    });
  } catch (error: any) {
    console.error(
      "GENERATE BACK COVER ERROR:",
      error
    );

    return Response.json(
      {
        error: "뒷표지 생성 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}