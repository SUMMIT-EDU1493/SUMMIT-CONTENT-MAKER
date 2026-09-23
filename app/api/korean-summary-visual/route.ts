import OpenAI from "openai";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

import { createTrackedOpenAI } from "@/lib/tracked-openai";

export const maxDuration = 300;
export const runtime = "nodejs";

// KOREAN_SUMMARY_FINAL_BRAND_LAYOUT_V2

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

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) % 1000003;
  }
  return Math.abs(hash);
}

function decideLayoutType(body: VisualRequest) {
  const comparisonRows = Array.isArray(body.comparisonRows)
    ? body.comparisonRows
    : [];
  const flowCount = Array.isArray(body.flow) ? body.flow.length : 0;
  const conceptCount = Array.isArray(body.concepts) ? body.concepts.length : 0;
  const hint = cleanText(body.visualPrompt, 240).toLowerCase();

  if (comparisonRows.length > 0) return "comparison";
  if (/원인|결과|영향|인과|문제|해결/.test(hint)) return "cause-effect";
  if (/과정|흐름|단계|변화|전개|순서/.test(hint) || flowCount >= 5) return "process";
  if (/사례|장면|실험|예시|상황/.test(hint)) return "example";
  if (conceptCount >= 4) return "concept-network";
  return "concept";
}

