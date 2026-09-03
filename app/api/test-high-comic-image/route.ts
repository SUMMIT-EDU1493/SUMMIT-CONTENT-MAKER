import OpenAI from "openai";
import sharp from "sharp";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
Create ONE polished landscape 4-panel webtoon page for Korean high-school students.

IMPORTANT:
This is NOT a children's educational comic.
It should feel like a stylish modern webtoon / Instagram comic first,
and educational content second.

==================================================
FORMAT
==================================================

- exactly 4 panels
- 2x2 grid
- landscape composition
- clean panel borders
- no outer title
- no footer
- no logo
- no vocabulary box
- all text must be inside speech bubbles or natural in-scene text only

==================================================
OVERALL ART DIRECTION
==================================================

Target audience:
Korean high-school students, approximately ages 16–18.

Visual style:
- modern Korean webtoon
- polished digital illustration
- expressive but not childish
- slightly cinematic
- stylish lighting
- appealing character design
- mature teenage proportions
- natural body proportions
- no chibi
- no elementary-school appearance
- no preschool proportions
- not overly cute
- not like a textbook illustration

The comic should grab attention immediately.

It may include:
- strong facial reactions
- comedic exaggeration
- dynamic camera angles
- cinematic close-ups
- dramatic perspective
- visual jokes
- trendy poses
- energetic action

But:
- do not make it chaotic
- do not make characters look like adults in their late 20s or 30s
- they should look like older teenagers

==================================================
CHARACTER DESIGN
==================================================

Two Korean high-school students.

Student A:
- male
- around 17 years old
- dark slightly messy hair
- casual school-uniform styling
- expressive face
- confident, slightly playful personality

Student B:
- female
- around 17 years old
- shoulder-length dark hair
- casual school-uniform styling
- expressive and witty
- confident, not childlike

They should look clearly the same age range.

Do NOT make the female student dramatically smaller or younger-looking.

Keep both characters visually consistent across all 4 panels.

==================================================
SPEECH BUBBLE STYLE
==================================================

This is extremely important.

- Korean speech bubbles
- bold, highly readable Korean text
- noticeably thicker font weight than a typical educational worksheet
- clean webtoon lettering
- text should feel punchy
- avoid thin font
- avoid tiny text
- avoid long dense paragraphs
- natural spacing inside bubbles

Dialogue tone:
- modern Korean teen speech
- slightly MZ-style
- witty
- conversational
- some comic timing
- not forced slang
- not too childish
- not like a teacher explaining a lesson

Key English vocabulary can appear naturally in parentheses after Korean meaning.

==================================================
STORY TOPIC
==================================================

Theme:
"What is the driving force behind people who accomplish seemingly impossible things?"

This page introduces the main idea before meeting two remarkable people.

==================================================
PANEL 1
==================================================

Scene:
School hallway or study lounge.
Student A is staring at a phone showing impressive people:
an athlete, innovator, and activist.

Camera:
Over-the-shoulder angle with phone in foreground.

Student A says:
"아니 근데 이런 사람들 보면 진짜 궁금하지 않냐?"

Student B says:
"뭐가 저렇게까지 움직이게 하는 건데?"

Include naturally:
원동력(driving force)

Make this panel visually lively, not static.

==================================================
PANEL 2
==================================================

Scene:
Comedic exaggerated imagination sequence.

Show quick symbolic imagery:
- inventor surrounded by failed prototypes
- athlete exhausted but still training
- activist standing firmly despite pressure

Student A reacts dramatically.

Student A says:
"실패 몇 번 하고도 또 도전한다고?"

Student B says:
"난 한 번 삐끗하면 바로 멘탈 로그아웃인데ㅋㅋ"

Include naturally:
시행착오(trials and errors)

Use energetic composition and humor.

==================================================
PANEL 3
==================================================

Scene:
More serious cinematic shift.

The two students look at a large wall image / screen showing people pushing beyond limits.

Student B says:
"근데 결국 자기 한계를 넘는 사람들은 뭔가 다르긴 해."

Student A says:
"맞아. 자기 안에 불을 붙이는(ignite) 뭔가가 있는 느낌."

Make this panel visually dramatic and cool.

==================================================
PANEL 4
==================================================

Scene:
The two students walk toward a bright doorway or screen that hints at meeting two new people next.

Student A says:
"오케이. 그래서 그 비밀이 뭔데?"

Student B says:
"직접 두 명 만나보면 답 나오겠지."

Small reaction text:
"레전드 등장 예정"

The ending should feel like a teaser for the next comic page.

==================================================
FINAL CHECK
==================================================

Before generating, verify:

1. exactly 4 panels
2. 2x2 grid
3. high-school age appearance
4. mature teenage proportions
5. no childish/chibi look
6. same character appearance across panels
7. Korean dialogue is readable
8. bold speech-bubble lettering
9. modern witty tone
10. comic timing is visible
11. at least 3 panels use different framing or camera angles
12. not textbook-like
13. no duplicate/cloned characters in the same panel
14. no extra random students
15. all dialogue stays close to the supplied Korean wording
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
      throw new Error("이미지 데이터가 없습니다.");
    }

    const comicBuffer = Buffer.from(imageData, "base64");

    const resizedComic = await sharp(comicBuffer)
      .resize({
        width: 1536,
        height: 1024,
        fit: "cover",
      })
      .png()
      .toBuffer();

    return new Response(resizedComic, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("TEST HIGH COMIC IMAGE ERROR:", error);

    return Response.json(
      {
        error: "고등 이미지 테스트 생성 중 오류가 발생했습니다.",
        detail: error?.message || "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}