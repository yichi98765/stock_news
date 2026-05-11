import type { NewsItem, Sentiment } from "../types";
import { CACHE_TTL_MS } from "../config";
import { createTtlCache } from "../utils";
import { translateNewsBatch } from "../ai/newsTranslator";

export interface MacroCategory {
  id: string;
  label: string;
  items: NewsItem[];
}

const QUERIES: { id: string; label: string; q: string }[] = [
  { id: "fed", label: "米金融政策・FOMC", q: "FRB OR FOMC 利下げ OR 利上げ" },
  { id: "boj", label: "日銀・日本金融政策", q: "日銀 金融政策" },
  { id: "cpi", label: "インフレ指標 (CPI/PCE)", q: "米CPI OR PCE OR インフレ" },
  { id: "jobs", label: "米雇用統計", q: "米雇用統計 OR 米労働市場" },
  { id: "japan-stocks", label: "日本株市場", q: "日経平均 OR TOPIX" },
  { id: "geopolitics", label: "地政学リスク", q: "地政学 OR 中東情勢 OR 台湾情勢" },
  { id: "ai-semi", label: "AI・半導体", q: "AI半導体 OR Nvidia OR エヌビディア" },
  { id: "ev-auto", label: "EV・自動車", q: "電気自動車 OR EV市場" }
];

const cache = createTtlCache<MacroCategory[]>();
const CACHE_KEY = "__macro__";

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const get = (tag: string): string => {
      const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
      const tm = block.match(re);
      if (!tm) return "";
      return decodeXml(tm[1].trim());
    };
    const title = get("title");
    const link = get("link");
    const pubDate = get("pubDate");
    const source = get("source");
    if (title && link) {
      items.push({ title, link, pubDate, source });
    }
  }
  return items;
}

async function fetchGoogleNews(query: string, max: number): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query
  )}&hl=ja&gl=JP&ceid=JP:ja`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!res.ok) {
      console.warn(`[macroNews] google rss status=${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseRss(xml)
      .slice(0, max)
      .map((r) => {
        const ts = r.pubDate
          ? new Date(r.pubDate).toISOString()
          : new Date().toISOString();
        return {
          id: r.link.slice(0, 200),
          ticker: null,
          title: r.title,
          summary: r.title,
          source: r.source || "Google ニュース",
          url: r.link,
          publishedAt: ts,
          sentiment: "neutral" as Sentiment,
          sentimentReason: "(マクロニュースは未分類)",
          importance: "medium",
          importanceScore: 40,
          importanceReason: "マクロカテゴリ一致"
        };
      });
  } catch (e) {
    console.warn(`[macroNews] fetch failed: ${(e as Error).message}`);
    return [];
  }
}

export async function fetchMacroNews(): Promise<MacroCategory[]> {
  const cached = cache.get(CACHE_KEY);
  if (cached) return cached;

  const categories: MacroCategory[] = await Promise.all(
    QUERIES.map(async (q) => {
      const items = await fetchGoogleNews(q.q, 5);
      const seen = new Set<string>();
      const dedup = items.filter((it) => {
        const key = it.url || it.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      dedup.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      return { id: q.id, label: q.label, items: dedup.slice(0, 3) };
    })
  );

  const allItems = categories.flatMap((c) => c.items);
  if (allItems.length > 0 && process.env.GEMINI_API_KEY) {
    const translations = await translateNewsBatch(allItems);
    for (const item of allItems) {
      const ja = translations[item.id];
      if (ja) item.summary = ja;
    }
  }

  cache.set(CACHE_KEY, categories, CACHE_TTL_MS.news);
  return categories;
}
