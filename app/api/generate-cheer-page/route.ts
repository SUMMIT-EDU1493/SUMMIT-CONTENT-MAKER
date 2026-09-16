import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

type ComicPanel = {
  characters?: string;
};

type ComicPlan = {
  panels?: ComicPanel[];
};

type RequestBody = {
  plans: ComicPlan[];
};

const CHEER_MESSAGES = [
  "오늘도 차근차근, 충분히 잘하고 있어요.",
  "한 걸음씩 쌓은 노력이 실력이 됩니다.",
  "지금의 꾸준함이 다음 성장을 만들어 줍니다.",
  "끝까지 집중한 만큼 좋은 결과가 따라올 거예요.",
  "오늘 배운 내용이 내일의 자신감이 됩니다.",
  "천천히 해도 괜찮아요. 꾸준히 나아가고 있어요.",
  "배운 만큼 시야가 넓어지고 실력이 자랍니다.",
  "지금까지의 노력이 멋진 다음 장면을 준비하고 있어요.",
] as const;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const plans = body?.plans;

    if (!Array.isArray(plans) || plans.length === 0) {
      return Response.json(
        { error: "뒷표지에 사용할 설계안이 없습니다." },
        { status: 400 }
      );
    }

    const cheerText =
      CHEER_MESSAGES[Math.floor(Math.random() * CHEER_MESSAGES.length)];
    const safeText = escapeXml(cheerText);
    const logoPath = path.join(
      process.cwd(),
      "public",
      "brand",
      "summit-visual-lab-horizontal.png"
    );

    const backgroundSvg = Buffer.from(`
      <svg width="1536" height="1024" viewBox="0 0 1536 1024" xmlns="http://www.w3.org/2000/svg">
        <rect width="1536" height="1024" fill="#f7f4ea"/>
        <circle cx="130" cy="150" r="90" fill="#d9f2e6"/>
        <circle cx="1400" cy="190" r="120" fill="#fde7b2"/>
        <circle cx="1290" cy="820" r="170" fill="#e4e0f7"/>
        <path d="M0 760 C260 650 430 900 700 790 S1170 650 1536 760 V1024 H0Z" fill="#e2f1ed"/>
        <rect x="150" y="170" width="1236" height="235" rx="32" fill="#ffffff" stroke="#263238" stroke-width="8"/>
        <path d="M220 170 V120 M1316 170 V120" stroke="#263238" stroke-width="8"/>
        <text x="768" y="270" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="58" font-weight="700" fill="#17212b">${safeText}</text>
        <text x="768" y="345" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="28" font-weight="600" fill="#52706a">SUMMIT VISUAL LAB · 오늘의 학습 기록</text>
        <g transform="translate(330 620)">
          <circle cx="0" cy="0" r="82" fill="#ffd9b8" stroke="#263238" stroke-width="8"/><path d="M-62 -22 Q0 -105 62 -22" fill="#263238"/><path d="M-95 150 Q0 42 95 150 V220 H-95Z" fill="#f28b82" stroke="#263238" stroke-width="8"/><path d="M-35 15 L-110 -45 M35 15 L110 -45" stroke="#263238" stroke-width="18" stroke-linecap="round"/><circle cx="-25" cy="0" r="7" fill="#263238"/><circle cx="25" cy="0" r="7" fill="#263238"/><path d="M-25 35 Q0 55 25 35" fill="none" stroke="#263238" stroke-width="7" stroke-linecap="round"/>
        </g>
        <g transform="translate(768 650)">
          <circle cx="0" cy="0" r="92" fill="#f2c6a5" stroke="#263238" stroke-width="8"/><path d="M-75 -18 Q0 -120 75 -18 Q55 -70 0 -70 Q-55 -70 -75 -18" fill="#5c6470"/><path d="M-110 155 Q0 38 110 155 V225 H-110Z" fill="#6a9bd8" stroke="#263238" stroke-width="8"/><path d="M-38 18 L-120 -36 M38 18 L120 -36" stroke="#263238" stroke-width="18" stroke-linecap="round"/><circle cx="-28" cy="0" r="7" fill="#263238"/><circle cx="28" cy="0" r="7" fill="#263238"/><path d="M-28 38 Q0 58 28 38" fill="none" stroke="#263238" stroke-width="7" stroke-linecap="round"/>
        </g>
        <g transform="translate(1200 640)">
          <circle cx="0" cy="0" r="78" fill="#ffd7b5" stroke="#263238" stroke-width="8"/><path d="M-70 -15 Q0 -108 70 -15 L48 -72 H-48Z" fill="#c58c63"/><path d="M-100 145 Q0 48 100 145 V215 H-100Z" fill="#8cc6a6" stroke="#263238" stroke-width="8"/><path d="M-32 14 L-100 -38 M32 14 L100 -38" stroke="#263238" stroke-width="18" stroke-linecap="round"/><circle cx="-24" cy="0" r="7" fill="#263238"/><circle cx="24" cy="0" r="7" fill="#263238"/><path d="M-24 34 Q0 54 24 34" fill="none" stroke="#263238" stroke-width="7" stroke-linecap="round"/>
        </g>
        <text x="768" y="950" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="30" font-weight="600" fill="#263238">오늘의 한 걸음이 내일의 자신감이 됩니다</text>
      </svg>
    `);

    const logoBuffer = await fs.readFile(logoPath);
    const resizedLogo = await sharp(logoBuffer)
      .trim()
      .resize({ width: 330, withoutEnlargement: true })
      .png()
      .toBuffer();
    const finalImage = await sharp(backgroundSvg)
      .composite([{ input: resizedLogo, left: 603, top: 855 }])
      .png()
      .toBuffer();

    return Response.json({
      image: `data:image/png;base64,${finalImage.toString("base64")}`,
      cheerText,
      uniqueCharacterCount: Math.min(
        6,
        new Set(
          plans.flatMap((plan) =>
            (plan.panels || []).map((panel) => panel.characters).filter(Boolean)
          )
        ).size
      ),
    });
  } catch (error: any) {
    console.error("GENERATE BACK COVER ERROR:", error);
    return Response.json(
      {
        error: "뒷표지를 만드는 중 오류가 발생했습니다.",
        detail: error?.message || "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}
