import type { NewsItem } from "../types";

const SYSTEM = `あなたは米国株のニュースタイトル一覧を日本語に要約するアシスタントです。
ルール:
- 各タイトルを 1〜2文 (40〜90字程度) の日本語に圧縮する。
- タイトルから読み取れる事実のみを書き、推測や誇張は避ける。
- 投資助言は禁止。「買うべき/売るべき」表現を使わない。
- 不確かな部分は「〜の可能性がある」と書く。
- 必ず指定 JSON スキーマで返す。`;

export async function translateNewsBatch(
  items: NewsItem[]
): Promise<Record<string, string>> {
  if (items.length === 0) return {};

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return {};

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const payload = items.map((n) => ({
    id: n.id,
    title: n.title,
    ticker: n.ticker,
    source: n.source,
    sentiment: n.sentiment
  }));

  const userPrompt = `以下のニュースタイトルを各 1〜2 文の日本語要約に変換してください。
出力スキーマ:
{
  "summaries": [
    { "id": string, "ja": string }
  ]
}

# 入力 (英語タイトル)
${JSON.stringify(payload, null, 2)}

JSON 以外を一切出力しないこと。id は入力と同じ値をそのまま返すこと。`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });
    if (!res.ok) {
      console.warn(`[newsTranslator] gemini status=${res.status}`);
      return {};
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) return {};

    const parsed = JSON.parse(text) as { summaries?: { id?: string; ja?: string }[] };
    const result: Record<string, string> = {};
    for (const s of parsed.summaries ?? []) {
      if (s?.id && s?.ja) result[s.id] = s.ja;
    }
    return result;
  } catch (e) {
    console.warn(`[newsTranslator] failed:`, (e as Error).message);
    return {};
  }
}
