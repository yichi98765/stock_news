import { NextResponse } from "next/server";
import type { ChartPoint, ChartRange } from "@/lib/types";
import { createTtlCache } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cache = createTtlCache<{
  ticker: string;
  range: ChartRange;
  includePrePost: boolean;
  previousClose: number | null;
  points: ChartPoint[];
  fetchedAt: string;
}>();

const RANGE_CONFIG: Record<ChartRange, { yahooRange: string; interval: string; ttlMs: number }> = {
  "1d": { yahooRange: "1d", interval: "5m", ttlMs: 60_000 },
  "5d": { yahooRange: "5d", interval: "15m", ttlMs: 2 * 60_000 },
  "1mo": { yahooRange: "1mo", interval: "1d", ttlMs: 5 * 60_000 },
  "6mo": { yahooRange: "6mo", interval: "1d", ttlMs: 10 * 60_000 }
};

function isChartRange(value: string | null): value is ChartRange {
  return value === "1d" || value === "5d" || value === "1mo" || value === "6mo";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticker = (url.searchParams.get("ticker") ?? "").trim().toUpperCase();
  const rawRange = url.searchParams.get("range");
  const range: ChartRange = isChartRange(rawRange) ? rawRange : "5d";
  const includePrePost = url.searchParams.get("prepost") === "1";

  if (!/^[A-Z0-9.^-]{1,12}$/.test(ticker)) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }

  const cacheKey = `${ticker}:${range}:${includePrePost ? "prepost" : "regular"}`;
  const cached = cache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  const cfg = RANGE_CONFIG[range];
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?range=${cfg.yahooRange}&interval=${cfg.interval}&includePrePost=${includePrePost ? "true" : "false"}`;

  const res = await fetch(chartUrl, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Yahoo Finance HTTP ${res.status}` }, { status: 502 });
  }

  const data = (await res.json()) as {
    chart?: {
      result?: {
        meta?: { previousClose?: number; chartPreviousClose?: number };
        timestamp?: number[];
        indicators?: {
          quote?: {
            open?: (number | null)[];
            high?: (number | null)[];
            low?: (number | null)[];
            close?: (number | null)[];
            volume?: (number | null)[];
          }[];
        };
      }[];
      error?: { description?: string };
    };
  };

  const result = data.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const opens = quote?.open ?? [];
  const highs = quote?.high ?? [];
  const lows = quote?.low ?? [];
  const closes = quote?.close ?? [];
  const volumes = quote?.volume ?? [];
  const points: ChartPoint[] = timestamps
    .map((ts, idx) => {
      const close = closes[idx];
      if (typeof close !== "number" || close <= 0) return null;
      const open = typeof opens[idx] === "number" && opens[idx]! > 0 ? opens[idx]! : close;
      const high = typeof highs[idx] === "number" && highs[idx]! > 0 ? highs[idx]! : close;
      const low = typeof lows[idx] === "number" && lows[idx]! > 0 ? lows[idx]! : close;
      const volume = typeof volumes[idx] === "number" && volumes[idx]! >= 0 ? volumes[idx]! : null;
      return {
        time: new Date(ts * 1000).toISOString(),
        open,
        high,
        low,
        close,
        value: close,
        volume
      };
    })
    .filter((p): p is ChartPoint => p !== null);

  const previousClose =
    result?.meta?.previousClose ?? result?.meta?.chartPreviousClose ?? null;
  const payload = {
    ticker,
    range,
    includePrePost,
    previousClose,
    points,
    fetchedAt: new Date().toISOString()
  };
  cache.set(cacheKey, payload, cfg.ttlMs);
  return NextResponse.json(payload);
}