function toDataUri(buffer: Buffer) {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const body: VisualRequest = await request.json();

    const title = cleanText(body.title, 24);
    const oneLine = cleanText(body.oneLine, 40);
    const caution = cleanText(body.caution, 32);
    const visualIdea = cleanText(body.visualPrompt, 180);

    const flow = Array.isArray(body.flow)
      ? body.flow.slice(0, 5).map((item, index) => ({
          number: index + 1,
          label: cleanText(item?.label, 8),
          content: cleanText(item?.content, 18),
        }))
      : [];

    const concepts = Array.isArray(body.concepts)
      ? body.concepts.slice(0, 5).map((item) => ({
          name: cleanText(item?.name, 10),
          description: cleanText(item?.description, 18),
        }))
      : [];

    const comparisonHeaders = Array.isArray(body.comparisonHeaders)
      ? body.comparisonHeaders.slice(0, 3).map((item) => cleanText(item, 12))
      : [];

    const comparisonRows = Array.isArray(body.comparisonRows)
      ? body.comparisonRows.slice(0, 4).map((row) =>
          Array.isArray(row)
            ? row.slice(0, 3).map((cell) => cleanText(cell, 14))
            : []
        )
      : [];

    const testPoints = Array.isArray(body.testPoints)
      ? body.testPoints.slice(0, 3).map((item) => cleanText(item, 20))
      : [];

    const layoutType = decideLayoutType(body);
    const variantSeed = hashString([title, oneLine, visualIdea].join('|'));

    const variants: Record<string, string[]> = {
      comparison: [
        "editorial split-board with two unequal visual zones",
        "notebook-spread comparison with a strong center contrast",
        "comparison collage with two large illustrated anchors",
      ],
      process: [
        "curving visual journey across the page",
        "horizontal timeline with large illustrated milestones",
        "staggered step path with arrows and scene changes",
      ],
      "cause-effect": [
        "cause-mechanism-result chain with strong directional movement",
        "branching cause map converging into one result",
        "problem-to-impact visual story with arrows and grouped notes",
      ],
      example: [
        "case-study scene board with one large scene and surrounding notes",
        "two-scene example collage with callouts",
        "illustrated case notebook with evidence pinned around the scene",
      ],
      "concept-network": [
        "central concept hub with asymmetric branches",
        "clustered mind-map with varied note sizes",
        "concept constellation with one dominant visual anchor",
      ],
      concept: [
        "mixed editorial study-note layout",
        "large central metaphor illustration with scattered compact notes",
        "asymmetric concept board with varied paper-note shapes",
      ],
    };

    const candidates = variants[layoutType] || variants.concept;
    const layoutVariant = candidates[variantSeed % candidates.length];

    const leftName = comparisonHeaders[1] || "A";
    const rightName = comparisonHeaders[2] || "B";

    const flowGuide = flow.length
      ? flow.map((item) => `${item.number}. ${item.label} - ${item.content}`).join("\n")
      : "핵심 흐름은 짧게 3~4개만";

    const conceptGuide = concepts.length
      ? concepts.map((item) => `${item.name} - ${item.description}`).join("\n")
      : "핵심 개념은 꼭 필요한 것만";

    const comparisonGuide = comparisonRows.length
      ? comparisonRows.map((row) => `${row[0] || ""} | ${row[1] || ""} | ${row[2] || ""}`).join("\n")
      : "";

    const testGuide = testPoints.length
      ? testPoints.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "핵심 시험 포인트 2~3개";

    const layoutSpecific =
      layoutType === "comparison"
        ? `Make the contrast between "${leftName}" and "${rightName}" instantly visible.`
        : layoutType === "process"
          ? "The viewer should visually follow the sequence without reading every note."
          : layoutType === "cause-effect"
            ? "The direction from cause to mechanism to result must be unmistakable."
            : layoutType === "example"
              ? "Use the example scene as the visual anchor instead of a generic diagram."
              : layoutType === "concept-network"
                ? "Show relationships among concepts spatially, not as a simple list."
                : "Choose the most natural visual metaphor for the passage.";

    const openai = createTrackedOpenAI(
      { apiKey },
      {
        route: "/api/korean-summary-visual",
        feature: "국어 요약 시각자료",
      }
    );

    const prompt = `
Create ONE finished LANDSCAPE Korean visual summary page for a high-school study booklet.

DESIGN LANGUAGE
- warm ivory / clean notebook-paper background
- polished Korean study-note aesthetic
- black hand-drawn lines
- soft mint, yellow, peach, blue accents
- highlighter strokes, tape, memo paper, arrows, tiny doodles
- mature high-school level, never childish
- clean, printable, visually memorable

MOST IMPORTANT: LAYOUT DIVERSITY
This page must NOT follow a fixed reusable template.
Do NOT automatically place 핵심 흐름 on the left, a big illustration in the center, and 시험 POINT / 기억하자 on the right every time.
Do NOT create the same sidebar + center + sticky-note composition used on other pages.

For THIS page, use this composition family:
${layoutType}

Preferred visual variant:
${layoutVariant}

${layoutSpecific}

The page should feel designed around THIS passage, not content poured into a pre-made frame.
Use asymmetric balance when helpful.
Vary box shapes, note positions, visual scale, and reading direction naturally.

BRAND SAFE ZONE
The official SUMMIT VISUAL LAB logo will be overlaid later by software.
Reserve a small calm zone ONLY in the extreme upper-left corner, approximately x=35..275 px and y=25..135 px.
Do not place title, subtitle, icon, doodle, box, or important illustration inside that small area.
Do not draw a placeholder or fake logo there.
Use the rest of the top area normally; do not leave a large empty top band.

CONTENT
Main title: "${title}"
One-line core: "${oneLine}"
Visual idea: "${visualIdea}"

Flow notes:
${flowGuide}

Concept notes:
${conceptGuide}

Comparison data:
${comparisonGuide || "No explicit comparison table needed."}

Test points:
${testGuide}

Memory caution:
"${caution}"

TEXT RULES
- Korean must be legible and short.
- No long paragraphs.
- Do not invent facts.
- Do not repeat the same idea in several boxes.
- Prefer 5~16 Korean characters per small phrase.
- If crowded, remove decoration and secondary notes before shrinking text.

SECTION FLEXIBILITY
The page may contain labels such as VISUAL SUMMARY, 핵심 흐름, 핵심 개념, 시험 POINT, 기억하자!, but they do NOT all need to appear in the same positions or same shapes.
Use only the most useful labels naturally.
A section can be integrated into the diagram rather than boxed separately.

ABSOLUTE NO
- no rigid repeated 3-column infographic
- no identical box grid repeated from page to page
- no fake SUMMIT logo
- no watermark
- no SUMMIT EDU text
- no giant decorative header that wastes space
- no tiny unreadable Korean text

Final output: ONE landscape 1536x1024 visual summary page image.
`;

    const result = await openai.images.generate({
      model: "gpt-image-2",
      prompt,
      size: "1536x1024",
      quality: "medium",
      n: 1,
    });

    const imageBase64 = result.data?.[0]?.b64_json;
    if (!imageBase64) {
      throw new Error("생성된 비주얼 요약 이미지를 받지 못했습니다.");
    }

    const generatedImage = Buffer.from(imageBase64, "base64");

    const logoPath = path.join(
      process.cwd(),
      "public",
      "brand",
      "summit-visual-lab-horizontal.png"
    );

    const logoFile = await fs.readFile(logoPath);
    const logoBuffer = await sharp(logoFile)
      .trim()
      .resize({ width: 210, withoutEnlargement: true })
      .png()
      .toBuffer();

    const finalImage = await sharp(generatedImage)
      .resize({ width: 1536, height: 1024, fit: "cover" })
      .composite([
        {
          input: logoBuffer,
          left: 55,
          top: 45,
        },
      ])
      .png()
      .toBuffer();

    return Response.json({
      imageUrl: toDataUri(finalImage),
    });
  } catch (error: any) {
    console.error("KOREAN VISUAL SUMMARY ERROR:", error);

    return Response.json(
      {
        error: "국어 비주얼 요약 생성 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          error?.error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}
