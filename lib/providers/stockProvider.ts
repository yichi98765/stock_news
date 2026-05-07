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
      chart?: {
        result?: {
          meta?: Record<string, unknown>;
          indicators?: { quote?: { close?: (number | null)[] }[] };
        }[];
        error?: unknown;
      };
    };
    const result = data.chart?.result?.[0];
    const meta = result?.meta as
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

    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const validCloses = closes.filter((c): c is number => typeof c === "number" && c > 0);
    const prevFromBars =
      validCloses.length >= 2 ? validCloses[validCloses.length - 2] : null;

    return {
      price: meta.regularMarketPrice ?? validCloses[validCloses.length - 1] ?? null,
      previousClose: prevFromBars ?? meta.previousClose ?? meta.chartPreviousClose ?? null,
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

interface PostMarketData {
  postMarketPrice: number | null;
  postMarketChange: number | null;
  postMarketChangePercent: number | null;
  postMarketTime: string | null;
  preMarketPrice: number | null;
  preMarketChangePercent: number | null;
}

async function fetchPostMarket(
  ticker: string,
  regularPrice: number | null
): Promise<PostMarketData | null> {
  if (regularPrice == null || regularPrice === 0) return null;
  try {
    const period2 = Math.floor(Date.now() / 1000);
    const period1 = period2 - 36 * 60 * 60;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?interval=5m&period1=${period1}&period2=${period2}&includePrePost=true`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!res.ok) {
      console.warn(`[stockProvider] fetchPostMarket(${ticker}) status=${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      chart?: {
        result?: {
          meta?: {
            regularMarketTime?: number;
            currentTradingPeriod?: { pre?: { start?: number } };
          };
          timestamp?: number[];
          indicators?: { quote?: { close?: (number | null)[] }[] };
        }[];
      };
    };
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const regTime = result.meta?.regularMarketTime;
    const preStart = result.meta?.currentTradingPeriod?.pre?.start;
    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];

    if (!regTime || timestamps.length === 0 || closes.length === 0) return null;

    let latestIdx = -1;
    for (let i = closes.length - 1; i >= 0; i--) {
      const c = closes[i];
      if (typeof c === "number" && c > 0) {
        latestIdx = i;
        break;
      }
    }
    if (latestIdx < 0) return null;

    const latestTs = timestamps[latestIdx];
    const latestClose = closes[latestIdx] as number;

    if (latestTs <= regTime) return null;

    const isPreMarket = typeof preStart === "number" && latestTs >= preStart;
    const change = latestClose - regularPrice;
    const changePercent = (change / regularPrice) * 100;

    if (isPreMarket) {
      return {
        postMarketPrice: null,
        postMarketChange: null,
        postMarketChangePercent: null,
        postMarketTime: null,
        preMarketPrice: latestClose,
        preMarketChangePercent: changePercent
      };
    }

    return {
      postMarketPrice: latestClose,
      postMarketChange: change,
      postMarketChangePercent: changePercent,
      postMarketTime: new Date(latestTs * 1000).toISOString(),
      preMarketPrice: null,
      preMarketChangePercent: null
    };
  } catch (e) {
    console.warn(`[stockProvider] fetchPostMarket(${ticker}) failed:`, (e as Error).message);
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
      postMarketPrice: null,
      postMarketChange: null,
      postMarketChangePercent: null,
      postMarketTime: null,
      preMarketPrice: null,
      preMarketChangePercent: null,
      error: "Yahoo Finance から株価を取得できませんでした (Rate Limit など)"
    };
  }

  const change =
    core.price != null && core.previousClose != null ? core.price - core.previousClose : null;
  const changePercent =
    core.price != null && core.previousClose != null && core.previousClose !== 0
      ? ((core.price - core.previousClose) / core.previousClose) * 100
      : null;

  const post = await fetchPostMarket(cfg.ticker, core.price);

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
    source: core.source,
    postMarketPrice: post?.postMarketPrice ?? null,
    postMarketChange: post?.postMarketChange ?? null,
    postMarketChangePercent: post?.postMarketChangePercent ?? null,
    postMarketTime: post?.postMarketTime ?? null,
    preMarketPrice: post?.preMarketPrice ?? null,
    preMarketChangePercent: post?.preMarketChangePercent ?? null
  };

  cache.set(cfg.ticker, quote, CACHE_TTL_MS.quote);
  return quote;
}

export async function fetchQuotes(cfgs: TickerConfig[]): Promise<StockQuote[]> {
  return Promise.all(cfgs.map(fetchQuote));
}
