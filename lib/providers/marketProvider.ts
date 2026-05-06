import yahooFinance from "yahoo-finance2";
import type { MarketIndex, MarketOverview, SectorPerformance } from "../types";
import { CACHE_TTL_MS, MARKET_INDICES, SECTOR_ETFS } from "../config";
import { createTtlCache } from "../utils";

const cache = createTtlCache<MarketOverview>();
const KEY = "__market__";

async function viaYahooQuery1Chart(ticker: string) {
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
      };
    };
    const result = data.chart?.result?.[0];
    const meta = result?.meta as
      | { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number }
      | undefined;
    if (!meta) return null;

    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const validCloses = closes.filter((c): c is number => typeof c === "number" && c > 0);
    const prevFromBars =
      validCloses.length >= 2 ? validCloses[validCloses.length - 2] : null;

    return {
      price: meta.regularMarketPrice ?? validCloses[validCloses.length - 1] ?? null,
      prev: prevFromBars ?? meta.previousClose ?? meta.chartPreviousClose ?? null
    };
  } catch {
    return null;
  }
}

async function viaQuote(ticker: string) {
  try {
    const q = await yahooFinance.quote(ticker);
    return {
      price: (q.regularMarketPrice as number | undefined) ?? null,
      prev: (q.regularMarketPreviousClose as number | undefined) ?? null
    };
  } catch {
    return null;
  }
}

async function viaChart(ticker: string) {
  try {
    const period1 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const c = await yahooFinance.chart(ticker, { interval: "1d", period1 });
    const meta = c.meta as
      | { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number }
      | undefined;
    if (!meta) return null;
    return {
      price: meta.regularMarketPrice ?? null,
      prev: meta.chartPreviousClose ?? meta.previousClose ?? null
    };
  } catch {
    return null;
  }
}

async function quotePctChange(
  ticker: string
): Promise<{ price: number | null; changePercent: number | null }> {
  const core =
    (await viaYahooQuery1Chart(ticker)) ?? (await viaQuote(ticker)) ?? (await viaChart(ticker));
  if (!core) return { price: null, changePercent: null };
  const { price, prev } = core;
  const changePercent =
    typeof price === "number" && typeof prev === "number" && prev !== 0
      ? ((price - prev) / prev) * 100
      : null;
  return { price, changePercent };
}

function inferThemes(
  indices: MarketIndex[],
  sectors: SectorPerformance[]
): string[] {
  const themes: string[] = [];
  const idx = (t: string) => indices.find((i) => i.ticker === t)?.changePercent ?? 0;
  const sec = (t: string) => sectors.find((s) => s.etfTicker === t)?.changePercent ?? 0;

  const nasdaq = idx("^IXIC");
  const dow = idx("^DJI");
  const rut = idx("^RUT");
  const tech = sec("XLK");
  const semis = sec("SOXX");
  const cons = sec("XLY");
  const fin = sec("XLF");
  const energy = sec("XLE");
  const health = sec("XLV");

  if (nasdaq > 0.5 && nasdaq > dow + 0.3) {
    themes.push("NASDAQ優位 (グロース・テック株にリスクオン傾向の可能性)");
  }
  if (dow > 0.5 && dow > nasdaq + 0.3) {
    themes.push("ダウ優位 (バリュー・ディフェンシブへのローテーションの可能性)");
  }
  if (semis > 1) themes.push("半導体セクター強い (AI関連株への資金流入の可能性)");
  if (semis < -1) themes.push("半導体セクター弱い (AI関連株に利益確定売りの可能性)");
  if (tech > 1) themes.push("テックセクター全体が強い");
  if (tech < -1) themes.push("テックセクター全体に売り圧力");
  if (cons < -1) themes.push("一般消費財セクター弱い (EV・消費関連に逆風の可能性)");
  if (cons > 1) themes.push("一般消費財セクター強い (EV含め消費関連に追い風の可能性)");
  if (fin > 1) themes.push("金融セクター強い (金利上昇・景気回復観測の可能性)");
  if (energy > 1) themes.push("エネルギーセクター強い (原油高・地政学要因の可能性)");
  if (health > 1) themes.push("ヘルスケアがディフェンシブ買いを集める可能性");
  if (rut < -1 && nasdaq > 0)
    themes.push("ラッセル2000弱含み (大型優位・小型株は資金流出の可能性)");

  if (themes.length === 0) {
    themes.push("セクターローテーションは目立たず、明確な方向感は出ていない可能性");
  }

  return themes;
}

export async function fetchMarketOverview(): Promise<MarketOverview> {
  const cached = cache.get(KEY);
  if (cached) return cached;

  const [indices, sectors] = await Promise.all([
    Promise.all(
      MARKET_INDICES.map(async (m) => {
        const { price, changePercent } = await quotePctChange(m.ticker);
        return {
          ticker: m.ticker,
          displayName: m.displayName,
          price,
          changePercent
        } satisfies MarketIndex;
      })
    ),
    Promise.all(
      SECTOR_ETFS.map(async (s) => {
        const { changePercent } = await quotePctChange(s.etfTicker);
        return {
          etfTicker: s.etfTicker,
          sectorJa: s.sectorJa,
          changePercent
        } satisfies SectorPerformance;
      })
    )
  ]);

  const overview: MarketOverview = {
    indices,
    sectors,
    themes: inferThemes(indices, sectors),
    fetchedAt: new Date().toISOString()
  };

  cache.set(KEY, overview, CACHE_TTL_MS.market);
  return overview;
}
