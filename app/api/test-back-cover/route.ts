import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import TextToSVG from "text-to-svg";

export async function GET() {
  try {
    const width = 1600;
    const height = 1131;

    const bg = "#f8f7f3";
    const black = "#111111";
    const gray = "#555555";
    const soft = "#e9e7e1";

    const logoPath = path.join(
      process.cwd(),
      "public",
      "summit-logo.png"
    );

    const fontPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "NotoSansKR-Bold.ttf"
    );

    const [logoBuffer] = await Promise.all([
      fs.readFile(logoPath),
      fs.access(fontPath),
    ]);

    const textToSVG = TextToSVG.loadSync(fontPath);

    const cheerText =
      "여기까지 해낸 너, 정말 잘하고 있어!";

    const titleSvg = textToSVG.getSVG(cheerText, {
      x: 0,
      y: 0,
      fontSize: 54,
      anchor: "top",
      attributes: {
        fill: black,
      },
    });

    const titleBuffer = Buffer.from(titleSvg);

    const baseSvg = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${width}"
        height="${height}"
      >
        <rect
          x="0"
          y="0"
          width="${width}"
          height="${height}"
          fill="${bg}"
        />

        <!-- 캐릭터 배치 영역 -->
        <ellipse
          cx="800"
          cy="790"
          rx="520"
          ry="70"
          fill="${soft}"
        />

        <!-- 왼쪽 캐릭터 -->
        <circle
          cx="470"
          cy="535"
          r="90"
          fill="#d9d6cf"
        />
        <rect
          x="390"
          y="620"
          width="160"
          height="215"
          rx="65"
          fill="#d9d6cf"
        />

        <!-- 가운데 왼쪽 캐릭터 -->
        <circle
          cx="680"
          cy="475"
          r="100"
          fill="#cecac1"
        />
        <rect
          x="585"
          y="570"
          width="190"
          height="270"
          rx="75"
          fill="#cecac1"
        />

        <!-- 가운데 오른쪽 캐릭터 -->
        <circle
          cx="920"
          cy="475"
          r="100"
          fill="#c5c1b8"
        />
        <rect
          x="825"
          y="570"
          width="190"
          height="270"
          rx="75"
          fill="#c5c1b8"
        />

        <!-- 오른쪽 캐릭터 -->
        <circle
          cx="1130"
          cy="535"
          r="90"
          fill="#d9d6cf"
        />
        <rect
          x="1050"
          y="620"
          width="160"
          height="215"
          rx="65"
          fill="#d9d6cf"
        />

        <!-- 작은 장식 -->
        <circle
          cx="335"
          cy="330"
          r="10"
          fill="${gray}"
          opacity="0.18"
        />

        <circle
          cx="1270"
          cy="350"
          r="14"
          fill="${gray}"
          opacity="0.14"
        />

        <circle
          cx="1200"
          cy="260"
          r="7"
          fill="${gray}"
          opacity="0.12"
        />

        <circle
          cx="410"
          cy="250"
          r="8"
          fill="${gray}"
          opacity="0.13"
        />
      </svg>
    `;

    const baseBuffer = Buffer.from(baseSvg);

    const resizedLogo = await sharp(logoBuffer)
      .trim()
      .resize({
        width: 390,
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    const titleMeta = await sharp(titleBuffer).metadata();

    const titleWidth = titleMeta.width || 1000;

    const finalImage = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: {
          r: 248,
          g: 247,
          b: 243,
          alpha: 1,
        },
      },
    })
      .composite([
        {
          input: baseBuffer,
          left: 0,
          top: 0,
        },
        {
          input: titleBuffer,
          left: Math.round(width / 2 - titleWidth / 2),
          top: 125,
        },
        {
          input: resizedLogo,
          left: 605,
          top: 900,
        },
      ])
      .png()
      .toBuffer();

    return new Response(new Uint8Array(finalImage), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("TEST BACK COVER ERROR:", error);

    return Response.json(
      {
        error: "뒷표지 테스트 이미지 생성 중 오류가 발생했습니다.",
        detail: error?.message || "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}