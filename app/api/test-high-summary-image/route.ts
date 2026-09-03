import OpenAI from "openai";

export const runtime = "nodejs";

type RequestBody = {
  page?: {
    englishTitle?: string;
    koreanTitle?: string;
    oneLineSummary?: string;
    keyPoints?: string[];
    keyWords?: string[];
    visualType?: string;
    visualIdea?: string;
  };
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되어 있지 않아." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as RequestBody;
    const page = body.page;

    if (!page) {
      return Response.json(
        { error: "요약 페이지 계획이 없어." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
Create ONE landscape visual summary page for a Korean high-school English study booklet.

This is NOT a comic page.

GOAL:
A student should understand the passage structure in a few seconds before an exam.

==================================================
CONTENT
==================================================

English title:
${page.englishTitle || ""}

Korean title:
${page.koreanTitle || ""}

One-line core summary:
${page.oneLineSummary || ""}

Key points:
${(page.keyPoints || [])
  .map((v, i) => `${i + 1}. ${v}`)
  .join("\n")}

Key vocabulary:
${(page.keyWords || [])
  .map((v) => `- ${v}`)
  .join("\n")}

Visual type:
${page.visualType || "CONCEPT"}

Visual idea:
${page.visualIdea || ""}

==================================================
VISUAL STYLE
==================================================

- landscape 1536x1024
- warm ivory or clean white notebook-paper background
- modern Korean study-note aesthetic
- black hand-drawn lines
- soft mint accents
- yellow highlighter accents
- small doodles, arrows, sticky notes, boxes, underlines
- polished but slightly hand-made
- clean and easy to scan
- visually interesting without becoming decorative
- suitable for printing
- mature high-school level
- no childish style
- no chibi style

==================================================
LAYOUT RULE
==================================================

Use the visualType to choose the layout.

FLOW:
show clear left-to-right or top-to-bottom flow.

COMPARE:
use a strong A vs B split layout.

CAUSE_EFFECT:
show cause → process → result.

TIMELINE:
use a chronological sequence.

CONCEPT:
use one central idea with surrounding supporting notes.

PERSON_STORY:
use one simplified person-focused visual plus key notes.

PROCESS:
show numbered stages or arrows.

Do NOT force every page into the same layout.

==================================================
TEXT RULES
==================================================

- Korean text must be legible.
- Keep wording short.
- Do not invent new facts.
- Do not add random English phrases.
- Do not add long paragraphs.
- Highlight important words.
- Key vocabulary should appear naturally as:
  한국어 뜻(English)

==================================================
IMPORTANT
==================================================

Do NOT draw or invent a SUMMIT logo.
Leave clean empty space near the upper-left area so the official logo can be composited later.

Do NOT create a full-page dark background.

Do NOT make it look like a presentation slide.

Do NOT make it look like a children's worksheet.
`;

    const imageResponse = await openai.images.generate({
      model: "gpt-image-2",
      size: "1536x1024",
      quality: "medium",
      n: 1,
      prompt,
    });

    const imageData =
      imageResponse.data?.[0]?.b64_json;

    if (!imageData) {
      throw new Error("요약집 이미지 데이터가 없습니다.");
    }

    return Response.json({
      image: `data:image/png;base64,${imageData}`,
    });
  } catch (error: any) {
    console.error(
      "HIGH SUMMARY IMAGE TEST ERROR:",
      error
    );

    return Response.json(
      {
        error: "고등 요약집 이미지 테스트 중 오류가 생겼어.",
        detail: error?.message || "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}