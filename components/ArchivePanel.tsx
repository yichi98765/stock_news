"use client";

import type { PortfolioSnapshot } from "@/lib/types";
import { classNames, formatPercent, formatPrice, timeJa, trendOf } from "@/lib/utils";

export function ArchivePanel({
  archives,
  onSaveToday,
  onDelete
}: {
  archives: PortfolioSnapshot[];
  onSaveToday: () => void;
  onDelete: (date: string) => void;
}) {
  const latest = archives[0];
  const previous = archives[1];
  const delta =
    latest && previous ? latest.totalValue - previous.totalValue : null;
  const deltaPercent =
    latest && previous && previous.totalValue !== 0
      ? (delta! / previous.totalValue) * 100
      : null;

  return (
    <section className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">日次アーカイブ</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            今日の要約と保有損益を日付ごとに保存します。
          </p>
        </div>
        <button
          type="button"
          onClick={onSaveToday}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          今日を保存
        </button>
      </div>

      {latest && (
        <div className="grid gap-2 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800 sm:grid-cols-3">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">最新評価額</div>
            <div className="font-semibold tabular-nums">{formatPrice(latest.totalValue, "USD")}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">評価損益</div>
            <div
              className={classNames(
                "font-semibold tabular-nums",
                trendOf(latest.totalPnlPercent) === "up" && "text-up",
                trendOf(latest.totalPnlPercent) === "down" && "text-down"
              )}
            >
              {formatPrice(latest.totalPnl, "USD")} ({formatPercent(latest.totalPnlPercent)})
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">前回保存比</div>
            <div
              className={classNames(
                "font-semibold tabular-nums",
                trendOf(deltaPercent) === "up" && "text-up",
                trendOf(deltaPercent) === "down" && "text-down",
                trendOf(deltaPercent) === "neutral" && "text-slate-500"
              )}
            >
              {delta == null ? "—" : formatPrice(delta, "USD")} ({formatPercent(deltaPercent)})
            </div>
          </div>
        </div>
      )}

      {archives.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          まだ保存された日次データはありません。
        </div>
      ) : (
        <div className="grid gap-2">
          {archives.slice(0, 10).map((snapshot) => (
            <div
              key={snapshot.date}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
            >
              <div className="min-w-0">
                <div className="font-semibold">{snapshot.date}</div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {snapshot.marketHeadline}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  保存 {timeJa(snapshot.savedAt)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold tabular-nums">
                  {formatPrice(snapshot.totalValue, "USD")}
                </div>
                <div
                  className={classNames(
                    "text-xs tabular-nums",
                    trendOf(snapshot.totalPnlPercent) === "up" && "text-up",
                    trendOf(snapshot.totalPnlPercent) === "down" && "text-down",
                    trendOf(snapshot.totalPnlPercent) === "neutral" && "text-slate-500"
                  )}
                >
                  {formatPercent(snapshot.totalPnlPercent)}
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(snapshot.date)}
                  className="mt-1 text-xs font-medium text-slate-500 hover:text-down"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
