import { NextResponse } from "next/server";
import { CACHE_TTL_MS, getTickers } from "@/lib/config";
import { fetchQuotes } from "@/lib/providers/stockProvider";
import { fetchAllNews } from "@/lib/providers/newsProvider";
import { fetchMarketOverview } from "@/lib/providers/marketProvider";
import { summarize } from "@/lib/ai/summarizer";
import { createTtlCache } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cache = createTtlCache<unknown>();
const CACHE_KEY = "__summary__";

export async function GET() {
  const cached = cache.get(CACHE_KEY);
  if (cached) return NextResponse.json(cached);

  const tickers = getTickers();
  const [quotes, newsByTicker, market] = await Promise.all([
    fetchQuotes(tickers),
    fetchAllNews(tickers),
    fetchMarketOverview()
  ]);

  const summary = await summarize({ quotes, newsByTicker, market });

  const payload = { summary, quotes, newsByTicker, market };
  cache.set(CACHE_KEY, payload, CACHE_TTL_MS.summary);
  return NextResponse.json(payload);
}
