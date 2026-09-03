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

    const repeatedCharacterDescriptions = `
1컷:
- 남학생 민수: 짧은 검은 머리, 네이비 후드티, 안경 없음
- 여학생 지은: 어깨 길이 갈색 머리, 크림색 가디건, 초록색 가방

2컷:
- 민수: 짧은 검은 머리의 중학생 남학생, 네이비 후드티
- 지은: 갈색 어깨 길이 머리, 크림 가디건을 입은 중학생 여학생

3컷:
- 민수: 네이비 후드티를 입은 같은 남학생
- 지은: 초록색 가방을 멘 같은 여학생
- 영어 선생님: 30대 여성, 단정한 단발머리, 베이지 재킷

4컷:
- 민수: 앞 컷과 같은 남학생
- 지은: 앞 컷과 같은 여학생

5컷:
- 민수: 네이비 후드티, 짧은 검은 머리
- 지은: 갈색 머리, 크림 가디건
- 영어 선생님: 앞서 등장한 동일한 여성 교사

6컷:
- 지은의 어머니: 40대 여성, 긴 검은 머리, 밝은 셔츠
- 지은: 같은 중학생 여학생

7컷:
- 민수: 같은 남학생
- 지은: 같은 여학생
- 영어 선생님: 같은 교사
`;

    const dedupResponse = await openai.responses.create({
      model: "gpt-5-mini",
      input: `
다음은 한 Lesson의 여러 만화 컷에서 반복해서 등장한 캐릭터 설명이다.

${repeatedCharacterDescriptions}

이 설명들을 분석해서 "고유 인물"만 추려라.

매우 중요:
- 같은 사람이 여러 컷에서 반복 설명되어도 한 명으로 합칠 것.
- 옷, 머리, 관계, 이름, 역할 등을 이용해 동일 인물을 판단할 것.
- 같은 사람을 여러 명으로 중복 계산하지 말 것.
- 서로 다른 사람을 하나로 합치지 말 것.
- 최종 뒷표지에는 모든 반복 묘사를 나열하는 것이 아니라 고유 인물만 사용한다.
- 너무 많은 인물이 있을 경우 주요 등장인물 중심으로 최대 6명까지만 선택한다.
- 친구, 교사, 부모처럼 관계가 다른 인물은 구분한다.
- 각 인물의 가장 안정적인 외형 특징을 하나의 설명으로 통합한다.

JSON만 출력:

{
  "characters": [
    {
      "id": "character_1",
      "role": "중학생 남학생 / 친구",
      "description": "짧은 검은 머리, 네이비 후드티, 또래 중학생 체격"
    }
  ]
}
`,
    });

    const rawText = dedupResponse.output_text?.trim();

    if (!rawText) {
      throw new Error(
        "고유 캐릭터 목록을 만들지 못했습니다."
      );
    }

    let parsed;

    try {
      parsed = JSON.parse(
        rawText
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/, "")
      );
    } catch {
      throw new Error(
        "고유 캐릭터 JSON을 해석하지 못했습니다."
      );
    }

    const uniqueCharacters = Array.isArray(
      parsed?.characters
    )
      ? parsed.characters.slice(0, 6)
      : [];

    if (uniqueCharacters.length === 0) {
      throw new Error(
        "고유 캐릭터가 없습니다."
      );
    }

    const characterGuide = uniqueCharacters
      .map(
        (
          character: {
            id?: string;
            role?: string;
            description?: string;
          },
          index: number
        ) => `
CHARACTER ${index + 1}
ROLE: ${character.role || ""}
DESCRIPTION: ${character.description || ""}
`
      )
      .join("\n");

    const cheerText =
      "여기까지 해낸 너, 정말 잘하고 있어!";

    const prompt = `
Create a polished LANDSCAPE back-cover illustration
for a Korean middle-school English study workbook.

This is the FINAL PAGE of a workbook called "써밋네컷".

==================================================
UNIQUE CHARACTERS
==================================================

The following list has already been deduplicated.

There are EXACTLY ${uniqueCharacters.length} unique people.

${characterGuide}

VERY IMPORTANT:

- Show each listed character exactly ONCE.
- Do NOT create duplicate versions of any character.
- Do NOT create clones.
- Do NOT repeat the same student on both sides of the group.
- Do NOT interpret repeated clothing details as additional people.
- The total visible character count should be approximately ${uniqueCharacters.length}.
- Never double the number of people.
- If there are 4 unique people, show about 4 people.
- If there are 5 unique people, show about 5 people.
- If there are 6 unique people, show about 6 people.

Different characters must look clearly different.

Keep:
- students as middle-school age
- parents clearly adult
- teachers clearly adult
- male and female student classmates as similar-age teenagers

==================================================
MAIN SCENE
==================================================

Show all unique characters together
in one warm celebratory scene.

They are cheering after finishing the lesson.

Use natural varied poses such as:
- thumbs-up
- raised fist
- smiling
- waving
- holding notebooks
- holding the banner together

Do NOT line everyone up stiffly.

==================================================
BANNER
==================================================

Include a large natural celebratory banner
integrated into the illustration.

Write ONLY this Korean sentence:

"${cheerText}"

VERY IMPORTANT:
- Korean spelling must be accurate.
- Large, bold and readable.
- Full sentence visible.
- Do not add extra text.
- No speech bubbles.
- No captions.
- No fake logo.

==================================================
COMPOSITION
==================================================

LANDSCAPE.

Upper area:
banner with encouragement sentence.

Middle:
the unique characters.

Bottom:
leave a clean calm area for the official SUMMIT EDU logo.

Do not place faces in the bottom logo area.

==================================================
STYLE
==================================================

- modern Korean educational webtoon
- polished
- warm
- clean
- natural proportions
- suitable for middle-school students
- not childish
- not preschool
- professional workbook illustration

FINAL CHECK:
1. Count the unique character list.
2. Show each listed person once.
3. No duplicate people.
4. No clones.
5. No extra random students.
6. Adults remain adults.
7. Students remain teenagers.
8. Banner sentence is readable.
`;

    const imageResponse =
      await openai.images.generate({
        model: "gpt-image-2",
        prompt,
        size: "1536x1024",
        quality: "medium",
        n: 1,
      });

    const imageBase64 =
      imageResponse.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error(
        "뒷표지 테스트 이미지가 생성되지 않았습니다."
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

    const logoBuffer =
      await fs.readFile(logoPath);

    const resizedLogo =
      await sharp(logoBuffer)
        .trim()
        .resize({
          width: 330,
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();

    const finalImage =
      await sharp(aiImageBuffer)
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

          // 개발 확인용.
          "X-Unique-Characters": String(
            uniqueCharacters.length
          ),
        },
      }
    );
  } catch (error: any) {
    console.error(
      "TEST BACK COVER DEDUP ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "뒷표지 인물 중복 테스트 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}