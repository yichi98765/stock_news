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
import { MacroNews, type MacroCategory } from "./MacroNews";
import { MarketOverview } from "./MarketOverview";
import { NewsCard } from "./NewsCard";
import { StockCard } from "./StockCard";
import { ThemeToggle } from "./ThemeToggle";
import { classNames, formatDateTimeJa, timeJa, todayJaLabel } from "@/lib/utils";

interface SummaryResponse {
  summary: DailySummaryType;
  quotes: StockQuote[];
  newsByTicker: Record<string, NewsItem[]>;
  market: MarketOverviewType;
}

interface MacroResponse {
  categories: MacroCategory[];
  fetchedAt: string;
}

type Tab = "home" | "macro";

export function Dashboard() {
  const [tab, setTab] = useState<Tab>("home");
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [macroData, setMacroData] = useState<MacroResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [macroLoading, setMacroLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const [nowLabel, setNowLabel] = useState<string>("");

  useEffect(() => {
    const tick = () => setNowLabel(todayJaLabel());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

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

  const loadMacro = useCallback(async () => {
    setMacroLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/macro-news", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as MacroResponse;
      setMacroData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMacroLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === "macro" && !macroData && !macroLoading) {
      loadMacro();
    }
  }, [tab, macroData, macroLoading, loadMacro]);

  const onRefresh = () => {
    if (tab === "home") load();
    else loadMacro();
  };

  const isLoading = tab === "home" ? loading : macroLoading;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Stock Finder</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {nowLabel} JST{" "}
            {data && (
              <span className="ml-1">
                ／ データ取得 {timeJa(data.summary.generatedAt)}
              </span>
            )}
            {tab === "macro" && macroData && (
              <span className="ml-1">
                ／ マクロ取得 {timeJa(macroData.fetchedAt)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {isLoading ? "更新中…" : "更新"}
          </button>
          <ThemeToggle />
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto">
        {(
          [
            { id: "home" as const, label: "ホーム" },
            { id: "macro" as const, label: "マクロニュース" }
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={classNames(
              "rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap",
              tab === t.id
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="rounded-xl bg-down-soft px-3 py-2 text-sm text-down dark:bg-down/20">
          データ取得に失敗しました: {error}
        </div>
      )}

      {tab === "home" && (
        <>
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
                  <h2 className="text-base font-semibold sm:text-lg">
                    銘柄別ニュース
                  </h2>
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
        </>
      )}

      {tab === "macro" && (
        <>
          {macroLoading && !macroData && (
            <div className="card text-sm text-slate-500 dark:text-slate-400">
              マクロニュースを取得しています…（記事本文の翻訳に少し時間がかかります）
            </div>
          )}

          {macroData && (
            <>
              <MacroNews categories={macroData.categories} />
              <footer className="flex flex-col gap-2 pt-2">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  マクロニュース取得: {formatDateTimeJa(macroData.fetchedAt)}
                </div>
                <Disclaimer />
              </footer>
            </>
          )}
        </>
      )}
    </div>
  );
}
