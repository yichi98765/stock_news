"use client";

import type { MarketOverview as MarketOverviewType } from "@/lib/types";
import { classNames, formatPercent, formatPrice, trendOf } from "@/lib/utils";

function ChangePill({ pct }: { pct: number | null }) {
  const trend = trendOf(pct);
  return (
    <span
      className={classNames(
        "badge tabular-nums",
        trend === "up" && "badge-up",
        trend === "down" && "badge-down",
        trend === "neutral" && "badge-neutral"
      )}
    >
      {formatPercent(pct)}
    </span>
  );
}

export function MarketOverview({ market }: { market: MarketOverviewType }) {
  return (
    <section className="card flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold sm:text-lg">市場全体</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          主要指数 / セクターETF
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {market.indices.map((i) => (
          <div
            key={i.ticker}
            className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {i.displayName}
            </div>
            <div className="mt-1 text-sm font-semibold tabular-nums">
              {formatPrice(i.price, "USD")}
            </div>
            <div className="mt-1">
              <ChangePill pct={i.changePercent} />
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">セクター動向 (代表ETF)</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {market.sectors.map((s) => (
            <div
              key={s.etfTicker}
              className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800"
            >
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {s.etfTicker}
                </div>
                <div className="text-sm font-medium">{s.sectorJa}</div>
              </div>
              <ChangePill pct={s.changePercent} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">推定される市場テーマ</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
          {market.themes.map((t, idx) => (
            <li key={idx}>{t}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          ※ ETFの値動きから自動的に推定されたテーマであり、確定的な解釈ではありません。
        </p>
      </div>
    </section>
  );
}
