import { NextResponse } from "next/server";
import { getTickersFromSearchParam } from "@/lib/config";
import { fetchQuotes } from "@/lib/providers/stockProvider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tickers = getTickersFromSearchParam(url.searchParams.get("tickers"));
  const quotes = await fetchQuotes(tickers);
  return NextResponse.json({ quotes, fetchedAt: new Date().toISOString() });
}
