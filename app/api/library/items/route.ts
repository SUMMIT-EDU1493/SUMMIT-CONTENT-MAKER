import { deleteItem, listItems, renameItem, saveLibraryImage } from "@/lib/library";
import { bad, cleanName, guarded, UUID } from "../guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(async () => {
    const folderId = new URL(request.url).searchParams.get("folderId") || "";
    if (!UUID.test(folderId)) return bad("폴더를 확인해 주세요.");
    return Response.json({ items: await listItems(folderId) });
  });
}

/** Save one page sent from the browser (used when importing pages from an existing PDF). */
export async function POST(request: Request) {
  return guarded(async () => {
    const body = await request.json().catch(() => ({}));
    const match = typeof body?.image === "string" ? body.image.match(/^data:image\/(png|jpeg);base64,(.+)$/) : null;
    if (!UUID.test(String(body?.folderId)) || !match) return bad("폴더와 이미지를 확인해 주세요.");
    const id = await saveLibraryImage({
      folderId: body.folderId, itemKey: cleanName(body.itemKey) || undefined, title: cleanName(body.title),
      subtitle: cleanName(body.subtitle), sourceRange: cleanName(body.sourceRange),
      kind: body.kind === "summary" ? "summary" : "comic", image: Buffer.from(match[2], "base64"),
    });
    return Response.json({ id });
  });
}

export async function PATCH(request: Request) {
  return guarded(async () => {
    const body = await request.json().catch(() => ({}));
    const title = cleanName(body?.title);
    if (!UUID.test(String(body?.id)) || !title) return bad("자료와 새 이름을 확인해 주세요.");
    await renameItem(body.id, title);
    return Response.json({ ok: true });
  });
}

export async function DELETE(request: Request) {
  return guarded(async () => {
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!UUID.test(id)) return bad("지울 자료를 확인해 주세요.");
    await deleteItem(id);
    return Response.json({ ok: true });
  });
}
