import { neon } from "@neondatabase/serverless";

type ApiUsageLog = {
  route: string;
  feature: string;
  model: string;
  usageType: "text" | "image";
  success?: boolean;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  imageCount?: number | null;
  estimatedCostUsd?: number;
  estimatedCostKrw?: number;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function logApiUsage({
  route,
  feature,
  model,
  usageType,
  success = true,
  inputTokens = null,
  outputTokens = null,
  totalTokens = null,
  imageCount = null,
  estimatedCostUsd = 0,
  estimatedCostKrw = 0,
  errorMessage = null,
  metadata = null,
}: ApiUsageLog) {
  try {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      console.warn("[usage-tracking] DATABASE_URL is not configured.");
      return;
    }

    const sql = neon(databaseUrl);

    await sql`
      INSERT INTO api_usage_logs (
        route,
        feature,
        model,
        usage_type,
        success,
        input_tokens,
        output_tokens,
        total_tokens,
        image_count,
        estimated_cost_usd,
        estimated_cost_krw,
        error_message,
        metadata
      )
      VALUES (
        ${route},
        ${feature},
        ${model},
        ${usageType},
        ${success},
        ${inputTokens},
        ${outputTokens},
        ${totalTokens},
        ${imageCount},
        ${estimatedCostUsd},
        ${estimatedCostKrw},
        ${errorMessage},
        ${metadata ? JSON.stringify(metadata) : null}
      )
    `;
  } catch (error) {
    console.error("[usage-tracking] Failed to save usage log:", error);
  }
}
