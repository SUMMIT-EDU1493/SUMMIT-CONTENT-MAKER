import OpenAI from "openai";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

type RequestBody = {
  schoolName?: string;
  gradeName?: string;
  lessonName?: string;
  referenceImages?: string[];
};

function toDataUri(buffer: Buffer) {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function dataUrlToBuffer(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");

  if (commaIndex === -1) {
    throw new Error("참조 이미지 형식이 올바르지 않습니다.");
  }

  const base64 = dataUrl.slice(commaIndex + 1);

  return Buffer.from(base64, "base64");
}

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

    const referenceImages = Array.isArray(body.referenceImages)
      ? body.referenceImages
          .filter(Boolean)
          .slice(0, 2)
      : [];

    if (referenceImages.length === 0) {
      return Response.json(
        {
          error:
            "뒷표지에 참고할 본문 만화 이미지가 없습니다.",
        },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const cheerMessages = [
      "오늘도 여기까지 온 너, 진짜 잘하고 있어!",
      "끝까지 해낸 힘, 그게 진짜 실력이야!",
      "차근차근 쌓아온 만큼 좋은 결과가 따라올 거야!",
      "열심히 달려온 너라면 분명 해낼 수 있어!",
    ];

    const cheerText =
      cheerMessages[
        Math.floor(
          Math.random() *
            cheerMessages.length
        )
      ];

    const referenceFiles = [];

    for (
      let index = 0;
      index < referenceImages.length;
      index++
    ) {
      const buffer =
        dataUrlToBuffer(
          referenceImages[index]
        );

      const normalized =
        await sharp(buffer)
          .resize({
            width: 1536,
            height: 1024,
            fit: "inside",
            withoutEnlargement: true,
          })
          .png()
          .toBuffer();

      referenceFiles.push(
        new File(
          [normalized],
          `reference-${index + 1}.png`,
          {
            type: "image/png",
          }
        )
      );
    }

    const prompt = `
Create ONE final back-cover illustration for a Korean high-school educational comic PDF.

VERY IMPORTANT:
The attached reference images are actual comic pages from the same lesson.

You MUST use the main recurring characters visible in those reference comic pages.

Do NOT replace them with random generic Korean students.

==================================================
CHARACTER REFERENCE RULE
==================================================

Study the supplied reference images carefully.

Reuse 3 to 5 representative recurring characters from them.

Preserve as closely as possible:
- hairstyle
- hair color
- apparent age
- facial impression
- clothing style
- gender
- overall visual identity

If the reference contains adults, teachers, workers, researchers, parents, officials, or other non-student characters,
they are allowed and SHOULD be included when they are important recurring characters.

Do NOT automatically convert everyone into school-uniform students.

Do NOT invent a new crowd.

Do NOT add random classmates.

Do NOT create five generic uniformed students merely because this is for high school.

The final page should feel like:
"the cast from the previous comic pages has gathered together for the ending."

==================================================
COMPOSITION
==================================================

- landscape 1536x1024
- white or very light warm background
- print-friendly
- clean and bright
- no dark full-page background
- 3 to 5 characters only
- characters gathered naturally
- cheering, smiling, thumbs-up, fist pose, or holding a banner
- warm finale feeling
- plenty of white space
- no overcrowding

==================================================
TEXT
==================================================

Include this Korean encouragement phrase naturally in the artwork:

"${cheerText}"

Prefer:
- one banner
- one placard
- one large speech bubble

Do not scatter many unrelated text elements.

==================================================
STYLE
==================================================

- same general modern webtoon illustration feel as the supplied comic pages
- mature high-school level
- not childish
- not chibi
- clean and polished
- light, warm, celebratory
- suitable for printing

==================================================
ABSOLUTE DO-NOT
==================================================

- no generic school-uniform crowd
- no random new students
- no duplicated clones
- no five nearly identical teenagers
- do not ignore adults or non-student characters from the references
- no dark background
- no logo inside the generated artwork
`;

    const imageResponse =
      await openai.images.edit({
        model: "gpt-image-2",
        image: referenceFiles,
        prompt,
        size: "1536x1024",
        quality: "medium",
        n: 1,
      });

    const imageData =
      imageResponse.data?.[0]?.b64_json;

    if (!imageData) {
      throw new Error(
        "뒷표지 이미지 데이터가 없습니다."
      );
    }

    const baseImage = Buffer.from(
      imageData,
      "base64"
    );

    const logoPath = path.join(
      process.cwd(),
      "public",
      "summit-logo.png"
    );

    const logoFile =
      await fs.readFile(logoPath);

    const logoBuffer =
      await sharp(logoFile)
        .trim()
        .resize({
          width: 300,
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();

    const finalImage =
      await sharp(baseImage)
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
    });
  } catch (error: any) {
    console.error(
      "HIGH BACK COVER ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "고등 뒷표지 생성 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          error?.error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}