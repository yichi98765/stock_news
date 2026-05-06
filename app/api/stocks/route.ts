import { NextResponse } from "next/server";
import { getTickers } from "@/lib/config";
import { fetchQuotes } from "@/lib/providers/stockProvider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tickers = getTickers();
  const quotes = await fetchQuotes(tickers);
  return NextResponse.json({ quotes, fetchedAt: new Date().toISOString() });
}
