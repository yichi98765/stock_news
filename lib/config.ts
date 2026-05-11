import type { TickerConfig } from "./types";

const DEFAULT_TICKERS: TickerConfig[] = [
  {
    ticker: "NBIS",
    displayName: "Nebius Group",
    sectorTagsJa: ["AIインフラ", "クラウド", "テック"]
  },
  {
    ticker: "TSLA",
    displayName: "Tesla",
    sectorTagsJa: ["EV", "自動運転", "テック"]
  }
];

const KNOWN_NAMES: Record<string, string> = {
  NBIS: "Nebius Group",
  TSLA: "Tesla",
  NVDA: "NVIDIA",
  AAPL: "Apple",
  MSFT: "Microsoft",
  GOOGL: "Alphabet (Class A)",
  AMZN: "Amazon",
  META: "Meta Platforms",
  AMD: "AMD",
  PLTR: "Palantir"
};

export function getTickers(): TickerConfig[] {
  const raw = process.env.NEXT_PUBLIC_TICKERS;
  if (!raw) return DEFAULT_TICKERS;

  const tickers = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (tickers.length === 0) return DEFAULT_TICKERS;

  return tickerConfigsFromSymbols(tickers);
}

export function tickerConfigsFromSymbols(symbols: string[]): TickerConfig[] {
  const unique = Array.from(
    new Set(
      symbols
        .map((t) => t.trim().toUpperCase())
        .filter((t) => /^[A-Z0-9.^-]{1,12}$/.test(t))
    )
  );

  if (unique.length === 0) return DEFAULT_TICKERS;

  return unique.map((ticker) => {
    const found = DEFAULT_TICKERS.find((d) => d.ticker === ticker);
    if (found) return found;
    return {
      ticker,
      displayName: KNOWN_NAMES[ticker] ?? ticker,
      sectorTagsJa: []
    };
  });
}

export function getTickersFromSearchParam(raw: string | null): TickerConfig[] {
  if (!raw) return getTickers();
  return tickerConfigsFromSymbols(raw.split(","));
}

export const MARKET_INDICES: { ticker: string; displayName: string }[] = [
  { ticker: "^GSPC", displayName: "S&P 500" },
  { ticker: "^IXIC", displayName: "NASDAQ 総合" },
  { ticker: "^DJI", displayName: "ダウ平均" },
  { ticker: "^RUT", displayName: "ラッセル2000" }
];

export const SECTOR_ETFS: { etfTicker: string; sectorJa: string }[] = [
  { etfTicker: "XLK", sectorJa: "テック" },
  { etfTicker: "SOXX", sectorJa: "半導体" },
  { etfTicker: "XLY", sectorJa: "一般消費財 (EV含む)" },
  { etfTicker: "XLF", sectorJa: "金融" },
  { etfTicker: "XLE", sectorJa: "エネルギー" },
  { etfTicker: "XLV", sectorJa: "ヘルスケア" }
];

export const CACHE_TTL_MS = {
  quote: 60_000,
  news: 5 * 60_000,
  market: 2 * 60_000,
  summary: 5 * 60_000
};
