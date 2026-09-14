import { NextResponse } from "next/server";
import { logApiUsage } from "@/lib/api-usage";

export async function GET() {
  await logApiUsage({
    route: "/api/usage-test",
    feature: "트래킹 연결 테스트",
    model: "none",
    usageType: "text",
    success: true,
    metadata: {
      purpose: "Neon connection test",
    },
  });

  return NextResponse.json({ ok: true });
}
