import { NextResponse } from "next/server";
import { getTickers } from "@/lib/config";
import { fetchAllNews } from "@/lib/providers/newsProvider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tickers = getTickers();
  const newsByTicker = await fetchAllNews(tickers);
  return NextResponse.json({ newsByTicker, fetchedAt: new Date().toISOString() });
}
