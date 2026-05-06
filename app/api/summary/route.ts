import { NextResponse } from "next/server";
import { getTickers } from "@/lib/config";
import { fetchQuotes } from "@/lib/providers/stockProvider";
import { fetchAllNews } from "@/lib/providers/newsProvider";
import { fetchMarketOverview } from "@/lib/providers/marketProvider";
import { summarize } from "@/lib/ai/summarizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tickers = getTickers();
  const [quotes, newsByTicker, market] = await Promise.all([
    fetchQuotes(tickers),
    fetchAllNews(tickers),
    fetchMarketOverview()
  ]);

  const summary = await summarize({ quotes, newsByTicker, market });

  return NextResponse.json({
    summary,
    quotes,
    newsByTicker,
    market
  });
}
