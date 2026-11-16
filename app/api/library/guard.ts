import { isLibraryAllowed } from "@/lib/library";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shared wrapper: admin check, then the handler; errors come back as JSON the page can show. */
export async function guarded(handler: () => Promise<Response>): Promise<Response> {
  try {
    if (!(await isLibraryAllowed())) {
      return Response.json({ error: "보관함은 관리자 로그인 후 사용할 수 있어요." }, { status: 401 });
    }
    return await handler();
  } catch (error) {
    console.error("LIBRARY ERROR:", error);
    return Response.json({ error: "보관함 처리 중 오류가 발생했습니다.",
      detail: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export const bad = (error: string) => Response.json({ error }, { status: 400 });
export const cleanName = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 80) : "";
