import type {
  DailySummary,
  MarketOverview,
  NewsItem,
  PerTickerSummary,
  StockQuote
} from "../types";
import { buildMarketHeadline, buildPerTickerSummary, buildRuleBasedSummary } from "./ruleBased";
import { callGeminiWithFallback } from "./geminiClient";

interface SummaryInput {
  quotes: StockQuote[];
  newsByTicker: Record<string, NewsItem[]>;
  market: MarketOverview;
}

const SYSTEM_PROMPT = `あなたは米国株の事実ベースの情報整理を行うアシスタントです。
以下の制約を必ず守ってください:
- 日本語で出力する。
- 「買うべき」「売るべき」など投資助言になる表現は禁止。
- 「〜の可能性がある」「市場では〜と解釈されている可能性がある」など、断定を避けた表現を使う。
- 根拠となるニュースが提供されない場合は、推測ではなく「明確な根拠は見当たらない」と書く。
- 出力は必ず指定された JSON スキーマに従う。`;

function buildUserPrompt(input: SummaryInput): string {
  const tickerBlocks = input.quotes.map((q) => {
    const news = (input.newsByTicker[q.ticker] ?? []).slice(0, 8).map((n, idx) => ({
      idx,
      title: n.title,
      summary: n.summary.slice(0, 280),
      source: n.source,
      sentiment: n.sentiment,
      publishedAt: n.publishedAt,
      url: n.url
    }));
    return {
      ticker: q.ticker,
      displayName: q.displayName,
      price: q.price,
      changePercent: q.changePercent,
      news
    };
  });

  const market = {
    indices: input.market.indices.map((i) => ({
      name: i.displayName,
      changePercent: i.changePercent
    })),
    sectors: input.market.sectors.map((s) => ({
      name: s.sectorJa,
      etf: s.etfTicker,
      changePercent: s.changePercent
    })),
    themes: input.market.themes
  };

  return `以下のデータを基に、JSONを返してください。

# 出力スキーマ
{
  "marketHeadline": string,  // 主要指数とテーマを1〜2文でまとめる
  "perTicker": [
    {
      "ticker": string,
      "headline": string,        // 「上昇」「下落」「横ばい」と幅を含む簡潔表現
      "reasoning": string,       // 200〜350字程度の事実ベース推定。投資助言禁止。
      "evidenceIndexes": number[] // 上記 news の idx 配列。最大3件
    }
  ]
}

# 銘柄別データ
${JSON.stringify(tickerBlocks, null, 2)}

# 市場データ
${JSON.stringify(market, null, 2)}

JSON 以外を出力しないでください。`;
}

interface ModelOutput {
  marketHeadline: string;
  perTicker: {
    ticker: string;
    headline: string;
    reasoning: string;
    evidenceIndexes: number[];
  }[];
}

function parseModelJson(text: string): ModelOutput | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned) as ModelOutput;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as ModelOutput;
    } catch {
      return null;
    }
  }
}

async function callGemini(prompt: string): Promise<string | null> {
  const result = await callGeminiWithFallback(
    {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    },
    { tag: "summarizer" }
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
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text: string }[] };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    return text || null;
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
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ]
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

function mapModelToSummary(
  parsed: ModelOutput,
  input: SummaryInput,
  by: "anthropic" | "openai" | "gemini"
): DailySummary {
  const perTicker: PerTickerSummary[] = input.quotes.map((q) => {
    const fromModel = parsed.perTicker.find((t) => t.ticker === q.ticker);
    const news = input.newsByTicker[q.ticker] ?? [];
    if (!fromModel) {
      return buildPerTickerSummary(q, news, input.market);
    }
    const evidence = (fromModel.evidenceIndexes ?? [])
      .filter((i) => i >= 0 && i < news.length)
      .slice(0, 3)
      .map((i) => ({
        title: news[i].title,
        url: news[i].url,
        source: news[i].source
      }));
    return {
      ticker: q.ticker,
      displayName: q.displayName,
      changePercent: q.changePercent,
      headline: fromModel.headline,
      reasoning: fromModel.reasoning,
      evidence,
      confidence: evidence.length >= 2 ? "medium" : "low"
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    generatedBy: by,
    marketHeadline: parsed.marketHeadline || buildMarketHeadline(input.market),
    perTicker
  };
}

export async function summarize(input: SummaryInput): Promise<DailySummary> {
  const prompt = buildUserPrompt(input);

  if (process.env.GEMINI_API_KEY) {
    const text = await callGemini(prompt);
    if (text) {
      const parsed = parseModelJson(text);
      if (parsed) return mapModelToSummary(parsed, input, "gemini");
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const text = await callAnthropic(prompt);
    if (text) {
      const parsed = parseModelJson(text);
      if (parsed) return mapModelToSummary(parsed, input, "anthropic");
    }
  }

  if (process.env.OPENAI_API_KEY) {
    const text = await callOpenAI(prompt);
    if (text) {
      const parsed = parseModelJson(text);
      if (parsed) return mapModelToSummary(parsed, input, "openai");
    }
  }

  return buildRuleBasedSummary(input.quotes, input.newsByTicker, input.market);
}
