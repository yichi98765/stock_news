export type Sentiment = "up" | "down" | "neutral";

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
  generatedBy: "rule-based" | "anthropic" | "openai";
  marketHeadline: string;
  perTicker: PerTickerSummary[];
}
