import { createFolder, deleteFolder, listFolders, renameFolder } from "@/lib/library";
import { bad, cleanName, guarded, UUID } from "../guard";

export const runtime = "nodejs";

export async function GET() {
  return guarded(async () => Response.json({ folders: await listFolders() }));
}

export async function POST(request: Request) {
  return guarded(async () => {
    const body = await request.json().catch(() => ({}));
    const name = cleanName(body?.name);
    const parentId = typeof body?.parentId === "string" && UUID.test(body.parentId) ? body.parentId : null;
    if (!name) return bad("폴더 이름을 입력해 주세요.");
    return Response.json({ id: await createFolder(parentId, name) });
  });
}

export async function PATCH(request: Request) {
  return guarded(async () => {
    const body = await request.json().catch(() => ({}));
    const name = cleanName(body?.name);
    if (!UUID.test(String(body?.id)) || !name) return bad("폴더와 새 이름을 확인해 주세요.");
    await renameFolder(body.id, name);
    return Response.json({ ok: true });
  });
}

export async function DELETE(request: Request) {
  return guarded(async () => {
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!UUID.test(id)) return bad("지울 폴더를 확인해 주세요.");
    const problem = await deleteFolder(id);
    return problem ? bad(problem) : Response.json({ ok: true });
  });
}
