import OpenAI from "openai";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import TextToSVG from "text-to-svg";

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

const W = 1536;
const H = 1024;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(
  text: string,
  maxChars: number
) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return [];

  const lines: string[] = [];
  let line = "";

  for (const word of clean.split(" ")) {
    const next = line
      ? `${line} ${word}`
      : word;

    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);

  return lines;
}

function makeTextSvg(
  textToSVG: any,
  text: string,
  options: {
    width: number;
    fontSize: number;
    color?: string;
    maxChars?: number;
    lineHeight?: number;
    weight?: "bold" | "regular";
  }
) {
  const {
    width,
    fontSize,
    color = "#263238",
    maxChars = 24,
    lineHeight = Math.round(fontSize * 1.45),
  } = options;

  const lines = wrapText(text, maxChars);

  const height = Math.max(
    lineHeight,
    lines.length * lineHeight + 8
  );

  const paths = lines
    .map((line, index) => {
      const svg = textToSVG.getSVG(line, {
        x: 0,
        y: index * lineHeight,
        fontSize,
        anchor: "top",
        attributes: {
          fill: color,
        },
      });

      return svg
        .replace(/^<svg[^>]*>/, "")
        .replace(/<\/svg>$/, "");
    })
    .join("");

  return Buffer.from(`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${width}"
      height="${height}"
    >
      ${paths}
    </svg>
  `);
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "OPENAI_API_KEY가 설정되어 있지 않습니다.",
        },
        { status: 500 }
      );
    }

    const body: VisualRequest =
      await req.json();

    const title =
      body.title?.trim() || "국어 비주얼 요약";

    const oneLine =
      body.oneLine?.trim() || "";

    const visualPrompt =
      body.visualPrompt?.trim() || "";

    const flow = Array.isArray(body.flow)
      ? body.flow.slice(0, 6)
      : [];

    const concepts = Array.isArray(
      body.concepts
    )
      ? body.concepts.slice(0, 5)
      : [];

    const testPoints = Array.isArray(
      body.testPoints
    )
      ? body.testPoints.slice(0, 4)
      : [];

    const caution =
      body.caution?.trim() || "";

    const openai = new OpenAI({
      apiKey,
    });

    /*
     * AI에게는 글자를 절대 맡기지 않는다.
     * 영어 요약집과 같은 '노트 페이지 + 삽화'만 생성.
     */
    const illustrationPrompt = `
Create a polished landscape educational study-note page.

REFERENCE STYLE:
A Korean high-school visual summary workbook page.
It should look like a warm handmade scrapbook / study notebook.

FORMAT:
- landscape 3:2-ish educational page
- cream ivory paper background
- subtle notebook paper texture
- slightly worn paper edges
- small masking tapes
- paper clips
- hand-drawn stars
- pencil / colored-pencil illustration feeling
- soft pastel sticky notes
- blue, yellow, pink, lavender accent papers
- sophisticated high-school study material
- NOT childish
- NOT corporate infographic
- NOT a modern website UI
- NOT glossy
- NOT 3D

LAYOUT:
- large torn notebook-paper title area across the upper center
- left side reserved mostly for a numbered study-flow list
- right side contains the MAIN educational illustration / visual explanation
- one or two small sticky notes near corners
- lower area has room for short study-point boxes
- composition should resemble a carefully decorated handwritten exam-summary notebook

VERY IMPORTANT:
- DO NOT write any Korean
- DO NOT write any English
- DO NOT write any letters or numbers
- DO NOT create readable labels
- leave title paper and text areas visually blank
- text will be added later by software
- illustration itself must communicate the concept visually

MAIN LEARNING CONCEPT:
${visualPrompt}

Create useful educational visuals based ONLY on that concept.
If the concept compares two things, show a clear left-vs-right visual comparison.
If it explains cause and effect, use visual arrows and sequence.
If it explains a process, make the process visually understandable.
`;

    const imageResult =
      await openai.images.generate({
        model: "gpt-image-2",
        prompt: illustrationPrompt,
        size: "1536x1024",
        quality: "medium",
      });

    const imageData =
      imageResult.data?.[0];

    if (!imageData?.b64_json) {
      throw new Error(
        "비주얼 배경 이미지가 생성되지 않았습니다."
      );
    }

    const backgroundBuffer =
      Buffer.from(
        imageData.b64_json,
        "base64"
      );

    const fontPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "NotoSansKR-Bold.ttf"
    );

    await fs.access(fontPath);

    const textToSVG =
      TextToSVG.loadSync(fontPath);

    const composites: any[] = [];

    /*
     * 제목
     */
    composites.push({
      input: makeTextSvg(
        textToSVG,
        title,
        {
          width: 900,
          fontSize: 56,
          color: "#171717",
          maxChars: 26,
          lineHeight: 68,
        }
      ),
      left: 330,
      top: 70,
    });

    /*
     * 노란 형광펜 한 줄 핵심
     */
    composites.push({
      input: Buffer.from(`
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="850"
          height="76"
        >
          <rect
            x="0"
            y="7"
            width="850"
            height="58"
            rx="8"
            fill="#F8E58C"
            fill-opacity="0.88"
          />
        </svg>
      `),
      left: 345,
      top: 160,
    });

    composites.push({
      input: makeTextSvg(
        textToSVG,
        oneLine,
        {
          width: 820,
          fontSize: 29,
          color: "#292524",
          maxChars: 34,
          lineHeight: 39,
        }
      ),
      left: 368,
      top: 174,
    });

    /*
     * 왼쪽 핵심 흐름 라벨
     */
    composites.push({
      input: Buffer.from(`
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="200"
          height="58"
        >
          <rect
            width="190"
            height="50"
            rx="4"
            fill="#B8D8E5"
          />
        </svg>
      `),
      left: 72,
      top: 260,
    });

    composites.push({
      input: makeTextSvg(
        textToSVG,
        "핵심 흐름",
        {
          width: 170,
          fontSize: 28,
          color: "#263238",
          maxChars: 8,
        }
      ),
      left: 92,
      top: 267,
    });

    /*
     * 핵심 흐름 1~6
     */
    let flowY = 332;

    flow.forEach(
      (item, index) => {
        const label =
          item.label?.trim() || "";

        const content =
          item.content?.trim() || "";

        composites.push({
          input: Buffer.from(`
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="52"
              height="52"
            >
              <circle
                cx="26"
                cy="26"
                r="24"
                fill="#4E85A3"
              />
              <text
                x="26"
                y="34"
                text-anchor="middle"
                font-family="Arial"
                font-size="24"
                font-weight="700"
                fill="white"
              >
                ${index + 1}
              </text>
            </svg>
          `),
          left: 72,
          top: flowY,
        });

        if (label) {
          composites.push({
            input: makeTextSvg(
              textToSVG,
              label,
              {
                width: 370,
                fontSize: 23,
                color: "#24647B",
                maxChars: 17,
                lineHeight: 30,
              }
            ),
            left: 140,
            top: flowY,
          });
        }

        composites.push({
          input: makeTextSvg(
            textToSVG,
            content,
            {
              width: 410,
              fontSize: 20,
              color: "#333333",
              maxChars: 26,
              lineHeight: 29,
            }
          ),
          left: 140,
          top: flowY + 31,
        });

        flowY += 103;
      }
    );

    /*
     * 오른쪽 상단 - 기억하자 포스트잇
     */
    if (caution) {
      composites.push({
        input: Buffer.from(`
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="300"
            height="180"
          >
            <rect
              x="4"
              y="4"
              width="292"
              height="170"
              rx="3"
              fill="#F6DADA"
              fill-opacity="0.94"
            />
          </svg>
        `),
        left: 1190,
        top: 54,
      });

      composites.push({
        input: makeTextSvg(
          textToSVG,
          "기억하자!",
          {
            width: 250,
            fontSize: 24,
            color: "#374151",
            maxChars: 10,
          }
        ),
        left: 1218,
        top: 79,
      });

      composites.push({
        input: makeTextSvg(
          textToSVG,
          caution,
          {
            width: 245,
            fontSize: 18,
            color: "#374151",
            maxChars: 18,
            lineHeight: 27,
          }
        ),
        left: 1218,
        top: 119,
      });
    }

    /*
     * 핵심 개념 박스
     */
    if (concepts.length > 0) {
      composites.push({
        input: Buffer.from(`
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="600"
            height="56"
          >
            <rect
              width="200"
              height="48"
              rx="4"
              fill="#D8D0E8"
            />
          </svg>
        `),
        left: 865,
        top: 676,
      });

      composites.push({
        input: makeTextSvg(
          textToSVG,
          "핵심 개념",
          {
            width: 170,
            fontSize: 25,
            color: "#40384F",
            maxChars: 8,
          }
        ),
        left: 884,
        top: 684,
      });

      let conceptY = 746;

      concepts
        .slice(0, 4)
        .forEach((concept) => {
          const name =
            concept.name?.trim() || "";

          const description =
            concept.description?.trim() ||
            "";

          composites.push({
            input: makeTextSvg(
              textToSVG,
              `✓ ${name}`,
              {
                width: 250,
                fontSize: 19,
                color: "#5B4F78",
                maxChars: 16,
              }
            ),
            left: 866,
            top: conceptY,
          });

          composites.push({
            input: makeTextSvg(
              textToSVG,
              description,
              {
                width: 350,
                fontSize: 16,
                color: "#4B5563",
                maxChars: 27,
                lineHeight: 23,
              }
            ),
            left: 1085,
            top: conceptY,
          });

          conceptY += 61;
        });
    }

    /*
     * 하단 시험 POINT
     */
    if (testPoints.length > 0) {
      composites.push({
        input: Buffer.from(`
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="720"
            height="130"
          >
            <rect
              x="0"
              y="0"
              width="720"
              height="125"
              rx="7"
              fill="#F5EBCB"
              fill-opacity="0.93"
            />
          </svg>
        `),
        left: 64,
        top: 860,
      });

      composites.push({
        input: makeTextSvg(
          textToSVG,
          "시험 POINT",
          {
            width: 170,
            fontSize: 22,
            color: "#6B5B2B",
            maxChars: 10,
          }
        ),
        left: 88,
        top: 878,
      });

      const pointText =
        testPoints
          .slice(0, 3)
          .map(
            (point, i) =>
              `${i + 1}. ${point}`
          )
          .join("   ");

      composites.push({
        input: makeTextSvg(
          textToSVG,
          pointText,
          {
            width: 645,
            fontSize: 17,
            color: "#374151",
            maxChars: 46,
            lineHeight: 25,
          }
        ),
        left: 90,
        top: 916,
      });
    }

    /*
     * 최종 이미지 합성
     */
    const finalImage = await sharp(
      backgroundBuffer
    )
      .resize(W, H, {
        fit: "cover",
      })
      .composite(composites)
      .png()
      .toBuffer();

    return Response.json({
      imageUrl: `data:image/png;base64,${finalImage.toString(
        "base64"
      )}`,
    });
  } catch (error: any) {
    console.error(
      "KOREAN SUMMARY VISUAL ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "국어 비주얼 요약 생성 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}