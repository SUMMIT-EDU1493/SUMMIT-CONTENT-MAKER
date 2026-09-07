import OpenAI from "openai";

export const maxDuration = 300;

type FlowItem = {
  label?: string;
  content?: string;
};

type ConceptItem = {
  name?: string;
  description?: string;
};

type VisualRequest = {
  title?: string;
  oneLine?: string;
  visualPrompt?: string;
  flow?: FlowItem[];
  concepts?: ConceptItem[];
  comparisonTitle?: string;
  comparisonHeaders?: string[];
  comparisonRows?: string[][];
  testPoints?: string[];
  caution?: string;
};

function cleanText(value: unknown, max = 100) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function decideLayoutType(body: VisualRequest) {
  const hasComparison =
    Array.isArray(body.comparisonRows) &&
    body.comparisonRows.length > 0;

  const flowCount = Array.isArray(body.flow)
    ? body.flow.length
    : 0;

  const visualPrompt = cleanText(
    body.visualPrompt,
    200
  ).toLowerCase();

  if (hasComparison) {
    return "comparison";
  }

  if (
    visualPrompt.includes("과정") ||
    visualPrompt.includes("흐름") ||
    visualPrompt.includes("단계") ||
    visualPrompt.includes("변화") ||
    flowCount >= 4
  ) {
    return "process";
  }

  if (
    visualPrompt.includes("원인") ||
    visualPrompt.includes("결과") ||
    visualPrompt.includes("영향") ||
    visualPrompt.includes("인과")
  ) {
    return "cause-effect";
  }

  return "concept";
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error: "OPENAI_API_KEY가 설정되어 있지 않습니다.",
        },
        { status: 500 }
      );
    }

    const body: VisualRequest =
      await request.json();

    const title = cleanText(body.title, 24);
    const oneLine = cleanText(body.oneLine, 40);
    const caution = cleanText(body.caution, 32);
    const visualIdea = cleanText(
      body.visualPrompt,
      180
    );

    const flow = Array.isArray(body.flow)
      ? body.flow.slice(0, 5).map((item, index) => ({
          number: index + 1,
          label: cleanText(item?.label, 8),
          content: cleanText(item?.content, 18),
        }))
      : [];

    const concepts = Array.isArray(body.concepts)
      ? body.concepts
          .slice(0, 5)
          .map((item) => ({
            name: cleanText(item?.name, 10),
            description: cleanText(
              item?.description,
              18
            ),
          }))
      : [];

    const comparisonHeaders = Array.isArray(
      body.comparisonHeaders
    )
      ? body.comparisonHeaders
          .slice(0, 3)
          .map((item) => cleanText(item, 12))
      : [];

    const comparisonRows = Array.isArray(
      body.comparisonRows
    )
      ? body.comparisonRows
          .slice(0, 4)
          .map((row) =>
            Array.isArray(row)
              ? row
                  .slice(0, 3)
                  .map((cell) =>
                    cleanText(cell, 14)
                  )
              : []
          )
      : [];

    const testPoints = Array.isArray(
      body.testPoints
    )
      ? body.testPoints
          .slice(0, 3)
          .map((item) => cleanText(item, 20))
      : [];

    const layoutType =
      decideLayoutType(body);

    const leftName =
      comparisonHeaders[1] || "";
    const rightName =
      comparisonHeaders[2] || "";

    const flowGuide = flow.length
      ? flow
          .map(
            (item) =>
              `${item.number}. ${item.label} - ${item.content}`
          )
          .join("\n")
      : "1. 핵심 개념 파악 - 요지 이해\n2. 구조 확인 - 비교/과정/원인결과\n3. 핵심어 정리 - 개념 연결";

    const conceptGuide = concepts.length
      ? concepts
          .map(
            (item) =>
              `${item.name} - ${item.description}`
          )
          .join("\n")
      : "핵심 개념 - 중요한 용어를 짧게 정리";

    const comparisonGuide = comparisonRows.length
      ? comparisonRows
          .map(
            (row) =>
              `${row[0] || ""} | ${row[1] || ""} | ${row[2] || ""}`
          )
          .join("\n")
      : "";

    const testGuide = testPoints.length
      ? testPoints
          .map(
            (item, index) =>
              `${index + 1}. ${item}`
          )
          .join("\n")
      : "1. 핵심 차이 파악\n2. 중심 개념 비교\n3. 논지 흐름 정리";

    const layoutInstructionMap = {
      comparison: `
This passage is COMPARISON-based.
Make the page composition similar to a premium English visual summary sheet:
- left side: short numbered flow / 핵심 흐름
- center: BIG visual comparison area
- two main sides clearly distinguished
- small captions around the visual
- comparison notes integrated naturally
- not a strict table, but a visual comparison note page

Main contrast:
LEFT = "${leftName}"
RIGHT = "${rightName}"
`,
      process: `
This passage is PROCESS/FLOW-based.
Make the page composition like an English-style visual summary sheet:
- left side: numbered 핵심 흐름
- center/right: large flowing process diagram
- use arrows, steps, transitions, visual movement
- compact handwritten notes around the main process
- the process illustration must dominate the page
`,
      "cause-effect": `
This passage is CAUSE-EFFECT based.
Make the page composition like an English-style visual summary sheet:
- left side: short numbered 흐름
- center: strong cause -> mechanism -> result visual chain
- use arrows and visual relationships
- notes placed around the mechanism
- overall composition should feel like a high-quality English summary worksheet
`,
      concept: `
This passage is CONCEPT-based.
Make the page composition like an English-style visual summary sheet:
- left side: short numbered 흐름
- center: one large core concept illustration
- around it: small compact concept notes
- use little paper notes, arrows, small labels
- overall look should feel like a premium English summary page
`,
    } as const;

    const layoutInstruction =
      layoutInstructionMap[
        layoutType as keyof typeof layoutInstructionMap
      ] || layoutInstructionMap.concept;

    const openai = new OpenAI({
      apiKey,
    });

    const prompt = `
Create ONE finished LANDSCAPE Korean visual summary page.

This page must follow the SAME DESIGN LANGUAGE as a premium English summary workbook page:
- horizontal 1-page layout
- cream / ivory paper background
- scrapbook / study-note feeling
- pastel highlighter strokes
- taped paper title
- small doodles
- soft hand-drawn note aesthetic
- compact handwritten Korean-style typography
- visually polished and cute, but suitable for high-school students
- educational but stylish
- clean, breathable layout

VERY IMPORTANT:
Do NOT use the old Korean template.
Do NOT make a rigid 3-column infographic.
Do NOT fill the page with long paragraphs.
Do NOT make dense dashboard boxes.
Do NOT overlap text and illustrations.

The final result should look much closer to the English summary sample style:
- one large central visual explanation
- left-side short numbered summary flow
- short note fragments
- compact concept tags
- highlighted one-line summary
- irregular but balanced editorial composition

No logo.
No watermark.
No SUMMIT EDU text.

========================
TEXT CONTENT
========================

Main title:
"${title}"

One-line summary:
"${oneLine}"

Main visual idea:
"${visualIdea}"

핵심 흐름:
${flowGuide}

핵심 개념:
${conceptGuide}

비교 정보:
${comparisonGuide || "비교형 정보 없음"}

시험 포인트:
${testGuide}

기억하자:
"${caution}"

========================
LAYOUT RULE
========================

${layoutInstruction}

========================
TEXT STYLE RULE
========================

All Korean text must be SHORT and COMPACT.

Do not expand the supplied text into long explanations.
Do not create paragraphs.
Use short Korean phrases only.

Examples of good text length:
- 6~16 characters per phrase
- 1 short sentence maximum per small note
- very compact captions

If the page feels crowded:
1. reduce decoration first
2. shorten note count
3. keep the main illustration and title readable

Never shrink text into tiny unreadable text.

========================
REQUIRED SECTIONS
========================

Include these sections naturally:
1. small label: "VISUAL SUMMARY"
2. small subtitle: "그림으로 한눈에 이해하기"
3. main title
4. highlighted one-line summary
5. "핵심 흐름" with 3~5 short numbered items
6. one large central visual explanation
7. small "핵심 개념" notes
8. small "시험 POINT" memo
9. small "기억하자!" sticky note

========================
VISUAL FEEL
========================

The result should feel like:
- a polished teacher-made English summary sheet
- a visual note page
- a study scrapbook
- a compact A4 landscape explanation page

The main illustration should dominate the page.
Text should support the visual.

Korean should render cleanly and legibly.
Use a soft, friendly, rounded handwritten note style.
Avoid stiff textbook-looking typography.

Final output: ONE landscape visual summary page image.
`;

    const result =
      await openai.images.generate({
        model: "gpt-image-2",
        prompt,
        size: "1536x1024",
        quality: "medium",
        n: 1,
      });

    const imageBase64 =
      result.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error(
        "생성된 비주얼 요약 이미지를 받지 못했습니다."
      );
    }

    return Response.json({
      imageUrl: `data:image/png;base64,${imageBase64}`,
    });
  } catch (error: any) {
    console.error(
      "KOREAN VISUAL SUMMARY ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "국어 비주얼 요약 생성 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          error?.error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}