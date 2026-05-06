"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DailySummary as DailySummaryType,
  MarketOverview as MarketOverviewType,
  NewsItem,
  StockQuote
} from "@/lib/types";
import { DailySummary } from "./DailySummary";
import { Disclaimer } from "./Disclaimer";
import { MarketOverview } from "./MarketOverview";
import { NewsCard } from "./NewsCard";
import { StockCard } from "./StockCard";
import { ThemeToggle } from "./ThemeToggle";
import { formatDateTimeJa } from "@/lib/utils";

interface SummaryResponse {
  summary: DailySummaryType;
  quotes: StockQuote[];
  newsByTicker: Record<string, NewsItem[]>;
  market: MarketOverviewType;
}

export function Dashboard() {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTicker, setActiveTicker] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/summary", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SummaryResponse;
      setData(json);
      if (json.quotes.length > 0 && !activeTicker) {
        setActiveTicker(json.quotes[0].ticker);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [activeTicker]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Stock Finder</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            米国株モニター — 日本語表示
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {loading ? "更新中…" : "更新"}
          </button>
          <ThemeToggle />
        </div>
      </header>

      {error && (
        <div className="rounded-xl bg-down-soft px-3 py-2 text-sm text-down dark:bg-down/20">
          データ取得に失敗しました: {error}
        </div>
      )}

      {loading && !data && (
        <div className="card text-sm text-slate-500 dark:text-slate-400">
          データを取得しています…
        </div>
      )}

      {data && (
        <>
          <DailySummary summary={data.summary} />

          <section className="grid gap-3 sm:grid-cols-2">
            {data.quotes.map((q) => (
              <StockCard key={q.ticker} quote={q} />
            ))}
          </section>

          <MarketOverview market={data.market} />

          <section className="card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold sm:text-lg">銘柄別ニュース</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                直近の関連報道
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {data.quotes.map((q) => (
                <button
                  key={q.ticker}
                  type="button"
                  onClick={() => setActiveTicker(q.ticker)}
                  className={
                    activeTicker === q.ticker
                      ? "rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                      : "rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  }
                >
                  {q.ticker}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {(activeTicker ? data.newsByTicker[activeTicker] ?? [] : []).map(
                (item) => (
                  <NewsCard key={item.id} item={item} />
                )
              )}
              {activeTicker &&
                (data.newsByTicker[activeTicker] ?? []).length === 0 && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    関連ニュースが取得できませんでした。
                  </div>
                )}
            </div>
          </section>

          <footer className="flex flex-col gap-2 pt-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              要約生成: {formatDateTimeJa(data.summary.generatedAt)} ／
              市場データ取得: {formatDateTimeJa(data.market.fetchedAt)}
            </div>
            <Disclaimer />
          </footer>
        </>
      )}
    </div>
  );
}
