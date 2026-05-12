import { NextResponse } from "next/server";
import { CACHE_TTL_MS, getTickersFromSearchParam } from "@/lib/config";
import { fetchQuotes } from "@/lib/providers/stockProvider";
import { fetchAllNews } from "@/lib/providers/newsProvider";
import { fetchMarketOverview } from "@/lib/providers/marketProvider";
import { summarize } from "@/lib/ai/summarizer";
import { buildRuleBasedSummary } from "@/lib/ai/ruleBased";
import { createTtlCache } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cache = createTtlCache<unknown>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tickers = getTickersFromSearchParam(url.searchParams.get("tickers"));
  const fast = url.searchParams.get("fast") === "1";
  const cacheKey = `${fast ? "fast" : "full"}:${tickers.map((t) => t.ticker).join(",")}`;
  const cached = cache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  const [quotes, newsByTicker, market] = await Promise.all([
    fetchQuotes(tickers),
    fetchAllNews(tickers, { enhance: !fast, translate: !fast }),
    fetchMarketOverview()
  ]);

  const summary = fast
    ? buildRuleBasedSummary(quotes, newsByTicker, market)
    : await summarize({ quotes, newsByTicker, market });

  const payload = { summary, quotes, newsByTicker, market, fast };
  cache.set(cacheKey, payload, CACHE_TTL_MS.summary);
  return NextResponse.json(payload);
}
