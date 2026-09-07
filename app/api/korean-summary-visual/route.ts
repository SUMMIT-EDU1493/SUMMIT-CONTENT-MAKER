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

const COLOR = {
  background: "#FFFDF7",
  paper: "#FFFFFF",

  ink: "#17213B",
  text: "#404756",
  softText: "#687180",

  blue: "#D8EEF8",
  blueStrong: "#69AED2",

  mint: "#DDF2E8",
  mintStrong: "#65AF91",

  yellow: "#FCE9A4",
  yellowStrong: "#DFAF38",

  pink: "#F8DDE5",
  pinkStrong: "#DD849C",

  lavender: "#E7DEF3",
  lavenderStrong: "#8C7ABB",

  beige: "#F8F2E6",

  border: "#D9D5CA",
};

function compact(
  value: unknown,
  max: number
) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function wrapKorean(
  value: string,
  charsPerLine: number,
  maxLines: number
) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return [];

  const lines: string[] = [];
  let current = "";

  for (const char of text) {
    current += char;

    if (current.length >= charsPerLine) {
      lines.push(current.trim());
      current = "";

      if (lines.length >= maxLines) {
        break;
      }
    }
  }

  if (
    current.trim() &&
    lines.length < maxLines
  ) {
    lines.push(current.trim());
  }

  if (
    text.length >
      charsPerLine * maxLines &&
    lines.length > 0
  ) {
    const lastIndex =
      lines.length - 1;

    lines[lastIndex] =
      lines[lastIndex]
        .slice(
          0,
          Math.max(
            1,
            charsPerLine - 1
          )
        ) + "…";
  }

  return lines;
}

