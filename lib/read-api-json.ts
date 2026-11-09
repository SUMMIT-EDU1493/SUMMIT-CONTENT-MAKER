/** Keep HTTP status and hosting request IDs when the server returns plain text. */
export async function readApiJson(response: Response, feature: string): Promise<Record<string, any>> {
  const raw = await response.text();
  let data: Record<string, any>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid object");
    data = parsed as Record<string, any>;
  } catch {
    const requestId = response.headers.get("x-vercel-id");
    const timedOut = response.status === 504 || /FUNCTION_INVOCATION_TIMEOUT|timed?\s*out/i.test(raw);
    throw new Error(`${feature}: ${timedOut ? "서버 처리 시간이 초과되었습니다." : "서버가 정상적인 응답을 보내지 못했습니다."} (HTTP ${response.status}${requestId ? `, 요청 ${requestId}` : ""})`);
  }
  if (!response.ok) {
    throw new Error(`${feature}: ${data.detail || data.error || "요청에 실패했습니다."} (HTTP ${response.status})`);
  }
  return data;
}
