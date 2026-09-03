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

type UniqueCharacter = {
  id?: string;
  role?: string;
  description?: string;
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

    // 모든 컷에 반복되어 있는 캐릭터 설명 수집
    const characterDescriptions = plans
      .flatMap((plan) =>
        plan.panels
          .map((panel) => panel.characters?.trim())
          .filter(Boolean)
      )
      .filter(Boolean);

    const combinedCharacters =
      characterDescriptions.join("\n\n");

    // 1단계:
    // 반복되는 캐릭터 설명을 고유 인물 목록으로 먼저 정리
    const dedupResponse =
      await openai.responses.create({
        model: "gpt-5-mini",
        input: `
다음은 한 Lesson의 여러 영어 학습 만화 컷에서 등장한 캐릭터 설명들이다.

같은 인물이 여러 컷에서 반복해서 설명되어 있을 수 있다.

==============================
원본 캐릭터 설명
==============================

${combinedCharacters}

==============================
해야 할 일
==============================

위 설명을 분석하여 "고유 인물"만 추려라.

매우 중요:

- 같은 사람이 여러 컷에서 반복 설명되어도 반드시 한 명으로 합칠 것.
- 이름, 역할, 성별, 나이대, 머리모양, 옷, 관계 등을 이용해 동일 인물을 판단할 것.
- 같은 사람을 여러 명으로 중복 계산하지 말 것.
- 서로 다른 사람을 억지로 하나로 합치지 말 것.
- 친구, 학생, 교사, 부모 등 관계가 다른 인물은 명확히 구분할 것.
- 각 인물의 반복 묘사를 하나의 안정적인 외형 설명으로 통합할 것.
- 뒷표지에는 원본 설명의 반복 횟수와 관계없이 고유 인물만 등장해야 한다.
- 등장인물이 너무 많다면 이야기에서 반복적으로 등장한 주요 인물을 우선한다.
- 최종 인물은 최대 6명까지만 선택한다.
- 가능하면 핵심 학생 캐릭터를 우선한다.
- 부모/교사 등 성인은 실제로 주요 등장인물일 때만 포함한다.

학생 캐릭터:
- 중학생 또래의 자연스러운 청소년 체격
- 여자 학생을 남학생보다 지나치게 작거나 어린아이처럼 설정하지 말 것

JSON만 출력:

{
  "characters": [
    {
      "id": "character_1",
      "role": "중학생 남학생 / 친구",
      "description": "짧은 검은 머리, 네이비 후드티, 중학생 또래 체격"
    }
  ]
}
`,
      });

    const dedupText =
      dedupResponse.output_text?.trim();

    if (!dedupText) {
      throw new Error(
        "고유 캐릭터 목록을 만들지 못했습니다."
      );
    }

    let parsedCharacters: {
      characters?: UniqueCharacter[];
    };

    try {
      parsedCharacters = JSON.parse(
        dedupText
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/, "")
      );
    } catch {
      throw new Error(
        "고유 캐릭터 JSON을 해석하지 못했습니다."
      );
    }

    const uniqueCharacters =
      Array.isArray(
        parsedCharacters?.characters
      )
        ? parsedCharacters.characters.slice(0, 6)
        : [];

    if (uniqueCharacters.length === 0) {
      throw new Error(
        "뒷표지에 사용할 고유 캐릭터가 없습니다."
      );
    }

    const characterGuide =
      uniqueCharacters
        .map(
          (
            character,
            index
          ) => `
CHARACTER ${index + 1}

ROLE:
${character.role || ""}

DESCRIPTION:
${character.description || ""}
`
        )
        .join("\n");

    // 2단계:
    // 뒷표지 응원 문구 생성
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
- 밝고 자신감을 주는 느낌
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

    // 3단계:
    // 고유 인물만 사용해 뒷표지 생성
    const imagePrompt = `
Create a polished LANDSCAPE back-cover illustration
for a Korean middle-school English study workbook.

This is the FINAL PAGE of a workbook called "써밋네컷".

==================================================
UNIQUE CHARACTERS
==================================================

The following character list has already been deduplicated.

There are EXACTLY ${uniqueCharacters.length} unique people.

${characterGuide}

VERY IMPORTANT:

- Show each listed character exactly ONCE.
- Do NOT duplicate any listed character.
- Do NOT create clones.
- Do NOT repeat the same student on opposite sides of the group.
- Do NOT create extra random students.
- Do NOT interpret repeated clothing details as new people.
- The total visible people should be approximately ${uniqueCharacters.length}.
- Never double the character count.

If there are:
- 3 unique people -> show about 3 people.
- 4 unique people -> show about 4 people.
- 5 unique people -> show about 5 people.
- 6 unique people -> show about 6 people.

Different characters must look clearly different.

Use clear visual differences such as:
- hairstyle
- hair length
- face shape
- glasses
- clothing
- backpack
- accessories
- silhouette

==================================================
AGE AND RELATIONSHIP
==================================================

Students:
- should look like Korean middle-school students
- should use natural teenage facial and body proportions
- should not look preschool-like or elementary-school age

Male and female classmates:
- should look like same-age teenage peers
- should have comparable adolescent body scale
- female students must NOT automatically look much smaller or younger

Parents:
- clearly adult

Teachers:
- clearly adult

Do not make an adult look like another teenage classmate.

==================================================
MAIN SCENE
==================================================

Show the unique characters together
in one warm celebratory final scene.

They are encouraging the student
after finishing the Lesson.

Use natural varied poses such as:
- smiling
- waving
- thumbs-up
- raised fists
- holding notebooks
- cheering together
- holding a banner

Do NOT line everybody up stiffly.

The scene should feel satisfying and energetic,
like finishing one Lesson successfully.

==================================================
BANNER
==================================================

The encouragement sentence MUST BE PART OF THE ARTWORK.

Create a large natural celebratory banner,
placard, hanging fabric sign,
or similar physical object integrated into the scene.

For example:
- characters holding a banner
- a festive banner hanging behind them
- a large school-festival style placard

Write ONLY this Korean sentence:

"${cheerText}"

VERY IMPORTANT:

- Korean spelling must be accurate.
- The full sentence must be visible.
- Letters must be large, bold, clear and readable.
- Do not cut off letters.
- Do not add extra Korean or English words.
- No speech bubbles.
- No captions.
- No fake logos.

The banner must feel naturally integrated
into the illustration.

==================================================
COMPOSITION
==================================================

LANDSCAPE format.

UPPER AREA:
large celebratory banner containing the Korean sentence.

MIDDLE:
the unique Lesson characters cheering naturally together.

BOTTOM:
leave a calm, uncluttered area
for the official SUMMIT EDU logo
which will be composited afterward.

Do not place faces
or important objects
inside the bottom logo area.

==================================================
STYLE
==================================================

- modern Korean educational webtoon
- warm
- clean
- polished
- expressive
- natural proportions
- visually engaging
- suitable for middle-school students
- not childish
- not preschool style
- professional workbook finish
- simple attractive background
- no photorealism

==================================================
FINAL CHECK
==================================================

Before generating, verify:

1. Use only the deduplicated unique character list.
2. Each unique character appears once.
3. No duplicated people.
4. No clones.
5. No extra random students.
6. Total visible people approximately matches ${uniqueCharacters.length}.
7. Adults look adult.
8. Students look like teenagers.
9. Male and female classmates look like same-age peers.
10. Banner sentence is readable.
11. No fake logo.
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
      throw new Error(
        "뒷표지 이미지가 생성되지 않았습니다."
      );
    }

    const aiImageBuffer =
      Buffer.from(
        imageBase64,
        "base64"
      );

    // 공식 SUMMIT EDU 로고는 AI에게 만들게 하지 않고
    // 실제 로고 파일을 마지막에 합성
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

    return Response.json({
      image: `data:image/png;base64,${finalImage.toString(
        "base64"
      )}`,
      cheerText,
      uniqueCharacterCount:
        uniqueCharacters.length,
    });
  } catch (error: any) {
    console.error(
      "GENERATE BACK COVER ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "뒷표지 생성 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}