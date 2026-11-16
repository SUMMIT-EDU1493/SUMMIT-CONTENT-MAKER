// One place for model names. gpt-5-mini shuts down on 2026-12-11; OpenAI names gpt-6.1-terra as its replacement.
// OPENAI_TEXT_MODEL can override the text model without a code change.
export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-6.1-terra";
export const IMAGE_MODEL = "gpt-image-2";

// USD per 1M tokens (OpenAI pricing pages, checked 2026-11-16).
export const TEXT_PRICING: Record<string, { input: number; cached: number; output: number }> = {
  "gpt-6.1-terra": { input: 1.0, cached: 0.1, output: 5.0 },
  "gpt-6-luna": { input: 0.1, cached: 0.01, output: 0.5 },
  "gpt-5-mini": { input: 0.25, cached: 0.025, output: 2.0 },
};
