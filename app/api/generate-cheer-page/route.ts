import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import TextToSVG from "text-to-svg";

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
  "오늘도 충분히 잘하고 있어요",
  "한 걸음씩, 실력이 쌓여요",
  "꾸준한 배움이 나를 키워요",
  "작은 도전이 큰 변화를 만들어요",
  "오늘의 배움이 내일의 자신감으로",
  "천천히 가도 괜찮아요",
  "배울수록 나의 세상이 넓어져요",
  "지금의 노력이 다음을 준비해요",
  "어제보다 한 뼘 더 자랐어요",
  "새로운 질문이 배움의 시작이에요",
  "다시 해보는 용기를 응원해요",
  "나만의 속도로 계속 나아가요",
] as const;

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
    const logoPath = path.join(
      process.cwd(),
      "public",
      "brand",
      "summit-visual-lab-horizontal.png"
    );

    // Convert Korean text to paths so rendering does not depend on host fonts.
    const textToSVG = TextToSVG.loadSync(
      path.join(process.cwd(), "public", "fonts", "NotoSansKR-Bold.ttf")
    );
    const maxTextWidth = 1240;
    const headlineSize = Math.min(
      68,
      (68 * maxTextWidth) / textToSVG.getWidth(cheerText, { fontSize: 68 })
    );
    const headline = textToSVG.getPath(cheerText, {
      x: 768,
      y: 440,
      fontSize: headlineSize,
      anchor: "center middle",
      attributes: { fill: "#193e38" },
    });
    const subtitle = textToSVG.getPath("배움의 모든 순간을 응원합니다", {
      x: 768,
      y: 552,
      fontSize: 28,
      anchor: "center middle",
      attributes: { fill: "#657b73" },
    });
    const backgroundSvg = Buffer.from(`
      <svg width="1536" height="1024" viewBox="0 0 1536 1024" xmlns="http://www.w3.org/2000/svg">
        <rect width="1536" height="1024" fill="#faf9f4"/>
        <rect x="0" y="0" width="1536" height="16" fill="#a4d7c6"/>
        <rect x="724" y="304" width="88" height="6" rx="3" fill="#79bca7"/>
        ${headline}
        ${subtitle}
        <path d="M128 720 H1408" stroke="#dce9e2" stroke-width="2"/>
      </svg>
    `);

    const logoBuffer = await fs.readFile(logoPath);
    const { data: resizedLogo, info: logoSize } = await sharp(logoBuffer)
      .trim()
      .resize({ width: 360, height: 120, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    const finalImage = await sharp(backgroundSvg)
      .composite([{
        input: resizedLogo,
        left: Math.round((1536 - logoSize.width) / 2),
        top: Math.round(844 - logoSize.height / 2),
      }])
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
