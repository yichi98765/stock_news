import type { NewsItem } from "../types";
import { callGeminiWithFallback } from "./geminiClient";

const SYSTEM = `あなたは米国株のニュース要約アシスタントです。
- 各記事を 2〜4文 (合計 80〜180 字) の日本語要約に変換する。
- URL から記事本文を取得できた場合は本文の内容を反映する。取得失敗時はタイトルから読み取れる事実のみを書く。
- 「買うべき/売るべき」のような投資助言は禁止。
- 不確かな部分は「〜の可能性がある」と書く。
- 必ず指定された JSON 形式のみを出力し、コードブロックや説明文を一切付けない。`;

interface ParsedSummaries {
  summaries?: { id?: string; ja?: string }[];
}

function parseJson(text: string): ParsedSummaries | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as ParsedSummaries;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as ParsedSummaries;
    } catch {
      return null;
    }
  }
}

export async function translateNewsBatch(
  items: NewsItem[]
): Promise<Record<string, string>> {
  if (items.length === 0) return {};

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return {};

  const itemsBlock = items
    .map(
      (n, i) =>
        `${i + 1}. id: "${n.id}"\n   title: ${n.title}\n   source: ${n.source}\n   url: ${n.url}`
    )
    .join("\n\n");

  const userPrompt = `次のニュース記事それぞれについて、2〜4 文 (合計 80〜180 字) の日本語要約を生成してください。
URL から本文を取得できる場合は本文の内容を反映し、取得できない場合はタイトルと出典から読み取れる事実のみを書いてください。

# 記事一覧
${itemsBlock}

# 出力スキーマ (JSON のみ)
{
  "summaries": [
    { "id": "<入力と同じ id 文字列>", "ja": "<日本語要約>" }
  ]
}

すべての記事について 1 件ずつ summary を返してください。`;

  try {
    const useUrlContext = process.env.GEMINI_URL_CONTEXT === "1";
    const body: Record<string, unknown> = {
      system_instruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: useUrlContext
        ? { temperature: 0.2 }
        : { temperature: 0.2, responseMimeType: "application/json" }
    };
    if (useUrlContext) {
      body.tools = [{ url_context: {} }];
    }

    const result = await callGeminiWithFallback(body, { tag: "newsTranslator" });
    if (!result) return {};
    const text = result.text;

    const parsed = parseJson(text);
    const out: Record<string, string> = {};
    for (const s of parsed?.summaries ?? []) {
      if (s?.id && s?.ja) out[s.id] = s.ja;
    }
    if (Object.keys(out).length === 0) {
      console.warn(
        `[newsTranslator] no summaries parsed. model=${result.usedModel} preview=${text.slice(0, 200)}`
      );
    }
    return out;
  } catch (e) {
    console.warn("[newsTranslator] failed:", (e as Error).message);
    return {};
  }
}
