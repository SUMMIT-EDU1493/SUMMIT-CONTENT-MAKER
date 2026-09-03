import OpenAI from "openai";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

export async function GET() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        {
          error: "OPENAI_API_KEY가 설정되어 있지 않습니다.",
        },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 테스트용 고정 응원문구
    const cheerText =
      "열심히 쌓아온 만큼 좋은 결과가 따라올 거야!";

    // 실제 Lesson 분석 없이 사용하는 테스트용 캐릭터
    const sampleCharacters = `
1. Korean middle-school boy:
   short black hair, round glasses, navy hoodie, cheerful expression

2. Korean middle-school girl:
   shoulder-length dark brown hair, cream cardigan, green backpack,
   lively and confident expression

3. Korean middle-school boy:
   slightly wavy black hair, gray sweatshirt, taller than the others,
   relaxed friendly expression

4. Korean middle-school girl:
   short bob haircut, light blue shirt, small hair clip,
   bright energetic expression
`;

    const prompt = `
Create a polished LANDSCAPE back-cover illustration
for a Korean middle-school English study workbook.

This is the final page of a workbook called "써밋네컷".

--------------------------------------------------
CHARACTERS
--------------------------------------------------

Use these four clearly different characters:

${sampleCharacters}

IMPORTANT:
- All four characters must look obviously different.
- Do not duplicate or clone characters.
- Different hairstyles, faces, clothes, silhouettes and accessories.
- Keep them age-appropriate Korean middle-school students.
- Natural modern Korean educational webtoon style.
- Warm, polished, professional, not childish.

--------------------------------------------------
MAIN SCENE
--------------------------------------------------

Show all four characters happily celebrating together
after finishing their study lesson.

They can:
- raise their fists
- give thumbs-up
- wave
- smile
- cheer together
- hold notebooks or pencils

Do NOT line them up stiffly.

Use varied poses and natural interaction.

The scene should feel like:
"We finished this lesson. You can do it!"

--------------------------------------------------
IMPORTANT BANNER
--------------------------------------------------

The encouragement sentence MUST BE PART OF THE ILLUSTRATION.

Do NOT leave a blank text box.

Create a large, natural celebratory banner / placard /
hanging fabric sign above the characters.

The banner should look physically integrated into the scene.

For example:
- characters holding a large banner
- a festive banner hanging behind them
- a large hand-painted placard above them

Write ONLY this Korean sentence on the banner:

"${cheerText}"

VERY IMPORTANT:
- Korean spelling must be accurate.
- Make the Korean letters large, bold, clear and readable.
- Do not add any other Korean or English text.
- Do not create speech bubbles.
- Do not add captions.
- Do not add fake logos.

The banner should be visually attractive,
but the sentence must remain easy to read.

--------------------------------------------------
COMPOSITION
--------------------------------------------------

LANDSCAPE format.

The composition should roughly be:

TOP / UPPER MIDDLE:
large celebratory banner with the Korean encouragement sentence

CENTER:
four distinct characters cheering together

BOTTOM:
leave some calm clean visual space
for the official SUMMIT EDU logo
which will be composited later.

Do not place faces or important objects
in the bottom logo area.

--------------------------------------------------
STYLE
--------------------------------------------------

- modern Korean educational webtoon
- clean line art
- expressive faces
- natural proportions
- warm and energetic
- sophisticated enough for middle-school students
- polished workbook illustration
- simple but attractive background
- visually cohesive
- not preschool style
- not overly cute
- no photo realism
`;

    const imageResponse = await openai.images.generate({
      model: "gpt-image-2",
      prompt,
      size: "1536x1024",
      quality: "medium",
      n: 1,
    });

    const imageBase64 =
      imageResponse.data?.[0]?.b64_json;

    if (!imageBase64) {
      return Response.json(
        {
          error: "테스트 뒷표지 이미지가 생성되지 않았습니다.",
        },
        { status: 500 }
      );
    }

    const aiImageBuffer = Buffer.from(
      imageBase64,
      "base64"
    );

    // 공식 SUMMIT EDU 로고는 AI에게 그리게 하지 않고
    // 실제 로고 파일을 마지막에 정확하게 합성
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

    return new Response(
      new Uint8Array(finalImage),
      {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "TEST BACK COVER AI ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "AI 뒷표지 테스트 생성 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}