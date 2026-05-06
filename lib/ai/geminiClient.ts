export interface GeminiResult {
  text: string;
  usedModel: string;
}

const DEFAULT_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-flash"
];

export function getModelChain(): string[] {
  const fromList = process.env.GEMINI_MODELS;
  if (fromList) {
    const list = fromList
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length > 0) return list;
  }

  const primary = process.env.GEMINI_MODEL;
  if (primary) {
    return Array.from(new Set([primary, ...DEFAULT_MODELS]));
  }
  return DEFAULT_MODELS;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  promptFeedback?: { blockReason?: string };
}

export async function callGeminiWithFallback(
  body: object,
  options?: { models?: string[]; tag?: string }
): Promise<GeminiResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const models = options?.models ?? getModelChain();
  const tag = options?.tag ?? "gemini";

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });

      if (res.status === 429 || res.status === 403 || res.status === 404) {
        const errBody = await res.text().catch(() => "");
        console.warn(
          `[${tag}] ${model} status=${res.status} -> trying next. body=${errBody.slice(0, 200)}`
        );
        continue;
      }
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.warn(
          `[${tag}] ${model} status=${res.status} body=${errBody.slice(0, 200)}`
        );
        continue;
      }

      const data = (await res.json()) as GeminiResponse;
      if (data.promptFeedback?.blockReason) {
        console.warn(`[${tag}] ${model} blocked: ${data.promptFeedback.blockReason}`);
        continue;
      }
      const text =
        data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text) {
        console.warn(`[${tag}] ${model} empty text`);
        continue;
      }
      return { text, usedModel: model };
    } catch (e) {
      console.warn(`[${tag}] ${model} threw: ${(e as Error).message}`);
      continue;
    }
  }
  return null;
}
