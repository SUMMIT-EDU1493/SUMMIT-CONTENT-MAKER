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

const C = {
  bg: "#FFFDF6",
  ink: "#17213B",
  text: "#374151",

  blue: "#CDEAF8",
  blue2: "#6CB7DB",

  mint: "#D9F1E6",
  mint2: "#69B79D",

  yellow: "#FCE9A8",
  yellow2: "#E8B844",

  pink: "#F8D9E1",
  pink2: "#E58EA6",

  purple: "#E7DDF4",

  border: "#D9D4C8",
};

function wrapText(
  text: string,
  maxChars: number,
  maxLines = 99
) {
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

      if (lines.length >= maxLines) {
        break;
      }
    }

    current += ch;
  }

  if (
    current.trim() &&
    lines.length < maxLines
  ) {
    lines.push(current.trim());
  }

  if (
    clean.length >
    maxChars * maxLines
  ) {
    const last =
      lines.length - 1;

    if (last >= 0) {
      lines[last] =
        lines[last].slice(
          0,
          Math.max(
            0,
            maxChars - 1
          )
        ) + "…";
    }
  }

  return lines;
}

function makeText(
  font: any,
  text: string,
  {
    width,
    fontSize,
    color = C.text,
    maxChars = 20,
    maxLines = 3,
    lineHeight = Math.round(
      fontSize * 1.35
    ),
  }: {
    width: number;
    fontSize: number;
    color?: string;
    maxChars?: number;
    maxLines?: number;
    lineHeight?: number;
  }
) {
  const lines = wrapText(
    text,
    maxChars,
    maxLines
  );

  const height = Math.max(
    lineHeight,
    lines.length * lineHeight + 4
  );

  const paths = lines
    .map((line, i) => {
      const svg =
        font.getSVG(line, {
          x: 0,
          y: i * lineHeight,
          fontSize,
          anchor: "top",
          attributes: {
            fill: color,
          },
        });

      return svg
        .replace(
          /^<svg[^>]*>/,
          ""
        )
        .replace(
          /<\/svg>$/,
          ""
        );
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

function box(
  width: number,
  height: number,
  fill: string,
  stroke = "none",
  radius = 24
) {
  return Buffer.from(`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${width}"
      height="${height}"
    >
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

function circleNumber(
  number: number,
  color: string
) {
  return Buffer.from(`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="58"
      height="58"
    >
      <circle
        cx="29"
        cy="29"
        r="27"
        fill="${color}"
      />
      <text
        x="29"
        y="38"
        text-anchor="middle"
        font-family="Arial"
        font-size="26"
        font-weight="700"
        fill="white"
      >
        ${number}
      </text>
    </svg>
  `);
}

export async function POST(
  req: Request
) {
  try {
    const apiKey =
      process.env.OPENAI_API_KEY;

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
      body.title?.trim() ||
      "국어 비주얼 요약";

    const oneLine =
      body.oneLine?.trim() || "";

    const visualPrompt =
      body.visualPrompt?.trim() ||
      "";

    const flow =
      Array.isArray(body.flow)
        ? body.flow.slice(0, 5)
        : [];

    const concepts =
      Array.isArray(
        body.concepts
      )
        ? body.concepts.slice(0, 5)
        : [];

    const headers =
      Array.isArray(
        body.comparisonHeaders
      )
        ? body.comparisonHeaders
        : [];

    const rows =
      Array.isArray(
        body.comparisonRows
      )
        ? body.comparisonRows.slice(
            0,
            4
          )
        : [];

    const testPoints =
      Array.isArray(
        body.testPoints
      )
        ? body.testPoints.slice(0, 3)
        : [];

    const caution =
      body.caution?.trim() || "";

    const openai =
      new OpenAI({
        apiKey,
      });

    // =========================================
    // AI는 오직 중앙 삽화만 제작
    // =========================================

    const imageResult =
      await openai.images.generate({
        model: "gpt-image-2",

        size: "1536x1024",

        quality: "medium",

        prompt: `
Create ONE compact educational illustration.

STYLE:
- Korean high school workbook
- warm hand-drawn illustration
- colored pencil / soft watercolor
- clean pastel palette
- friendly but not childish
- simple educational icons
- white background

IMPORTANT:
- no Korean text
- no English text
- no labels
- no captions
- no numbers
- no speech bubbles

The illustration will fit inside a fixed comparison panel.

Learning concept:
${visualPrompt}

If two ideas are compared,
show them visually as LEFT vs RIGHT.

Keep the composition simple.
Do not fill every empty space.
`,
      });

    const base64 =
      imageResult.data?.[0]
        ?.b64_json;

    if (!base64) {
      throw new Error(
        "삽화 생성 실패"
      );
    }

    const illustration =
      await sharp(
        Buffer.from(
          base64,
          "base64"
        )
      )
        .resize(710, 320, {
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

    // =========================================
    // FONT
    // =========================================

    const bodyFontPath =
      path.join(
        process.cwd(),
        "public/fonts/NotoSansKR-Bold.ttf"
      );

    const titleFontPath =
      path.join(
        process.cwd(),
        "public/fonts/Gaegu-Bold.ttf"
      );

    await Promise.all([
      fs.access(bodyFontPath),
      fs.access(titleFontPath),
    ]);

    const bodyFont =
      TextToSVG.loadSync(
        bodyFontPath
      );

    const titleFont =
      TextToSVG.loadSync(
        titleFontPath
      );

    const layers: any[] = [];

    // =========================================
    // BACKGROUND
    // =========================================

    layers.push({
      input: Buffer.from(`
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="${W}"
          height="${H}"
        >
          <rect
            width="${W}"
            height="${H}"
            fill="${C.bg}"
          />

          <rect
            x="16"
            y="16"
            width="${W - 32}"
            height="${H - 32}"
            rx="32"
            fill="none"
            stroke="${C.border}"
            stroke-width="3"
          />

          <path
            d="M395 120 C670 105 980 116 1160 105"
            stroke="#F4D65D"
            stroke-width="28"
            stroke-linecap="round"
            opacity=".45"
          />
        </svg>
      `),
      left: 0,
      top: 0,
    });

    // =========================================
    // TOP
    // =========================================

    layers.push({
      input: makeText(
        titleFont,
        title,
        {
          width: 900,
          fontSize: 66,
          color: C.ink,
          maxChars: 22,
          maxLines: 1,
        }
      ),
      left: 405,
      top: 38,
    });

    layers.push({
      input: makeText(
        titleFont,
        oneLine,
        {
          width: 1000,
          fontSize: 29,
          color: C.ink,
          maxChars: 40,
          maxLines: 2,
          lineHeight: 35,
        }
      ),
      left: 355,
      top: 135,
    });

    // =========================================
    // LEFT : 핵심 흐름
    // =========================================

    layers.push({
      input: box(
        282,
        770,
        "#FCFCF8",
        "#BFD8CD",
        25
      ),
      left: 30,
      top: 210,
    });

    layers.push({
      input: box(
        210,
        65,
        C.blue,
        "none",
        13
      ),
      left: 62,
      top: 228,
    });

    layers.push({
      input: makeText(
        titleFont,
        "핵심 흐름",
        {
          width: 190,
          fontSize: 38,
          color: C.ink,
          maxChars: 6,
          maxLines: 1,
        }
      ),
      left: 84,
      top: 237,
    });

    const flowColors = [
      "#64B89A",
      "#66A8D7",
      "#F0C14D",
      "#E88EA7",
      "#8173BF",
    ];

    const flowStart = 325;
    const flowGap = 128;

    flow.forEach(
      (item, i) => {
        const y =
          flowStart +
          i * flowGap;

        layers.push({
          input: circleNumber(
            i + 1,
            flowColors[i]
          ),
          left: 48,
          top: y,
        });

        layers.push({
          input: makeText(
            titleFont,
            item.label || "",
            {
              width: 185,
              fontSize: 28,
              color: C.ink,
              maxChars: 8,
              maxLines: 1,
            }
          ),
          left: 118,
          top: y + 3,
        });

        layers.push({
          input: makeText(
            bodyFont,
            item.content || "",
            {
              width: 170,
              fontSize: 16,
              color: C.text,
              maxChars: 13,
              maxLines: 3,
              lineHeight: 23,
            }
          ),
          left: 118,
          top: y + 43,
        });
      }
    );

    // =========================================
    // CENTER : 핵심 비교
    // =========================================

    layers.push({
      input: box(
        790,
        550,
        "#FFFFFF",
        "#C6DAD4",
        26
      ),
      left: 330,
      top: 210,
    });

    layers.push({
      input: box(
        240,
        64,
        C.mint,
        "none",
        16
      ),
      left: 365,
      top: 230,
    });

    layers.push({
      input: makeText(
        titleFont,
        "핵심 비교",
        {
          width: 215,
          fontSize: 39,
          color: C.ink,
          maxChars: 6,
          maxLines: 1,
        }
      ),
      left: 390,
      top: 238,
    });

    // Illustration ONLY here
    layers.push({
      input: illustration,
      left: 370,
      top: 305,
    });

    const leftTitle =
      headers[1] ||
      "A";

    const rightTitle =
      headers[2] ||
      "B";

    // 두 비교 제목
    layers.push({
      input: box(
        320,
        56,
        "#F8DADA",
        "none",
        12
      ),
      left: 350,
      top: 575,
    });

    layers.push({
      input: box(
        320,
        56,
        "#D9EDF8",
        "none",
        12
      ),
      left: 780,
      top: 575,
    });

    layers.push({
      input: makeText(
        titleFont,
        leftTitle,
        {
          width: 285,
          fontSize: 31,
          color: C.ink,
          maxChars: 12,
          maxLines: 1,
        }
      ),
      left: 380,
      top: 586,
    });

    layers.push({
      input: makeText(
        titleFont,
        rightTitle,
        {
          width: 285,
          fontSize: 31,
          color: C.ink,
          maxChars: 12,
          maxLines: 1,
        }
      ),
      left: 810,
      top: 586,
    });

    // 비교 핵심 최대 4개
    let rowY = 650;

    rows.forEach(
      (row) => {
        const label =
          row[0] || "";

        const left =
          row[1] || "";

        const right =
          row[2] || "";

        layers.push({
          input: makeText(
            titleFont,
            label,
            {
              width: 90,
              fontSize: 19,
              color:
                C.yellow2,
              maxChars: 6,
              maxLines: 1,
            }
          ),
          left: 698,
          top: rowY,
        });

        layers.push({
          input: makeText(
            bodyFont,
            left,
            {
              width: 270,
              fontSize: 15,
              color: C.text,
              maxChars: 16,
              maxLines: 2,
              lineHeight: 21,
            }
          ),
          left: 365,
          top: rowY,
        });

        layers.push({
          input: makeText(
            bodyFont,
            right,
            {
              width: 270,
              fontSize: 15,
              color: C.text,
              maxChars: 16,
              maxLines: 2,
              lineHeight: 21,
            }
          ),
          left: 815,
          top: rowY,
        });

        rowY += 49;
      }
    );

    // =========================================
    // RIGHT TOP : 기억하자
    // =========================================

    layers.push({
      input: box(
        350,
        550,
        "#FFFDFC",
        "#807971",
        23
      ),
      left: 1145,
      top: 210,
    });

    layers.push({
      input: box(
        245,
        66,
        C.pink,
        "none",
        10
      ),
      left: 1195,
      top: 235,
    });

    layers.push({
      input: makeText(
        titleFont,
        "기억하자!",
        {
          width: 220,
          fontSize: 38,
          color: C.ink,
          maxChars: 7,
          maxLines: 1,
        }
      ),
      left: 1223,
      top: 243,
    });

    layers.push({
      input: makeText(
        bodyFont,
        caution,
        {
          width: 270,
          fontSize: 19,
          color: C.text,
          maxChars: 16,
          maxLines: 7,
          lineHeight: 30,
        }
      ),
      left: 1184,
      top: 330,
    });

    // =========================================
    // BOTTOM CENTER : 핵심 개념
    // =========================================

    layers.push({
      input: box(
        790,
        195,
        "#FEFEFA",
        "#BBD6C7",
        22
      ),
      left: 330,
      top: 785,
    });

    layers.push({
      input: makeText(
        titleFont,
        "핵심 개념",
        {
          width: 190,
          fontSize: 34,
          color: C.ink,
          maxChars: 6,
          maxLines: 1,
        }
      ),
      left: 372,
      top: 801,
    });

    let conceptX = 355;

    concepts.forEach(
      (concept, i) => {
        const colors = [
          "#D4EFE4",
          "#D9ECF8",
          "#FBE7A9",
          "#F5D7E0",
          "#E5DCF3",
        ];

        layers.push({
          input: box(
            138,
            44,
            colors[i],
            "none",
            16
          ),
          left: conceptX,
          top: 850,
        });

        layers.push({
          input: makeText(
            titleFont,
            concept.name || "",
            {
              width: 122,
              fontSize: 20,
              color: C.ink,
              maxChars: 7,
              maxLines: 1,
            }
          ),
          left: conceptX + 10,
          top: 856,
        });

        layers.push({
          input: makeText(
            bodyFont,
            concept.description ||
              "",
            {
              width: 130,
              fontSize: 13,
              color: C.text,
              maxChars: 10,
              maxLines: 3,
              lineHeight: 18,
            }
          ),
          left: conceptX + 4,
          top: 908,
        });

        conceptX += 148;
      }
    );

    // =========================================
    // RIGHT BOTTOM : 시험 POINT
    // =========================================

    layers.push({
      input: box(
        350,
        195,
        "#FFF9F7",
        "#E5D1C9",
        22
      ),
      left: 1145,
      top: 785,
    });

    layers.push({
      input: makeText(
        titleFont,
        "시험 POINT",
        {
          width: 230,
          fontSize: 34,
          color: C.ink,
          maxChars: 9,
          maxLines: 1,
        }
      ),
      left: 1185,
      top: 801,
    });

    let pointY = 850;

    testPoints.forEach(
      (point, i) => {
        layers.push({
          input: circleNumber(
            i + 1,
            [
              "#63A7D3",
              "#EDB94D",
              "#E189A0",
            ][i]
          ),
          left: 1175,
          top: pointY,
        });

        layers.push({
          input: makeText(
            bodyFont,
            point,
            {
              width: 240,
              fontSize: 15,
              color: C.text,
              maxChars: 17,
              maxLines: 2,
              lineHeight: 21,
            }
          ),
          left: 1238,
          top: pointY + 7,
        });

        pointY += 47;
      }
    );

    // =========================================
    // FINAL
    // =========================================

    const finalImage =
      await sharp({
        create: {
          width: W,
          height: H,
          channels: 4,

          background: {
            r: 255,
            g: 253,
            b: 246,
            alpha: 1,
          },
        },
      })
        .composite(layers)
        .png()
        .toBuffer();

    return Response.json({
      imageUrl:
        `data:image/png;base64,` +
        finalImage.toString(
          "base64"
        ),
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
      {
        status: 500,
      }
    );
  }
}