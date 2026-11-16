import { getItem } from "@/lib/library";
import { bad, guarded, UUID } from "../guard";

export const runtime = "nodejs";

/** Return a saved page as a data URL so the PDF maker can use it without cross-origin loading. */
export async function GET(request: Request) {
  return guarded(async () => {
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!UUID.test(id)) return bad("자료를 확인해 주세요.");
    const item = await getItem(id);
    if (!item) return Response.json({ error: "자료를 찾지 못했습니다." }, { status: 404 });
    const response = await fetch(item.imageUrl);
    if (!response.ok) throw new Error(`이미지를 불러오지 못했습니다 (HTTP ${response.status}).`);
    const base64 = Buffer.from(await response.arrayBuffer()).toString("base64");
    return Response.json({ image: `data:image/jpeg;base64,${base64}`, title: item.title, subtitle: item.subtitle });
  });
}