function createTextSvg(
  font: any,
  value: string,
  options: {
    width: number;
    fontSize: number;
    color?: string;
    charsPerLine?: number;
    maxLines?: number;
    lineHeight?: number;
  }
) {
  const {
    width,
    fontSize,
    color = COLOR.text,
    charsPerLine = 18,
    maxLines = 2,
    lineHeight = Math.round(
      fontSize * 1.35
    ),
  } = options;

  const lines = wrapKorean(
    value,
    charsPerLine,
    maxLines
  );

  const height = Math.max(
    lineHeight,
    lines.length * lineHeight + 4
  );

  const paths = lines
    .map((line, index) => {
      const svg =
        font.getSVG(line, {
          x: 0,
          y:
            index *
            lineHeight,
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

function roundedBox(
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

function numberCircle(
  number: number,
  fill: string,
  size = 48
) {
  const center =
    size / 2;

  return Buffer.from(`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${size}"
      height="${size}"
    >
      <circle
        cx="${center}"
        cy="${center}"
        r="${center - 2}"
        fill="${fill}"
      />

      <text
        x="${center}"
        y="${center + 8}"
        text-anchor="middle"
        font-family="Arial"
        font-size="${Math.round(
          size * 0.45
        )}"
        font-weight="700"
        fill="#FFFFFF"
      >
        ${number}
      </text>
    </svg>
  `);
}

function bulletDot(
  color: string
) {
  return Buffer.from(`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
    >
      <circle
        cx="9"
        cy="9"
        r="6"
        fill="${color}"
      />
    </svg>
  `);
}

export async function POST(
  request: Request
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
        {
          status: 500,
        }
      );
    }

    const body: VisualRequest =
      await request.json();

    /*
    =====================================================
    데이터 자체도 여기서 다시 압축
    =====================================================
    */

    const title = compact(
      body.title ||
        "국어 비주얼 요약",
      20
    );

    const oneLine = compact(
      body.oneLine,
      36
    );

    const visualPrompt =
      compact(
        body.visualPrompt,
        140
      );

    const flow = Array.isArray(
      body.flow
    )
      ? body.flow
          .slice(0, 5)
          .map((item) => ({
            label: compact(
              item?.label,
              6
            ),
            content: compact(
              item?.content,
              18
            ),
          }))
      : [];

    const concepts =
      Array.isArray(
        body.concepts
      )
        ? body.concepts
            .slice(0, 5)
            .map(
              (
                item
              ) => ({
                name: compact(
                  item?.name,
                  7
                ),
                description:
                  compact(
                    item?.description,
                    16
                  ),
              })
            )
        : [];

    const headers =
      Array.isArray(
        body.comparisonHeaders
      )
        ? body.comparisonHeaders
            .slice(0, 3)
            .map((item) =>
              compact(
                item,
                10
              )
            )
        : [];

    const rows =
      Array.isArray(
        body.comparisonRows
      )
        ? body.comparisonRows
            .slice(0, 4)
            .map((row) =>
              Array.isArray(
                row
              )
                ? row
                    .slice(
                      0,
                      3
                    )
                    .map(
                      (
                        item
                      ) =>
                        compact(
                          item,
                          14
                        )
                    )
                : []
            )
        : [];

    const testPoints =
      Array.isArray(
        body.testPoints
      )
        ? body.testPoints
            .slice(0, 3)
            .map((item) =>
              compact(
                item,
                20
              )
            )
        : [];

    const caution =
      compact(
        body.caution,
        36
      );

    /*
    =====================================================
    AI 삽화 생성

    여기서 절대 전체 페이지를 그리지 않음.
    중앙 비교 영역에 들어갈 그림만 생성.
    =====================================================
    */

    const openai =
      new OpenAI({
        apiKey,
      });

    const illustrationPrompt = `
Create ONE compact educational illustration
for a Korean high-school visual summary sheet.

STYLE:
- match a friendly English summary ZIP workbook style
- clean Korean educational illustration
- soft colored pencil feeling
- light watercolor feeling
- warm hand-drawn look
- pastel colors
- friendly but NOT childish
- simple flat composition
- clean white background
- lots of breathing room
- visually easy to understand
- cute small icons and people when appropriate

ABSOLUTELY IMPORTANT:
- illustration only
- NO Korean text
- NO English text
- NO words
- NO numbers
- NO captions
- NO labels
- NO title
- NO poster layout
- NO infographic text
- NO speech bubbles containing text
- NO full worksheet

The final app will place accurate Korean text
around this illustration separately.

LEARNING CONCEPT:
${visualPrompt}

If two concepts are compared:
- make a clear LEFT vs RIGHT visual comparison
- place one concept visually on the left
- place the other concept visually on the right
- use simple arrows or visual contrast

If it explains cause and effect:
- show one simple visual progression

If it explains a scientific principle:
- show the key mechanism visually

Keep the image SIMPLE.
Do not fill all empty space.
`;

    const imageResult =
      await openai.images.generate({
        model:
          "gpt-image-2",

        prompt:
          illustrationPrompt,

        size:
          "1536x1024",

        quality:
          "medium",
      });

    const imageBase64 =
      imageResult.data?.[0]
        ?.b64_json;

    if (!imageBase64) {
      throw new Error(
        "국어 요약 삽화 생성에 실패했습니다."
      );
    }

    const illustration =
      await sharp(
        Buffer.from(
          imageBase64,
          "base64"
        )
      )
        .resize(
          650,
          250,
          {
            fit: "contain",

            background: {
              r: 255,
              g: 255,
              b: 255,
              alpha: 0,
            },
          }
        )
        .png()
        .toBuffer();

    /*
    =====================================================
    FONT
    =====================================================
    */

    const bodyFontPath =
      path.join(
        process.cwd(),
        "public",
        "fonts",
        "NotoSansKR-Bold.ttf"
      );

    const titleFontPath =
      path.join(
        process.cwd(),
        "public",
        "fonts",
        "Gaegu-Bold.ttf"
      );

    await Promise.all([
      fs.access(
        bodyFontPath
      ),
      fs.access(
        titleFontPath
      ),
    ]);

    const bodyFont =
      TextToSVG.loadSync(
        bodyFontPath
      );

    const titleFont =
      TextToSVG.loadSync(
        titleFontPath
      );

    const layers: any[] =
      [];

    /*
    =====================================================
    PAPER BACKGROUND
    =====================================================
    */

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
            fill="${COLOR.background}"
          />

          <rect
            x="18"
            y="18"
            width="${W - 36}"
            height="${H - 36}"
            rx="32"
            fill="none"
            stroke="${COLOR.border}"
            stroke-width="3"
          />

          <!-- title highlighter -->

          <path
            d="
              M420 108
              C650 96 900 104 1160 96
            "
            stroke="#F5DA6B"
            stroke-width="30"
            stroke-linecap="round"
            opacity=".48"
          />

          <!-- little doodles -->

          <path
            d="
              M1280 82
              l10 24
              l24 10
              l-24 10
              l-10 24
              l-10 -24
              l-24 -10
              l24 -10
              z
            "
            fill="#F3C95A"
            opacity=".75"
          />

        </svg>
      `),

      left: 0,
      top: 0,
    });

    /*
    =====================================================
    TOP LEFT SMALL LABEL
    =====================================================
    */

    layers.push({
      input:
        createTextSvg(
          titleFont,
          "VISUAL SUMMARY",
          {
            width: 260,
            fontSize: 30,
            color:
              COLOR.mintStrong,
            charsPerLine: 20,
            maxLines: 1,
          }
        ),

      left: 55,
      top: 50,
    });

    layers.push({
      input:
        createTextSvg(
          titleFont,
          "그림으로 한눈에 이해하기",
          {
            width: 300,
            fontSize: 25,
            color:
              COLOR.ink,
            charsPerLine: 16,
            maxLines: 1,
          }
        ),

      left: 58,
      top: 92,
    });

    /*
    =====================================================
    TITLE
    =====================================================
    */

    layers.push({
      input:
        createTextSvg(
          titleFont,
          title,
          {
            width: 900,
            fontSize: 62,
            color:
              COLOR.ink,
            charsPerLine: 20,
            maxLines: 1,
          }
        ),

      left: 410,
      top: 42,
    });

    /*
    =====================================================
    ONE LINE SUMMARY

    제목과 카드 사이.
    딱 한두 줄.
    =====================================================
    */

    layers.push({
      input: roundedBox(
        850,
        68,
        "#FFF1B9",
        "none",
        15
      ),

      left: 390,
      top: 135,
    });

    layers.push({
      input:
        createTextSvg(
          titleFont,
          oneLine,
          {
            width: 800,
            fontSize: 27,
            color:
              COLOR.ink,
            charsPerLine: 30,
            maxLines: 2,
            lineHeight: 30,
          }
        ),

      left: 420,
      top: 151,
    });

    /*
    =====================================================
    LEFT COLUMN
    핵심 흐름
    =====================================================
    */

    const leftX = 45;
    const leftY = 225;
    const leftW = 280;
    const leftH = 735;

    layers.push({
      input: roundedBox(
        leftW,
        leftH,
        "#FCFCF8",
        "#C9DDD2",
        26
      ),

      left: leftX,
      top: leftY,
    });

    layers.push({
      input: roundedBox(
        190,
        58,
        COLOR.blue,
        "none",
        13
      ),

      left: 85,
      top: 242,
    });

    layers.push({
      input:
        createTextSvg(
          titleFont,
          "핵심 흐름",
          {
            width: 165,
            fontSize: 35,
            color:
              COLOR.ink,
            charsPerLine: 6,
            maxLines: 1,
          }
        ),

      left: 106,
      top: 250,
    });

    const flowColors = [
      COLOR.pinkStrong,
      COLOR.yellowStrong,
      COLOR.mintStrong,
      COLOR.lavenderStrong,
      COLOR.blueStrong,
    ];

    const flowStartY =
      335;

    const flowGap = 120;

    flow.forEach(
      (
        item,
        index
      ) => {
        const y =
          flowStartY +
          index *
            flowGap;

        layers.push({
          input:
            numberCircle(
              index + 1,
              flowColors[
                index %
                  flowColors.length
              ],
              46
            ),

          left: 68,
          top: y,
        });

        layers.push({
          input:
            createTextSvg(
              titleFont,
              item.label ||
                "",
              {
                width: 170,
                fontSize: 26,
                color:
                  COLOR.ink,
                charsPerLine: 7,
                maxLines: 1,
              }
            ),

          left: 128,
          top: y + 1,
        });

        layers.push({
          input:
            createTextSvg(
              bodyFont,
              item.content ||
                "",
              {
                width: 165,
                fontSize: 15,
                color:
                  COLOR.text,
                charsPerLine: 13,
                maxLines: 2,
                lineHeight: 21,
              }
            ),

          left: 128,
          top: y + 38,
        });

        /*
        작은 아래 화살표
        */

        if (
          index <
          flow.length - 1
        ) {
          layers.push({
            input:
              Buffer.from(`
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="38"
                >
                  <path
                    d="M14 0 L14 24"
                    stroke="#B9B7AE"
                    stroke-width="3"
                    stroke-linecap="round"
                  />

                  <path
                    d="M7 19 L14 28 L21 19"
                    fill="none"
                    stroke="#B9B7AE"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              `),

            left: 78,
            top: y + 65,
          });
        }
      }
    );

    /*
    =====================================================
    CENTER
    핵심 비교
    =====================================================
    */

    const centerX = 350;
    const centerY = 225;
    const centerW = 760;
    const centerH = 530;

    layers.push({
      input: roundedBox(
        centerW,
        centerH,
        "#FFFFFF",
        "#C7DCD3",
        26
      ),

      left: centerX,
      top: centerY,
    });

    layers.push({
      input: roundedBox(
        190,
        58,
        COLOR.mint,
        "none",
        13
      ),

      left: 385,
      top: 242,
    });

    layers.push({
      input:
        createTextSvg(
          titleFont,
          "핵심 비교",
          {
            width: 165,
            fontSize: 35,
            color:
              COLOR.ink,
            charsPerLine: 6,
            maxLines: 1,
          }
        ),

      left: 407,
      top: 250,
    });

    /*
    삽화는 위쪽 지정 영역에만.
    글자와 절대 겹치지 않음.
    */

    layers.push({
      input:
        illustration,

      left: 405,
      top: 305,
    });

    /*
    비교 A / B 제목
    */

    const leftHeader =
      headers[1] ||
      "A";

    const rightHeader =
      headers[2] ||
      "B";

    layers.push({
      input: roundedBox(
        300,
        52,
        COLOR.pink,
        "none",
        13
      ),

      left: 380,
      top: 550,
    });

    layers.push({
      input: roundedBox(
        300,
        52,
        COLOR.blue,
        "none",
        13
      ),

      left: 775,
      top: 550,
    });

    layers.push({
      input:
        createTextSvg(
          titleFont,
          leftHeader,
          {
            width: 275,
            fontSize: 29,
            color:
              COLOR.ink,
            charsPerLine: 11,
            maxLines: 1,
          }
        ),

      left: 405,
      top: 558,
    });

    layers.push({
      input:
        createTextSvg(
          titleFont,
          rightHeader,
          {
            width: 275,
            fontSize: 29,
            color:
              COLOR.ink,
            charsPerLine: 11,
            maxLines: 1,
          }
        ),

      left: 800,
      top: 558,
    });

    /*
    VS
    */

    layers.push({
      input:
        Buffer.from(`
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="70"
            height="70"
          >
            <circle
              cx="35"
              cy="35"
              r="32"
              fill="#FFF0B3"
            />

            <text
              x="35"
              y="44"
              text-anchor="middle"
              font-family="Arial"
              font-size="24"
              font-weight="700"
              fill="#6D5B25"
            >
              VS
            </text>
          </svg>
        `),

      left: 705,
      top: 542,
    });

    /*
    비교 row
    */

    let rowY = 625;

    rows.forEach(
      (
        row,
        index
      ) => {
        const category =
          compact(
            row?.[0],
            7
          );

        const left =
          compact(
            row?.[1],
            14
          );

        const right =
          compact(
            row?.[2],
            14
          );

        const rowBg =
          index % 2 === 0
            ? "#FAFAF7"
            : "#FFFFFF";

        layers.push({
          input:
            roundedBox(
              680,
              48,
              rowBg,
              "#ECE8DF",
              12
            ),

          left: 390,
          top: rowY,
        });

        layers.push({
          input:
            createTextSvg(
              titleFont,
              category,
              {
                width: 100,
                fontSize: 18,
                color:
                  COLOR.yellowStrong,
                charsPerLine: 7,
                maxLines: 1,
              }
            ),

          left: 682,
          top: rowY + 9,
        });

        layers.push({
          input:
            bulletDot(
              COLOR.pinkStrong
            ),

          left: 410,
          top: rowY + 15,
        });

        layers.push({
          input:
            createTextSvg(
              bodyFont,
              left,
              {
                width: 250,
                fontSize: 14,
                color:
                  COLOR.text,
                charsPerLine: 16,
                maxLines: 1,
              }
            ),

          left: 438,
          top: rowY + 8,
        });

        layers.push({
          input:
            bulletDot(
              COLOR.blueStrong
            ),

          left: 808,
          top: rowY + 15,
        });

        layers.push({
          input:
            createTextSvg(
              bodyFont,
              right,
              {
                width: 240,
                fontSize: 14,
                color:
                  COLOR.text,
                charsPerLine: 16,
                maxLines: 1,
              }
            ),

          left: 836,
          top: rowY + 8,
        });

        rowY += 52;
      }
    );

    /*
    =====================================================
    RIGHT
    기억하자
    =====================================================
    */

    const rightX = 1135;
    const rightY = 225;
    const rightW = 355;
    const rightH = 530;

    layers.push({
      input: roundedBox(
        rightW,
        rightH,
        "#FFFDFB",
        "#C9C3BA",
        26
      ),

      left: rightX,
      top: rightY,
    });

    layers.push({
      input: roundedBox(
        225,
        58,
        COLOR.pink,
        "none",
        10
      ),

      left: 1200,
      top: 242,
    });

    layers.push({
      input:
        createTextSvg(
          titleFont,
          "기억하자!",
          {
            width: 200,
            fontSize: 35,
            color:
              COLOR.ink,
            charsPerLine: 7,
            maxLines: 1,
          }
        ),

      left: 1225,
      top: 250,
    });

    /*
    caution 하나만 크게 넣되
    최대 3줄.
    */

    layers.push({
      input:
        createTextSvg(
          bodyFont,
          caution,
          {
            width: 275,
            fontSize: 18,
            color:
              COLOR.text,
            charsPerLine: 17,
            maxLines: 3,
            lineHeight: 27,
          }
        ),

      left: 1180,
      top: 340,
    });

    /*
    작은 메모 장식
    */

    layers.push({
      input:
        Buffer.from(`
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="210"
            height="135"
          >
            <rect
              x="5"
              y="5"
              width="200"
              height="125"
              rx="10"
              fill="#FFF1B8"
              opacity=".78"
            />

            <path
              d="M25 80
                 C55 55 80 95 110 65
                 C135 45 155 72 180 45"
              fill="none"
              stroke="#D5B84E"
              stroke-width="4"
              stroke-linecap="round"
            />
          </svg>
        `),

      left: 1200,
      top: 535,
    });

    layers.push({
      input:
        createTextSvg(
          titleFont,
          "핵심만 기억!",
          {
            width: 180,
            fontSize: 26,
            color:
              "#715E27",
            charsPerLine: 8,
            maxLines: 1,
          }
        ),

      left: 1227,
      top: 562,
    });

    /*
    =====================================================
    BOTTOM LEFT + CENTER
    핵심 개념
    =====================================================
    */

    const conceptX = 350;
    const conceptY = 785;
    const conceptW = 760;
    const conceptH = 190;

    layers.push({
      input: roundedBox(
        conceptW,
        conceptH,
        "#FFFEFA",
        "#C6DACE",
        22
      ),

      left: conceptX,
      top: conceptY,
    });

    layers.push({
      input:
        createTextSvg(
          titleFont,
          "핵심 개념",
          {
            width: 190,
            fontSize: 32,
            color:
              COLOR.ink,
            charsPerLine: 6,
            maxLines: 1,
          }
        ),

      left: 385,
      top: 802,
    });

    const conceptColors = [
      COLOR.mint,
      COLOR.blue,
      COLOR.yellow,
      COLOR.pink,
      COLOR.lavender,
    ];

    concepts.forEach(
      (
        item,
        index
      ) => {
        const cardX =
          370 +
          index * 145;

        layers.push({
          input:
            roundedBox(
              130,
              48,
              conceptColors[
                index %
                  conceptColors.length
              ],
              "none",
              18
            ),

          left: cardX,
          top: 850,
        });

        layers.push({
          input:
            createTextSvg(
              titleFont,
              item.name ||
                "",
              {
                width: 118,
                fontSize: 20,
                color:
                  COLOR.ink,
                charsPerLine: 7,
                maxLines: 1,
              }
            ),

          left:
            cardX + 10,
          top: 858,
        });

        layers.push({
          input:
            createTextSvg(
              bodyFont,
              item.description ||
                "",
              {
                width: 125,
                fontSize: 13,
                color:
                  COLOR.softText,
                charsPerLine: 10,
                maxLines: 2,
                lineHeight: 18,
              }
            ),

          left:
            cardX + 4,
          top: 912,
        });
      }
    );

    /*
    =====================================================
    BOTTOM RIGHT
    시험 POINT
    =====================================================
    */

    const testX = 1135;
    const testY = 785;
    const testW = 355;
    const testH = 190;

    layers.push({
      input: roundedBox(
        testW,
        testH,
        "#FFF9F6",
        "#E7D1C8",
        22
      ),

      left: testX,
      top: testY,
    });

    layers.push({
      input:
        createTextSvg(
          titleFont,
          "시험 POINT",
          {
            width: 220,
            fontSize: 32,
            color:
              COLOR.ink,
            charsPerLine: 10,
            maxLines: 1,
          }
        ),

      left: 1180,
      top: 802,
    });

    let testPointY =
      850;

    testPoints.forEach(
      (
        point,
        index
      ) => {
        const colors = [
          COLOR.blueStrong,
          COLOR.yellowStrong,
          COLOR.pinkStrong,
        ];

        layers.push({
          input:
            numberCircle(
              index + 1,
              colors[index],
              36
            ),

          left: 1170,
          top: testPointY,
        });

        layers.push({
          input:
            createTextSvg(
              bodyFont,
              point,
              {
                width: 245,
                fontSize: 14,
                color:
                  COLOR.text,
                charsPerLine: 18,
                maxLines: 1,
              }
            ),

          left: 1222,
          top:
            testPointY +
            5,
        });

        testPointY += 43;
      }
    );

    /*
    =====================================================
    FINAL COMPOSITE
    =====================================================
    */

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
        .composite(
          layers
        )
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
      {
        status: 500,
      }
    );
  }
}