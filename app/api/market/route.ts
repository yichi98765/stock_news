import { NextResponse } from "next/server";
import { fetchMarketOverview } from "@/lib/providers/marketProvider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const market = await fetchMarketOverview();
  return NextResponse.json(market);
}
