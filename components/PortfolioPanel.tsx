"use client";

import type { StockQuote } from "@/lib/types";
import { classNames, formatPercent, formatPrice, trendOf } from "@/lib/utils";

export interface HoldingInput {
  shares: number;
  costBasis: number;
}

export type Holdings = Record<string, HoldingInput>;

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function PortfolioPanel({
  quotes,
  holdings,
  onChange
}: {
  quotes: StockQuote[];
  holdings: Holdings;
  onChange: (next: Holdings) => void;
}) {
  const rows = quotes.map((quote) => {
    const holding = holdings[quote.ticker] ?? { shares: 0, costBasis: 0 };
    const price = quote.price ?? 0;
    const marketValue = holding.shares * price;
    const cost = holding.shares * holding.costBasis;
    const pnl = marketValue - cost;
    const pnlPercent = cost > 0 ? (pnl / cost) * 100 : null;
    return { quote, holding, marketValue, cost, pnl, pnlPercent };
  });
  const totalValue = rows.reduce((sum, row) => sum + row.marketValue, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : null;

  const updateHolding = (ticker: string, key: keyof HoldingInput, value: string) => {
    const current = holdings[ticker] ?? { shares: 0, costBasis: 0 };
    onChange({
      ...holdings,
      [ticker]: { ...current, [key]: toNumber(value) }
    });
  };

  return (
    <section className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">保有ポートフォリオ</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            数量と取得単価はこの端末の localStorage に保存されます。
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold tabular-nums">{formatPrice(totalValue, "USD")}</div>
          <div
            className={classNames(
              "text-xs tabular-nums",
              trendOf(totalPnlPercent) === "up" && "text-up",
              trendOf(totalPnlPercent) === "down" && "text-down",
              trendOf(totalPnlPercent) === "neutral" && "text-slate-500"
            )}
          >
            {formatPrice(totalPnl, "USD")} ({formatPercent(totalPnlPercent)})
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[640px] text-sm">
          <thead className="text-left text-xs text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-2 pr-3 font-medium">銘柄</th>
              <th className="py-2 pr-3 font-medium">数量</th>
              <th className="py-2 pr-3 font-medium">取得単価</th>
              <th className="py-2 pr-3 text-right font-medium">評価額</th>
              <th className="py-2 pr-3 text-right font-medium">評価損益</th>
              <th className="py-2 text-right font-medium">比率</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map(({ quote, holding, marketValue, pnl, pnlPercent }) => {
              const trend = trendOf(pnlPercent);
              const allocation = totalValue > 0 ? (marketValue / totalValue) * 100 : null;
              return (
                <tr key={quote.ticker}>
                  <td className="py-2 pr-3">
                    <div className="font-semibold">{quote.ticker}</div>
                    <div className="max-w-[10rem] truncate text-xs text-slate-500 dark:text-slate-400">
                      {quote.displayName}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={holding.shares || ""}
                      onChange={(e) => updateHolding(quote.ticker, "shares", e.target.value)}
                      className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right tabular-nums dark:border-slate-700 dark:bg-slate-900"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={holding.costBasis || ""}
                      onChange={(e) => updateHolding(quote.ticker, "costBasis", e.target.value)}
                      className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right tabular-nums dark:border-slate-700 dark:bg-slate-900"
                    />
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatPrice(marketValue, "USD")}
                  </td>
                  <td
                    className={classNames(
                      "py-2 pr-3 text-right tabular-nums",
                      trend === "up" && "text-up",
                      trend === "down" && "text-down",
                      trend === "neutral" && "text-slate-500"
                    )}
                  >
                    {formatPrice(pnl, "USD")}
                    <div className="text-xs">{formatPercent(pnlPercent)}</div>
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatPercent(allocation)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
