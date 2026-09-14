import OpenAI from "openai";
import { logApiUsage } from "@/lib/api-usage";

type TrackingContext = {
  route: string;
  feature: string;
  requestId?: string;
};

type AnyRecord = Record<string, any>;

const USD_KRW_RATE = Number(process.env.USD_KRW_RATE || "1400");

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function textCostUsd(model: string, usage: AnyRecord | undefined): number {
  if (!usage || model !== "gpt-5-mini") return 0;

  const input = toNumber(usage.input_tokens);
  const output = toNumber(usage.output_tokens);
  const cached = toNumber(usage.input_tokens_details?.cached_tokens);
  const uncached = Math.max(0, input - cached);

  return (uncached * 0.25 + cached * 0.025 + output * 2.0) / 1_000_000;
}

function imageCostUsd(model: string, usage: AnyRecord | undefined): number {
  if (!usage || model !== "gpt-image-2") return 0;

  const inputDetails = usage.input_tokens_details || {};
  const outputDetails = usage.output_tokens_details || {};

  const totalInput = toNumber(usage.input_tokens);
  const totalOutput = toNumber(usage.output_tokens);

  const textInput = toNumber(inputDetails.text_tokens) || totalInput;
  const imageInput = toNumber(inputDetails.image_tokens);
  const cachedInput = toNumber(inputDetails.cached_tokens);
  const imageOutput = toNumber(outputDetails.image_tokens) || totalOutput;

  const uncachedTextInput = Math.max(0, textInput - cachedInput);

  return (
    uncachedTextInput * 5.0 +
    cachedInput * 1.25 +
    imageInput * 8.0 +
    imageOutput * 30.0
  ) / 1_000_000;
}

export function createTrackedOpenAI(
  options: ConstructorParameters<typeof OpenAI>[0],
  context: TrackingContext
): OpenAI {
  const client = new OpenAI(options);

  const originalResponsesCreate = client.responses.create.bind(client.responses);
  const originalImagesGenerate = client.images.generate.bind(client.images);

  (client.responses as AnyRecord).create = async (...args: any[]) => {
    const request = (args[0] || {}) as AnyRecord;
    const model = String(request.model || "unknown");

    try {
      const response = await (originalResponsesCreate as any)(...args);
      const usage = (response as AnyRecord).usage as AnyRecord | undefined;
      const inputTokens = toNumber(usage?.input_tokens);
      const outputTokens = toNumber(usage?.output_tokens);
      const totalTokens =
        toNumber(usage?.total_tokens) || inputTokens + outputTokens;
      const usd = textCostUsd(model, usage);

      await logApiUsage({
        route: context.route,
        feature: context.feature,
        model,
        usageType: "text",
        success: true,
        inputTokens: inputTokens || null,
        outputTokens: outputTokens || null,
        totalTokens: totalTokens || null,
        estimatedCostUsd: usd,
        estimatedCostKrw: usd * USD_KRW_RATE,
        metadata: {
          pricingBasis: model === "gpt-5-mini" ? "gpt-5-mini token pricing" : "unknown",
          usdKrwRate: USD_KRW_RATE,
          cachedInputTokens: toNumber(usage?.input_tokens_details?.cached_tokens),
        },
      });

      return response;
    } catch (error) {
      await logApiUsage({
        route: context.route,
        feature: context.feature,
        model,
        usageType: "text",
        success: false,
        errorMessage: errorMessage(error),
        metadata: { usdKrwRate: USD_KRW_RATE },
      });
      throw error;
    }
  };

  (client.images as AnyRecord).generate = async (...args: any[]) => {
    const request = (args[0] || {}) as AnyRecord;
    const model = String(request.model || "unknown");

    try {
      const response = await (originalImagesGenerate as any)(...args);
      const usage = (response as AnyRecord).usage as AnyRecord | undefined;
      const inputTokens = toNumber(usage?.input_tokens);
      const outputTokens = toNumber(usage?.output_tokens);
      const totalTokens = inputTokens + outputTokens;
      const imageCount = Array.isArray((response as AnyRecord).data)
        ? (response as AnyRecord).data.length
        : toNumber(request.n) || 1;
      const usd = imageCostUsd(model, usage);

      await logApiUsage({
        route: context.route,
        feature: context.feature,
        model,
        usageType: "image",
        success: true,
        inputTokens: inputTokens || null,
        outputTokens: outputTokens || null,
        totalTokens: totalTokens || null,
        imageCount,
        estimatedCostUsd: usd,
        estimatedCostKrw: usd * USD_KRW_RATE,
        metadata: {
          pricingBasis: model === "gpt-image-2" ? "gpt-image-2 token pricing" : "unknown",
          usdKrwRate: USD_KRW_RATE,
          requestId: context.requestId || null,
          size: request.size || null,
          quality: request.quality || null,
          rawUsage: usage || null,
        },
      });

      return response;
    } catch (error) {
      await logApiUsage({
        route: context.route,
        feature: context.feature,
        model,
        usageType: "image",
        success: false,
        imageCount: toNumber(request.n) || 1,
        errorMessage: errorMessage(error),
        metadata: {
          usdKrwRate: USD_KRW_RATE,
          requestId: context.requestId || null,
          size: request.size || null,
          quality: request.quality || null,
        },
      });
      throw error;
    }
  };

  return client;
}

