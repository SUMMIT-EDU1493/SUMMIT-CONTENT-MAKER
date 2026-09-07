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

const COLORS = {
  ink: "#17223B",
  body: "#374151",
  cream: "#FFFDF7",
  blue: "#BFE3F5",
  blueDark: "#2D7EA3",
  green: "#CDEFD9",
  greenDark: "#37866B",
  yellow: "#FCE68D",
  yellowDark: "#9A7220",
  pink: "#F8D4DF",
  pinkDark: "#A95470",
  lavender: "#DED4F1",
  line: "#D6D3C9",
};

function esc(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wrapKorean(text: string, maxChars: number) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return [];

  const lines: string[] = [];
  let current = "";

  for (const ch of clean) {
    if (current.length >= maxChars) {
      lines.push(current.trim());
      current = "";
    }

    current += ch;
  }

  if (current.trim()) {
    lines.push(current.trim());
  }

  return lines;
}

function textSvg(
  font: any,
  text: string,
  options: {
    width: number;
    fontSize: number;
    color?: string;
    maxChars?: number;
    lineHeight?: number;
  }
) {
  const {
    width,
    fontSize,
    color = COLORS.body,
    maxChars = 24,
    lineHeight = Math.round(fontSize * 1.42),
  } = options;

  const lines = wrapKorean(text, maxChars);

  const height = Math.max(
    lineHeight,
    lines.length * lineHeight + 8
  );

  const body = lines
    .map((line, index) => {
      const raw = font.getSVG(line, {
        x: 0,
        y: index * lineHeight,
        fontSize,
        anchor: "top",
        attributes: {
          fill: color,
        },
      });

      return raw
        .replace(/^<svg[^>]*>/, "")
        .replace(/<\/svg>$/, "");
    })
    .join("");

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg"
      width="${width}"
      height="${height}">
      ${body}
    </svg>
  `);
}

function svgBox(
  width: number,
  height: number,
  fill: string,
  stroke = "none",
  radius = 22
) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg"
      width="${width}"
      height="${height}">
      <rect
        x="2"
        y="2"
        width="${width - 4}"
        height="${height - 4}"
        rx="${radius}"
        fill="${fill}"
        stroke="${stroke}"
        stroke-width="3"
      />
    </svg>
  `);
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const body: VisualRequest = await req.json();

    const title =
      body.title?.trim() || "국어 비주얼 요약";

    const oneLine =
      body.oneLine?.trim() || "";

    const visualPrompt =
      body.visualPrompt?.trim() || "";

    const flow =
      Array.isArray(body.flow)
        ? body.flow.slice(0, 5)
        : [];

    const concepts =
      Array.isArray(body.concepts)
        ? body.concepts.slice(0, 6)
        : [];

    const comparisonHeaders =
      Array.isArray(body.comparisonHeaders)
        ? body.comparisonHeaders
        : [];

    const comparisonRows =
      Array.isArray(body.comparisonRows)
        ? body.comparisonRows.slice(0, 4)
        : [];

    const testPoints =
      Array.isArray(body.testPoints)
        ? body.testPoints.slice(0, 3)
        : [];

    const caution =
      body.caution?.trim() || "";

    const openai = new OpenAI({ apiKey });

    // ======================================================
    // 1. 삽화만 생성
    // ======================================================

    const illustrationPrompt = `
Create ONE clean educational illustration for a Korean high-school visual study guide.

STYLE:
- warm hand-drawn Korean workbook illustration
- soft colored-pencil / watercolor feeling
- simple friendly characters and icons
- clean white or transparent-looking background
- pastel colors
- sophisticated enough for high-school students
- similar to a handmade study-note infographic
- no photorealism
- no 3D
- no glossy corporate infographic

VERY IMPORTANT:
- NO Korean text
- NO English text
- NO numbers
- NO captions
- NO labels
- NO speech bubbles with text
- illustration only

The image will be placed inside a fixed educational worksheet layout.

LEARNING IDEA:
${visualPrompt}

If the passage compares two ideas, visually show them as two sides.
If it explains cause and effect, show the relationship clearly.
If it explains a process, show a simple visual sequence.
`;

    const imageResult =
      await openai.images.generate({
        model: "gpt-image-2",
        prompt: illustrationPrompt,
        size: "1536x1024",
        quality: "medium",
      });

    const b64 =
      imageResult.data?.[0]?.b64_json;

    if (!b64) {
      throw new Error(
        "삽화가 생성되지 않았습니다."
      );
    }

    const illustration =
      await sharp(
        Buffer.from(b64, "base64")
      )
        .resize(700, 380, {
          fit: "contain",
          background: {
            r: 255,
            g: 255,
            b: 255,
            alpha: 0,
          },
        })
        .png()
        .toBuffer();

    // ======================================================
    // 2. 폰트
    // ======================================================

    const bodyFontPath = path.join(
      process.cwd(),
      "public/fonts/NotoSansKR-Bold.ttf"
    );

    const titleFontPath = path.join(
      process.cwd(),
      "public/fonts/Gaegu-Bold.ttf"
    );

    await Promise.all([
      fs.access(bodyFontPath),
      fs.access(titleFontPath),
    ]);

    const bodyFont =
      TextToSVG.loadSync(bodyFontPath);

    const titleFont =
      TextToSVG.loadSync(titleFontPath);

    const layers: any[] = [];

    // ======================================================
    // 3. 전체 배경
    // ======================================================

    const bg = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg"
        width="${W}"
        height="${H}">

        <rect
          width="100%"
          height="100%"
          fill="${COLORS.cream}"
        />

        <rect
          x="16"
          y="16"
          width="${W - 32}"
          height="${H - 32}"
          rx="30"
          fill="none"
          stroke="#CFC8B8"
          stroke-width="3"
        />

        <path
          d="M380 122
             C620 105 880 118 1140 110"
          stroke="#F2C94C"
          stroke-width="24"
          stroke-linecap="round"
          opacity=".48"
        />

        <path
          d="M380 166
             C620 158 870 168 1135 160"
          stroke="#F8E58C"
          stroke-width="18"
          stroke-linecap="round"
          opacity=".75"
        />
      </svg>
    `);

    layers.push({
      input: bg,
      left: 0,
      top: 0,
    });

    // ======================================================
    // 4. 제목
    // ======================================================

    layers.push({
      input: textSvg(
        titleFont,
        title,
        {
          width: 900,
          fontSize: 65,
          color: COLORS.ink,
          maxChars: 24,
          lineHeight: 70,
        }
      ),
      left: 385,
      top: 42,
    });

    layers.push({
      input: textSvg(
        titleFont,
        oneLine,
        {
          width: 900,
          fontSize: 29,
          color: "#292524",
          maxChars: 38,
          lineHeight: 36,
        }
      ),
      left: 390,
      top: 135,
    });

    // ======================================================
    // 5. 왼쪽 핵심 흐름
    // ======================================================

    layers.push({
      input: svgBox(
        285,
        750,
        "#F8FBF8",
        "#BFD4C5",
        24
      ),
      left: 32,
      top: 220,
    });

    layers.push({
      input: svgBox(
        200,
        62,
        COLORS.blue,
        "none",
        10
      ),
      left: 70,
      top: 238,
    });

    layers.push({
      input: textSvg(
        titleFont,
        "핵심 흐름",
        {
          width: 180,
          fontSize: 37,
          color: COLORS.ink,
          maxChars: 8,
        }
      ),
      left: 92,
      top: 245,
    });

    let flowY = 325;

    flow.forEach((item, index) => {
      const circleColor = [
        "#64B59A",
        "#66A7D5",
        "#F3C34E",
        "#E78FA7",
        "#9B8AC8",
      ][index % 5];

      layers.push({
        input: Buffer.from(`
          <svg xmlns="http://www.w3.org/2000/svg"
            width="54"
            height="54">
            <circle
              cx="27"
              cy="27"
              r="25"
              fill="${circleColor}"
            />
            <text
              x="27"
              y="36"
              text-anchor="middle"
              font-family="Arial"
              font-size="25"
              font-weight="700"
              fill="white">
              ${index + 1}
            </text>
          </svg>
        `),
        left: 54,
        top: flowY,
      });

      layers.push({
        input: textSvg(
          titleFont,
          item.label || "",
          {
            width: 190,
            fontSize: 27,
            color: COLORS.ink,
            maxChars: 10,
          }
        ),
        left: 118,
        top: flowY + 2,
      });

      layers.push({
        input: textSvg(
          bodyFont,
          item.content || "",
          {
            width: 175,
            fontSize: 16,
            color: COLORS.body,
            maxChars: 16,
            lineHeight: 24,
          }
        ),
        left: 118,
        top: flowY + 42,
      });

      flowY += 126;
    });

    // ======================================================
    // 6. 가운데 비교 영역
    // ======================================================

    const centerX = 335;
    const centerY = 225;
    const centerW = 800;
    const centerH = 545;

    layers.push({
      input: svgBox(
        centerW,
        centerH,
        "#FFFFFF",
        "#B9D6DF",
        26
      ),
      left: centerX,
      top: centerY,
    });

    let compareTitle =
      body.comparisonTitle?.trim();

    if (!compareTitle) {
      compareTitle =
        comparisonHeaders
          .slice(1)
          .join(" ↔ ") ||
        "핵심 비교";
    }

    layers.push({
      input: textSvg(
        titleFont,
        compareTitle,
        {
          width: 650,
          fontSize: 40,
          color: COLORS.ink,
          maxChars: 22,
        }
      ),
      left: 420,
      top: 242,
    });

    // AI 삽화는 여기 한 칸에만 들어간다.
    layers.push({
      input: illustration,
      left: 385,
      top: 315,
    });

    // ======================================================
    // 7. 비교표 / 장단점
    // ======================================================

    if (
      comparisonRows.length > 0 &&
      comparisonHeaders.length >= 3
    ) {
      const leftHeader =
        comparisonHeaders[1] || "";

      const rightHeader =
        comparisonHeaders[2] || "";

      layers.push({
        input: svgBox(
          345,
          58,
          "#DDF0FA",
          "none",
          10
        ),
        left: 355,
        top: 575,
      });

      layers.push({
        input: svgBox(
          345,
          58,
          "#E0F4E8",
          "none",
          10
        ),
        left: 770,
        top: 575,
      });

      layers.push({
        input: textSvg(
          titleFont,
          leftHeader,
          {
            width: 300,
            fontSize: 30,
            color: COLORS.ink,
            maxChars: 15,
          }
        ),
        left: 385,
        top: 586,
      });

      layers.push({
        input: textSvg(
          titleFont,
          rightHeader,
          {
            width: 300,
            fontSize: 30,
            color: COLORS.ink,
            maxChars: 15,
          }
        ),
        left: 800,
        top: 586,
      });

      let rowY = 650;

      comparisonRows
        .slice(0, 3)
        .forEach((row) => {
          const category = row[0] || "";
          const left = row[1] || "";
          const right = row[2] || "";

          layers.push({
            input: textSvg(
              titleFont,
              category,
              {
                width: 95,
                fontSize: 22,
                color: COLORS.yellowDark,
                maxChars: 7,
              }
            ),
            left: 680,
            top: rowY,
          });

          layers.push({
            input: textSvg(
              bodyFont,
              left,
              {
                width: 280,
                fontSize: 15,
                color: COLORS.body,
                maxChars: 20,
                lineHeight: 22,
              }
            ),
            left: 370,
            top: rowY,
          });

          layers.push({
            input: textSvg(
              bodyFont,
              right,
              {
                width: 280,
                fontSize: 15,
                color: COLORS.body,
                maxChars: 20,
                lineHeight: 22,
              }
            ),
            left: 810,
            top: rowY,
          });

          rowY += 55;
        });
    }

    // ======================================================
    // 8. 오른쪽 기억하자
    // ======================================================

    layers.push({
      input: svgBox(
        330,
        545,
        "#FFFDFC",
        "#66615A",
        20
      ),
      left: 1160,
      top: 220,
    });

    layers.push({
      input: svgBox(
        235,
        62,
        COLORS.pink,
        "none",
        6
      ),
      left: 1210,
      top: 240,
    });

    layers.push({
      input: textSvg(
        titleFont,
        "기억하자!",
        {
          width: 220,
          fontSize: 35,
          color: COLORS.ink,
          maxChars: 10,
        }
      ),
      left: 1230,
      top: 249,
    });

    if (caution) {
      layers.push({
        input: textSvg(
          bodyFont,
          caution,
          {
            width: 265,
            fontSize: 18,
            color: COLORS.body,
            maxChars: 18,
            lineHeight: 28,
          }
        ),
        left: 1190,
        top: 320,
      });
    }

    // ======================================================
    // 9. 핵심 개념
    // ======================================================

    layers.push({
      input: svgBox(
        800,
        175,
        "#FCFCF8",
        "#BCD5C7",
        18
      ),
      left: 335,
      top: 790,
    });

    layers.push({
      input: textSvg(
        titleFont,
        "핵심 개념",
        {
          width: 180,
          fontSize: 31,
          color: COLORS.ink,
          maxChars: 8,
        }
      ),
      left: 375,
      top: 807,
    });

    let conceptX = 370;

    concepts
      .slice(0, 5)
      .forEach((concept, index) => {
        const colors = [
          "#CBECDD",
          "#CFE9F8",
          "#FBE9A8",
          "#F6D6DF",
          "#DED7EF",
        ];

        layers.push({
          input: svgBox(
            130,
            44,
            colors[index],
            "none",
            16
          ),
          left: conceptX,
          top: 850,
        });

        layers.push({
          input: textSvg(
            titleFont,
            concept.name || "",
            {
              width: 120,
              fontSize: 21,
              color: COLORS.ink,
              maxChars: 7,
            }
          ),
          left: conceptX + 12,
          top: 856,
        });

        layers.push({
          input: textSvg(
            bodyFont,
            concept.description || "",
            {
              width: 135,
              fontSize: 13,
              color: COLORS.body,
              maxChars: 12,
              lineHeight: 19,
            }
          ),
          left: conceptX,
          top: 908,
        });

        conceptX += 145;
      });

    // ======================================================
    // 10. 시험 POINT
    // ======================================================

    layers.push({
      input: svgBox(
        330,
        175,
        "#FFF9F6",
        "#E7CFC5",
        18
      ),
      left: 1160,
      top: 790,
    });

    layers.push({
      input: textSvg(
        titleFont,
        "시험 POINT",
        {
          width: 220,
          fontSize: 32,
          color: COLORS.ink,
          maxChars: 10,
        }
      ),
      left: 1195,
      top: 808,
    });

    const pointText =
      testPoints
        .map(
          (point, index) =>
            `${index + 1}. ${point}`
        )
        .join(" ");

    layers.push({
      input: textSvg(
        bodyFont,
        pointText,
        {
          width: 270,
          fontSize: 15,
          color: COLORS.body,
          maxChars: 21,
          lineHeight: 22,
        }
      ),
      left: 1190,
      top: 850,
    });

    const finalImage =
      await sharp({
        create: {
          width: W,
          height: H,
          channels: 4,
          background: {
            r: 255,
            g: 253,
            b: 247,
            alpha: 1,
          },
        },
      })
        .composite(layers)
        .png()
        .toBuffer();

    return Response.json({
      imageUrl: `data:image/png;base64,${finalImage.toString(
        "base64"
      )}`,
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
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}