import { NextResponse } from "next/server";
import { getTickersFromSearchParam } from "@/lib/config";
import { fetchAllNews } from "@/lib/providers/newsProvider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tickers = getTickersFromSearchParam(url.searchParams.get("tickers"));
  const newsByTicker = await fetchAllNews(tickers);
  return NextResponse.json({ newsByTicker, fetchedAt: new Date().toISOString() });
}
