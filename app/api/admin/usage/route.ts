import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { ADMIN_COOKIE_NAME, cookieMatches } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie") || "";
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const found = parts.find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : undefined;
}

function numberValue(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: Request) {
  const cookie = readCookie(request, ADMIN_COOKIE_NAME);
  if (!cookieMatches(cookie)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json(
      { error: "DATABASE_URL 환경변수가 없습니다." },
      { status: 500 }
    );
  }

  const sql = neon(databaseUrl);

  const [summaryRows, typeRows, featureRows, recentRows, dailyRows] =
    await Promise.all([
      sql`
        SELECT
          COALESCE(SUM(estimated_cost_krw) FILTER (
            WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date =
                  (NOW() AT TIME ZONE 'Asia/Seoul')::date
          ), 0) AS today_cost,
          COALESCE(SUM(estimated_cost_krw) FILTER (
            WHERE date_trunc('month', created_at AT TIME ZONE 'Asia/Seoul') =
                  date_trunc('month', NOW() AT TIME ZONE 'Asia/Seoul')
          ), 0) AS month_cost,
          COALESCE(SUM(estimated_cost_krw), 0) AS total_cost,
          COUNT(*) AS total_calls,
          COUNT(*) FILTER (WHERE success = TRUE) AS success_calls,
          COUNT(*) FILTER (WHERE success = FALSE) AS failed_calls
        FROM api_usage_logs
      `,
      sql`
        SELECT
          usage_type,
          COUNT(*) AS calls,
          COALESCE(SUM(estimated_cost_krw), 0) AS cost_krw
        FROM api_usage_logs
        GROUP BY usage_type
        ORDER BY cost_krw DESC
      `,
      sql`
        SELECT
          feature,
          COUNT(*) AS calls,
          COALESCE(SUM(estimated_cost_krw), 0) AS cost_krw,
          COALESCE(AVG(estimated_cost_krw), 0) AS avg_cost_krw
        FROM api_usage_logs
        GROUP BY feature
        ORDER BY cost_krw DESC
        LIMIT 30
      `,
      sql`
        SELECT
          id,
          created_at,
          route,
          feature,
          model,
          usage_type,
          success,
          input_tokens,
          output_tokens,
          total_tokens,
          image_count,
          estimated_cost_krw,
          error_message,
          metadata
        FROM api_usage_logs
        ORDER BY created_at DESC
        LIMIT 50
      `,
      sql`
        SELECT
          (created_at AT TIME ZONE 'Asia/Seoul')::date AS day,
          COUNT(*) AS calls,
          COALESCE(SUM(estimated_cost_krw), 0) AS cost_krw
        FROM api_usage_logs
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY day
        ORDER BY day ASC
      `,
    ]);

  const rawSummary = summaryRows[0] || {};

  return NextResponse.json({
    summary: {
      todayCost: numberValue(rawSummary.today_cost),
      monthCost: numberValue(rawSummary.month_cost),
      totalCost: numberValue(rawSummary.total_cost),
      totalCalls: numberValue(rawSummary.total_calls),
      successCalls: numberValue(rawSummary.success_calls),
      failedCalls: numberValue(rawSummary.failed_calls),
    },
    byType: typeRows.map((row) => ({
      usageType: String(row.usage_type || ""),
      calls: numberValue(row.calls),
      costKrw: numberValue(row.cost_krw),
    })),
    byFeature: featureRows.map((row) => ({
      feature: String(row.feature || ""),
      calls: numberValue(row.calls),
      costKrw: numberValue(row.cost_krw),
      avgCostKrw: numberValue(row.avg_cost_krw),
    })),
    recent: recentRows.map((row) => ({
      ...row,
      estimated_cost_krw: numberValue(row.estimated_cost_krw),
    })),
    daily: dailyRows.map((row) => ({
      day: String(row.day || ""),
      calls: numberValue(row.calls),
      costKrw: numberValue(row.cost_krw),
    })),
  });
}
