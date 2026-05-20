import type {
  DailySummary,
  MarketOverview,
  NewsItem,
  PerTickerSummary,
  SummaryFallbackReason,
  StockQuote
} from "../types";

function describeMove(pct: number | null): { headline: string; verb: string } {
  if (pct == null) {
    return { headline: "株価データ取得不可", verb: "現状把握できず" };
  }
  if (pct >= 3) return { headline: `大幅上昇 (${pct.toFixed(2)}%)`, verb: "大きく上昇している" };
  if (pct >= 1) return { headline: `上昇 (${pct.toFixed(2)}%)`, verb: "上昇している" };
  if (pct >= 0.05) return { headline: `小幅高 (${pct.toFixed(2)}%)`, verb: "小幅に上げている" };
  if (pct <= -3) return { headline: `大幅下落 (${pct.toFixed(2)}%)`, verb: "大きく下げている" };
  if (pct <= -1) return { headline: `下落 (${pct.toFixed(2)}%)`, verb: "下げている" };
  if (pct <= -0.05) return { headline: `小幅安 (${pct.toFixed(2)}%)`, verb: "小幅に下げている" };
  return { headline: `ほぼ横ばい (${pct.toFixed(2)}%)`, verb: "ほぼ横ばいで推移している" };
}

function pickEvidence(news: NewsItem[], direction: "up" | "down" | "neutral") {
  const sorted = [...news].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const matching = sorted.filter((n) => n.sentiment === direction);
  const fallback = sorted.slice(0, 3);
  const picks = (matching.length > 0 ? matching : fallback).slice(0, 3);
  return picks.map((n) => ({ title: n.title, url: n.url, source: n.source }));
}

export function buildPerTickerSummary(
  quote: StockQuote,
  news: NewsItem[],
  market: MarketOverview
): PerTickerSummary {
  const move = describeMove(quote.changePercent);
  const direction =
    (quote.changePercent ?? 0) > 0.05
      ? "up"
      : (quote.changePercent ?? 0) < -0.05
      ? "down"
      : "neutral";

  const evidence = pickEvidence(news, direction);

  const marketContext = market.themes.slice(0, 2).join(" / ");
  const newsContext =
    evidence.length > 0
      ? `関連ニュースとして「${evidence[0].title}」(${evidence[0].source}) などが報じられている`
      : "目立った個別ニュースは検出されていない";

  const reasoning = [
    `${quote.displayName} (${quote.ticker}) は本日 ${move.verb}。`,
    `${newsContext}。`,
    marketContext
      ? `市場全体の動きとしては「${marketContext}」が観測されており、これらが地合いとして影響している可能性がある。`
      : "市場全体は明確な方向感が薄い可能性がある。",
    "本要約はルールベースで自動生成された推定であり、断定的な投資助言ではない。"
  ].join("");

  return {
    ticker: quote.ticker,
    displayName: quote.displayName,
    changePercent: quote.changePercent,
    headline: move.headline,
    reasoning,
    evidence,
    confidence: evidence.length >= 2 ? "medium" : "low"
  };
}

export function buildMarketHeadline(market: MarketOverview): string {
  const sp = market.indices.find((i) => i.ticker === "^GSPC")?.changePercent ?? null;
  const nasdaq = market.indices.find((i) => i.ticker === "^IXIC")?.changePercent ?? null;
  const dow = market.indices.find((i) => i.ticker === "^DJI")?.changePercent ?? null;

  const fmt = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
  return `S&P500 ${fmt(sp)} / NASDAQ ${fmt(nasdaq)} / Dow ${fmt(dow)}。${market.themes[0] ?? ""}`;
}

export function buildRuleBasedSummary(
  quotes: StockQuote[],
  newsByTicker: Record<string, NewsItem[]>,
  market: MarketOverview,
  fallbackReason?: SummaryFallbackReason
): DailySummary {
  return {
    generatedAt: new Date().toISOString(),
    generatedBy: "rule-based",
    fallbackReason,
    marketHeadline: buildMarketHeadline(market),
    perTicker: quotes.map((q) =>
      buildPerTickerSummary(q, newsByTicker[q.ticker] ?? [], market)
    )
  };
}
