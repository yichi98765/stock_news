import yahooFinance from "yahoo-finance2";
import type { StockQuote, TickerConfig } from "../types";
import { CACHE_TTL_MS } from "../config";
import { createTtlCache } from "../utils";

yahooFinance.suppressNotices?.(["yahooSurvey"]);

const cache = createTtlCache<StockQuote>();

interface QuoteCore {
  price: number | null;
  previousClose: number | null;
  currency: string;
  displayName: string | null;
  marketState: string | null;
  source: string;
}

async function viaQuote(ticker: string): Promise<QuoteCore | null> {
  try {
    const q = await yahooFinance.quote(ticker);
    return {
      price: (q.regularMarketPrice as number | undefined) ?? null,
      previousClose: (q.regularMarketPreviousClose as number | undefined) ?? null,
      currency: (q.currency as string | undefined) ?? "USD",
      displayName: (q.shortName as string | undefined) || (q.longName as string | undefined) || null,
      marketState: (q.marketState as string | undefined) ?? null,
      source: "Yahoo Finance (quote)"
    };
  } catch (e) {
    console.warn(`[stockProvider] viaQuote(${ticker}) failed:`, (e as Error).message);
    return null;
  }
}

async function viaYahooQuery1Chart(ticker: string): Promise<QuoteCore | null> {
  try {
    const period1 = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const period2 = Math.floor(Date.now() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?interval=1d&period1=${period1}&period2=${period2}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      chart?: { result?: { meta?: Record<string, unknown> }[]; error?: unknown };
    };
    const meta = data.chart?.result?.[0]?.meta as
      | {
          regularMarketPrice?: number;
          chartPreviousClose?: number;
          previousClose?: number;
          currency?: string;
          shortName?: string;
          longName?: string;
        }
      | undefined;
    if (!meta) return null;
    return {
      price: meta.regularMarketPrice ?? null,
      previousClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
      currency: meta.currency ?? "USD",
      displayName: meta.shortName ?? meta.longName ?? null,
      marketState: null,
      source: "Yahoo Finance (query1 chart)"
    };
  } catch (e) {
    console.warn(`[stockProvider] viaYahooQuery1Chart(${ticker}) failed:`, (e as Error).message);
    return null;
  }
}

async function viaStooq(ticker: string): Promise<QuoteCore | null> {
  try {
    const sym = `${ticker.toLowerCase()}.us`;
    const snapUrl = `https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=csv`;
    const snapRes = await fetch(snapUrl, { cache: "no-store" });
    if (!snapRes.ok) return null;
    const snapText = await snapRes.text();
    const lines = snapText.trim().split(/\r?\n/);
    if (lines.length < 2) return null;
    const fields = lines[1].split(",");
    const close = parseFloat(fields[6]);
    if (!Number.isFinite(close) || close <= 0) return null;

    let prevClose: number | null = null;
    try {
      const today = new Date();
      const past = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
      const fmt = (d: Date) =>
        `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
          d.getUTCDate()
        ).padStart(2, "0")}`;
      const histUrl = `https://stooq.com/q/d/l/?s=${sym}&d1=${fmt(past)}&d2=${fmt(today)}&i=d`;
      const histRes = await fetch(histUrl, { cache: "no-store" });
      const histText = histRes.ok ? await histRes.text() : "";
      const histLines = histText.trim().split(/\r?\n/).slice(1);
      if (histLines.length >= 2 && !histText.startsWith("Get your apikey")) {
        const prevFields = histLines[histLines.length - 2].split(",");
        const prev = parseFloat(prevFields[4]);
        if (Number.isFinite(prev) && prev > 0) prevClose = prev;
      }
    } catch {
      // ignore
    }

    return {
      price: close,
      previousClose: prevClose,
      currency: "USD",
      displayName: null,
      marketState: null,
      source: "Stooq"
    };
  } catch (e) {
    console.warn(`[stockProvider] viaStooq(${ticker}) failed:`, (e as Error).message);
    return null;
  }
}

async function viaChart(ticker: string): Promise<QuoteCore | null> {
  try {
    const period1 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const c = (await yahooFinance.chart(ticker, { interval: "1d", period1 })) as unknown as {
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        currency?: string;
        shortName?: string;
        longName?: string;
      };
    };
    const meta = c.meta;
    if (!meta) {
      console.warn(`[stockProvider] viaChart(${ticker}) returned no meta. keys=`, Object.keys(c));
      return null;
    }
    return {
      price: meta.regularMarketPrice ?? null,
      previousClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
      currency: meta.currency ?? "USD",
      displayName: meta.shortName ?? meta.longName ?? null,
      marketState: null,
      source: "Yahoo Finance (chart)"
    };
  } catch (e) {
    console.warn(`[stockProvider] viaChart(${ticker}) failed:`, (e as Error).message);
    return null;
  }
}

export async function fetchQuote(cfg: TickerConfig): Promise<StockQuote> {
  const cached = cache.get(cfg.ticker);
  if (cached) return cached;

  const core =
    (await viaYahooQuery1Chart(cfg.ticker)) ??
    (await viaQuote(cfg.ticker)) ??
    (await viaChart(cfg.ticker)) ??
    (await viaStooq(cfg.ticker));

  if (!core) {
    return {
      ticker: cfg.ticker,
      displayName: cfg.displayName,
      price: null,
      previousClose: null,
      change: null,
      changePercent: null,
      currency: "USD",
      marketState: null,
      fetchedAt: new Date().toISOString(),
      source: "Yahoo Finance",
      error: "Yahoo Finance から株価を取得できませんでした (Rate Limit など)"
    };
  }

  const change =
    core.price != null && core.previousClose != null ? core.price - core.previousClose : null;
  const changePercent =
    core.price != null && core.previousClose != null && core.previousClose !== 0
      ? ((core.price - core.previousClose) / core.previousClose) * 100
      : null;

  const quote: StockQuote = {
    ticker: cfg.ticker,
    displayName: core.displayName || cfg.displayName,
    price: core.price,
    previousClose: core.previousClose,
    change,
    changePercent,
    currency: core.currency,
    marketState: core.marketState,
    fetchedAt: new Date().toISOString(),
    source: core.source
  };

  cache.set(cfg.ticker, quote, CACHE_TTL_MS.quote);
  return quote;
}

export async function fetchQuotes(cfgs: TickerConfig[]): Promise<StockQuote[]> {
  return Promise.all(cfgs.map(fetchQuote));
}
