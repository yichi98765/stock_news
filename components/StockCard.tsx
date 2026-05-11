"use client";

import type { StockQuote } from "@/lib/types";
import {
  classNames,
  formatChange,
  formatPercent,
  formatPrice,
  trendOf
} from "@/lib/utils";
import { StockChart } from "./StockChart";

const TREND_COLOR: Record<string, string> = {
  up: "text-up",
  down: "text-down",
  neutral: "text-slate-500"
};

const TREND_SYMBOL: Record<string, string> = {
  up: "▲",
  down: "▼",
  neutral: "■"
};

const TREND_LABEL: Record<string, string> = {
  up: "上昇",
  down: "下落",
  neutral: "ほぼ横ばい"
};

export function StockCard({ quote }: { quote: StockQuote }) {
  const trend = trendOf(quote.changePercent);
  const colorClass = TREND_COLOR[trend];

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {quote.ticker}
          </div>
          <div className="text-base font-semibold leading-tight">
            {quote.displayName}
          </div>
        </div>
        <span
          className={classNames(
            "badge",
            trend === "up" && "badge-up",
            trend === "down" && "badge-down",
            trend === "neutral" && "badge-neutral"
          )}
        >
          {TREND_SYMBOL[trend]} {TREND_LABEL[trend]}
        </span>
      </div>

      <div className="flex items-baseline gap-3">
        <div className="text-3xl font-bold tabular-nums">
          {formatPrice(quote.price, quote.currency)}
        </div>
        <div className={classNames("text-sm font-medium tabular-nums", colorClass)}>
          {formatChange(quote.change)} ({formatPercent(quote.changePercent)})
        </div>
      </div>

      {quote.postMarketPrice != null && (
        <div className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs dark:bg-slate-800">
          <span className="font-medium text-slate-700 dark:text-slate-200">時間外: </span>
          <span className="tabular-nums">
            {formatPrice(quote.postMarketPrice, quote.currency)}{" "}
          </span>
          <span
            className={classNames(
              "tabular-nums",
              TREND_COLOR[trendOf(quote.postMarketChangePercent)]
            )}
          >
            ({formatPercent(quote.postMarketChangePercent)})
          </span>
          {quote.postMarketTime && (
            <span className="ml-2 text-slate-500 dark:text-slate-400">
              更新: {new Date(quote.postMarketTime).toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Tokyo"
              })}
            </span>
          )}
        </div>
      )}
      {quote.preMarketPrice != null && quote.postMarketPrice == null && (
        <div className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs dark:bg-slate-800">
          <span className="font-medium text-slate-700 dark:text-slate-200">プレ市場: </span>
          <span className="tabular-nums">
            {formatPrice(quote.preMarketPrice, quote.currency)}{" "}
          </span>
          <span
            className={classNames(
              "tabular-nums",
              TREND_COLOR[trendOf(quote.preMarketChangePercent)]
            )}
          >
            ({formatPercent(quote.preMarketChangePercent)})
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span>前日終値: {formatPrice(quote.previousClose, quote.currency)}</span>
        {quote.marketState && <span>市場状態: {quote.marketState}</span>}
        <span>取得元: {quote.source}</span>
      </div>

      {!quote.error && <StockChart ticker={quote.ticker} currency={quote.currency} />}

      {quote.error && (
        <div className="rounded-md bg-down-soft px-2 py-1 text-xs text-down dark:bg-down/20">
          データ取得エラー: {quote.error}
        </div>
      )}
    </div>
  );
}
