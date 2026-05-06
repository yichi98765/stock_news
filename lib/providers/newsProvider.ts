import type { NewsItem, Sentiment, TickerConfig } from "../types";
import { CACHE_TTL_MS } from "../config";
import { createTtlCache } from "../utils";
import { translateNewsBatch } from "../ai/newsTranslator";

const cache = createTtlCache<NewsItem[]>();

const POSITIVE_KEYWORDS = [
  "beat", "beats", "record", "surge", "soar", "rally", "upgrade", "raises", "raise",
  "outperform", "buy rating", "approval", "expansion", "partnership", "growth",
  "guidance raised", "strong demand", "all-time high",
  "上昇", "上方修正", "好調", "増収", "増益", "決算上振れ", "格上げ", "拡大", "好決算"
];
const NEGATIVE_KEYWORDS = [
  "miss", "misses", "plunge", "drop", "fall", "downgrade", "lawsuit", "probe",
  "investigation", "warning", "cut", "cuts", "slowdown", "recall", "delay",
  "guidance cut", "weak demand", "selloff",
  "下落", "下方修正", "減収", "減益", "格下げ", "リコール", "訴訟", "調査", "懸念", "失望"
];

function classify(title: string, summary: string): { sentiment: Sentiment; reason: string } {
  const text = `${title} ${summary}`.toLowerCase();
  const posHits = POSITIVE_KEYWORDS.filter((k) => text.includes(k.toLowerCase()));
  const negHits = NEGATIVE_KEYWORDS.filter((k) => text.includes(k.toLowerCase()));

  if (posHits.length > negHits.length) {
    return { sentiment: "up", reason: `ポジティブ語: ${posHits.slice(0, 3).join(", ")}` };
  }
  if (negHits.length > posHits.length) {
    return { sentiment: "down", reason: `ネガティブ語: ${negHits.slice(0, 3).join(", ")}` };
  }
  return { sentiment: "neutral", reason: "明確なポジ/ネガ語なし" };
}

interface YahooSearchNews {
  uuid?: string;
  title?: string;
  publisher?: string;
  link?: string;
  providerPublishTime?: number;
  summary?: string;
}

async function fetchYahooNews(ticker: string): Promise<NewsItem[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    ticker
  )}&newsCount=10&quotesCount=0&lang=en-US&region=US`;
  let items: YahooSearchNews[] = [];
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (res.ok) {
      const data = (await res.json()) as { news?: YahooSearchNews[] };
      items = data.news ?? [];
    }
  } catch (e) {
    console.warn(`[newsProvider] yahoo search(${ticker}) failed:`, (e as Error).message);
  }

  return items
    .filter((n) => n.title && n.link)
    .map((n) => {
      const title = n.title ?? "";
      const summary = n.summary ?? "";
      const cls = classify(title, summary);
      const ts =
        typeof n.providerPublishTime === "number"
          ? new Date(n.providerPublishTime * 1000).toISOString()
          : new Date().toISOString();

      return {
        id: n.uuid ?? `${ticker}-${ts}-${title.slice(0, 24)}`,
        ticker,
        title,
        summary: summary || "(要約なし。元記事を参照してください)",
        source: n.publisher ?? "Yahoo Finance",
        url: n.link ?? "#",
        publishedAt: ts,
        sentiment: cls.sentiment,
        sentimentReason: cls.reason
      };
    });
}

interface FinnhubNewsItem {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  category?: string;
  related?: string;
}

async function fetchFinnhubNews(ticker: string): Promise<NewsItem[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return [];

  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(
    ticker
  )}&from=${fmt(from)}&to=${fmt(to)}&token=${key}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const items = (await res.json()) as FinnhubNewsItem[];
    return items.slice(0, 15).map((n) => {
      const cls = classify(n.headline ?? "", n.summary ?? "");
      return {
        id: `fh-${n.id}`,
        ticker,
        title: n.headline,
        summary: n.summary || "(要約なし)",
        source: n.source ?? "Finnhub",
        url: n.url,
        publishedAt: new Date(n.datetime * 1000).toISOString(),
        sentiment: cls.sentiment,
        sentimentReason: cls.reason
      };
    });
  } catch {
    return [];
  }
}

export async function fetchNews(cfg: TickerConfig): Promise<NewsItem[]> {
  const cached = cache.get(cfg.ticker);
  if (cached) return cached;

  const [yahoo, finnhub] = await Promise.all([
    fetchYahooNews(cfg.ticker),
    fetchFinnhubNews(cfg.ticker)
  ]);

  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const item of [...finnhub, ...yahoo]) {
    const key = item.url || item.title;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  merged.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const top = merged.slice(0, 12);
  cache.set(cfg.ticker, top, CACHE_TTL_MS.news);
  return top;
}

const PLACEHOLDER_RE = /^\(要約なし/;

async function ensureJapaneseSummaries(
  byTicker: Record<string, NewsItem[]>
): Promise<void> {
  if (!process.env.GEMINI_API_KEY) return;
  const all = Object.values(byTicker).flat();
  const needs = all.filter(
    (n) => !n.summary || PLACEHOLDER_RE.test(n.summary) || /^[\x00-\x7F\s]+$/.test(n.summary)
  );
  if (needs.length === 0) return;

  const translations = await translateNewsBatch(needs);
  if (Object.keys(translations).length === 0) return;
  for (const item of all) {
    const ja = translations[item.id];
    if (ja) item.summary = ja;
  }
}

export async function fetchAllNews(
  cfgs: TickerConfig[]
): Promise<Record<string, NewsItem[]>> {
  const entries = await Promise.all(
    cfgs.map(async (c) => [c.ticker, await fetchNews(c)] as const)
  );
  const byTicker = Object.fromEntries(entries);
  await ensureJapaneseSummaries(byTicker);
  return byTicker;
}
