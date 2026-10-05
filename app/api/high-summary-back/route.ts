import { createLogoBackCover } from "../logo-back-cover/image";

export const runtime = "nodejs";

export async function POST() {
  try {
    return Response.json({
      image: await createLogoBackCover(),
      cheerText: "",
      uniqueCharacterCount: 0,
    });
  } catch (error: unknown) {
    return Response.json({
      error: "로고 뒷표지를 만들지 못했습니다.",
      detail: error instanceof Error ? error.message : "알 수 없는 오류",
    }, { status: 500 });
  }
}
