export type Sentiment = "up" | "down" | "neutral";
export type NewsImportance = "high" | "medium" | "low";
export type ChartRange = "1d" | "5d" | "1mo" | "6mo";

export interface TickerConfig {
  ticker: string;
  displayName: string;
  sectorTagsJa: string[];
}

export interface StockQuote {
  ticker: string;
  displayName: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string;
  marketState: string | null;
  fetchedAt: string;
  source: string;
  postMarketPrice: number | null;
  postMarketChange: number | null;
  postMarketChangePercent: number | null;
  postMarketTime: string | null;
  preMarketPrice: number | null;
  preMarketChangePercent: number | null;
  error?: string;
}

export interface NewsItem {
  id: string;
  ticker: string | null;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: Sentiment;
  sentimentReason: string;
  importance: NewsImportance;
  importanceScore: number;
  importanceReason: string;
}

export interface ChartPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  value: number;
  volume: number | null;
}

export interface PortfolioSnapshot {
  date: string;
  savedAt: string;
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number | null;
  marketHeadline: string;
  rows: {
    ticker: string;
    displayName: string;
    shares: number;
    costBasis: number;
    price: number | null;
    marketValue: number;
    pnl: number;
    pnlPercent: number | null;
  }[];
}

export interface MarketIndex {
  ticker: string;
  displayName: string;
  price: number | null;
  changePercent: number | null;
}

export interface SectorPerformance {
  sectorJa: string;
  etfTicker: string;
  changePercent: number | null;
}

export interface MarketOverview {
  indices: MarketIndex[];
  sectors: SectorPerformance[];
  themes: string[];
  fetchedAt: string;
}

export interface PerTickerSummary {
  ticker: string;
  displayName: string;
  changePercent: number | null;
  headline: string;
  reasoning: string;
  evidence: { title: string; url: string; source: string }[];
  confidence: "low" | "medium" | "high";
}

export interface DailySummary {
  generatedAt: string;
  generatedBy: "rule-based" | "anthropic" | "openai" | "gemini";
  marketHeadline: string;
  perTicker: PerTickerSummary[];
}
