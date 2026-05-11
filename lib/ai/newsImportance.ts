import type { NewsImportance, NewsItem } from "../types";
import { callGeminiWithFallback } from "./geminiClient";

interface ImportanceModelItem {
  id: string;
  importance: NewsImportance;
  score: number;
  reason: string;
}

const SYSTEM_PROMPT = `あなたは米国株ニュースの重要度を分類するアシスタントです。
投資助言はせず、ニュースの種類と事実上の市場関連性だけを評価してください。
出力は必ず JSON のみです。`;

function parseJson(text: string): { items?: ImportanceModelItem[] } | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned) as { items?: ImportanceModelItem[] };
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as { items?: ImportanceModelItem[] };
    } catch {
      return null;
    }
  }
}

function normalizeImportance(value: unknown, score: number): NewsImportance {
  if (value === "high" || value === "medium" || value === "low") return value;
  if (score >= 70) return "high";
  if (score >= 35) return "medium";
  return "low";
}

async function callGemini(prompt: string): Promise<string | null> {
  const result = await callGeminiWithFallback(
    {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    },
    { tag: "news-importance" }
  );
  return result?.text ?? null;
}

async function callAnthropic(prompt: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text: string }[] };
    return data.content?.find((c) => c.type === "text")?.text ?? null;
  } catch {
    return null;
  }
}

async function callOpenAI(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ]
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

function buildPrompt(items: NewsItem[]): string {
  const payload = items.map((item) => ({
    id: item.id,
    ticker: item.ticker,
    title: item.title,
    summary: item.summary.slice(0, 320),
    source: item.source,
    publishedAt: item.publishedAt,
    ruleScore: item.importanceScore,
    ruleReason: item.importanceReason
  }));

  return `以下のニュースを high / medium / low で分類し、0〜100の重要度スコアを付けてください。

判断基準:
- high: 決算、ガイダンス、SEC filing、訴訟/規制調査、M&A、大型契約、格下げ、明確な業績影響がある内容
- medium: アナリスト目標株価、提携、製品/サービス更新、セクター全体に関わる材料
- low: 株価解説、一般的な市場コメント、重複性が高い記事、影響が読み取りにくい内容

出力スキーマ:
{
  "items": [
    { "id": string, "importance": "high" | "medium" | "low", "score": number, "reason": string }
  ]
}

ニュース:
${JSON.stringify(payload, null, 2)}`;
}

export async function refineNewsImportance(items: NewsItem[]): Promise<void> {
  if (items.length === 0) return;
  if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    return;
  }

  const prompt = buildPrompt(items.slice(0, 20));
  const text =
    (process.env.GEMINI_API_KEY ? await callGemini(prompt) : null) ??
    (process.env.ANTHROPIC_API_KEY ? await callAnthropic(prompt) : null) ??
    (process.env.OPENAI_API_KEY ? await callOpenAI(prompt) : null);
  if (!text) return;

  const parsed = parseJson(text);
  const updates = new Map<string, ImportanceModelItem>();
  for (const item of parsed?.items ?? []) {
    if (!item.id) continue;
    const score = Math.max(0, Math.min(100, Number(item.score) || 0));
    updates.set(item.id, {
      id: item.id,
      importance: normalizeImportance(item.importance, score),
      score,
      reason: item.reason || "AI重要度判定"
    });
  }

  for (const item of items) {
    const update = updates.get(item.id);
    if (!update) continue;
    item.importance = update.importance;
    item.importanceScore = update.score;
    item.importanceReason = `AI判定: ${update.reason}`;
  }
}
