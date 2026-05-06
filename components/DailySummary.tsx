"use client";

import type { DailySummary as DailySummaryType } from "@/lib/types";
import { classNames, formatPercent, trendOf } from "@/lib/utils";

const CONFIDENCE_LABEL: Record<string, string> = {
  low: "信頼度: 低",
  medium: "信頼度: 中",
  high: "信頼度: 高"
};

const GENERATED_BY_LABEL: Record<string, string> = {
  "rule-based": "ルールベース自動生成",
  gemini: "Gemini による要約",
  anthropic: "Claude による要約",
  openai: "OpenAI による要約"
};

export function DailySummary({ summary }: { summary: DailySummaryType }) {
  return (
    <section className="card flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold sm:text-lg">今日の要約</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {GENERATED_BY_LABEL[summary.generatedBy] ?? summary.generatedBy}
        </span>
      </div>

      <div className="rounded-xl bg-slate-100 p-3 text-sm leading-relaxed dark:bg-slate-800">
        <div className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          市場ヘッドライン
        </div>
        {summary.marketHeadline}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {summary.perTicker.map((p) => {
          const trend = trendOf(p.changePercent);
          return (
            <div
              key={p.ticker}
              className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{p.ticker}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {p.displayName}
                  </span>
                </div>
                <span
                  className={classNames(
                    "badge tabular-nums",
                    trend === "up" && "badge-up",
                    trend === "down" && "badge-down",
                    trend === "neutral" && "badge-neutral"
                  )}
                >
                  {formatPercent(p.changePercent)}
                </span>
              </div>

              <div className="mt-2 text-sm font-semibold">{p.headline}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {p.reasoning}
              </p>

              {p.evidence.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    根拠ニュース
                  </div>
                  <ul className="mt-1 space-y-1 text-xs">
                    {p.evidence.map((e, idx) => (
                      <li key={idx}>
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-700 hover:underline dark:text-slate-200"
                        >
                          {e.title}
                        </a>{" "}
                        <span className="text-slate-500 dark:text-slate-400">
                          ({e.source})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {CONFIDENCE_LABEL[p.confidence]}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
