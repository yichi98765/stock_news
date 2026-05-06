import { NextResponse } from "next/server";
import { fetchMacroNews } from "@/lib/providers/macroNewsProvider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const categories = await fetchMacroNews();
  return NextResponse.json({ categories, fetchedAt: new Date().toISOString() });
}
