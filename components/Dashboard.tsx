"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DailySummary as DailySummaryType,
  MarketOverview as MarketOverviewType,
  NewsItem,
  PortfolioSnapshot,
  StockQuote
} from "@/lib/types";
import { ArchivePanel } from "./ArchivePanel";
import { DailySummary } from "./DailySummary";
import { DataToolsPanel, type ExportData } from "./DataToolsPanel";
import { Disclaimer } from "./Disclaimer";
import { MacroNews, type MacroCategory } from "./MacroNews";
import { MarketOverview } from "./MarketOverview";
import { NewsCard } from "./NewsCard";
import { AlertsPanel, type AlertRule } from "./AlertsPanel";
import { PortfolioPanel, type Holdings } from "./PortfolioPanel";
import { StockCard } from "./StockCard";
import { ThemeToggle } from "./ThemeToggle";
import { WatchlistManager } from "./WatchlistManager";
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

const STORAGE_KEYS = {
  tickers: "stockFinder.watchlist.v1",
  holdings: "stockFinder.holdings.v1",
  alerts: "stockFinder.alerts.v1",
  archives: "stockFinder.archives.v1"
};

function parseStringArray(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const tickers = parsed
      .map((v) => String(v).trim().toUpperCase())
      .filter((v) => /^[A-Z0-9.^-]{1,12}$/.test(v));
    return tickers.length > 0 ? Array.from(new Set(tickers)) : null;
  } catch {
    return null;
  }
}

function parseHoldings(raw: string | null): Holdings {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([ticker, value]) => {
          const h = value as Partial<{ shares: number; costBasis: number }>;
          return [
            ticker.toUpperCase(),
            {
              shares: Number.isFinite(h.shares) ? Number(h.shares) : 0,
              costBasis: Number.isFinite(h.costBasis) ? Number(h.costBasis) : 0
            }
          ] as const;
        })
        .filter(([ticker]) => /^[A-Z0-9.^-]{1,12}$/.test(ticker))
    );
  } catch {
    return {};
  }
}

function parseAlerts(raw: string | null): AlertRule[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AlertRule[]) : [];
  } catch {
    return [];
  }
}

function parseArchives(raw: string | null): PortfolioSnapshot[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PortfolioSnapshot[]) : [];
  } catch {
    return [];
  }
}

function todayKeyJa(): string {
  return new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo"
  });
}

function buildSnapshot(
  data: SummaryResponse,
  holdings: Holdings
): PortfolioSnapshot {
  const rows = data.quotes.map((quote) => {
    const holding = holdings[quote.ticker] ?? { shares: 0, costBasis: 0 };
    const price = quote.price ?? 0;
    const marketValue = holding.shares * price;
    const cost = holding.shares * holding.costBasis;
    const pnl = marketValue - cost;
    const pnlPercent = cost > 0 ? (pnl / cost) * 100 : null;
    return {
      ticker: quote.ticker,
      displayName: quote.displayName,
      shares: holding.shares,
      costBasis: holding.costBasis,
      price: quote.price,
      marketValue,
      pnl,
      pnlPercent
    };
  });
  const totalValue = rows.reduce((sum, row) => sum + row.marketValue, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.shares * row.costBasis, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : null;

  return {
    date: todayKeyJa(),
    savedAt: new Date().toISOString(),
    totalValue,
    totalCost,
    totalPnl,
    totalPnlPercent,
    marketHeadline: data.summary.marketHeadline,
    rows
  };
}

export function Dashboard() {
  const [tab, setTab] = useState<Tab>("home");
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [macroData, setMacroData] = useState<MacroResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [macroLoading, setMacroLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const [nowLabel, setNowLabel] = useState<string>("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [customTickers, setCustomTickers] = useState<string[] | null>(null);
  const [holdings, setHoldings] = useState<Holdings>({});
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [archives, setArchives] = useState<PortfolioSnapshot[]>([]);

  useEffect(() => {
    setCustomTickers(parseStringArray(window.localStorage.getItem(STORAGE_KEYS.tickers)));
    setHoldings(parseHoldings(window.localStorage.getItem(STORAGE_KEYS.holdings)));
    setAlertRules(parseAlerts(window.localStorage.getItem(STORAGE_KEYS.alerts)));
    setArchives(parseArchives(window.localStorage.getItem(STORAGE_KEYS.archives)));
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    if (customTickers) {
      window.localStorage.setItem(STORAGE_KEYS.tickers, JSON.stringify(customTickers));
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.tickers);
    }
  }, [customTickers, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;
    window.localStorage.setItem(STORAGE_KEYS.holdings, JSON.stringify(holdings));
  }, [holdings, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;
    window.localStorage.setItem(STORAGE_KEYS.alerts, JSON.stringify(alertRules));
  }, [alertRules, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;
    window.localStorage.setItem(STORAGE_KEYS.archives, JSON.stringify(archives));
  }, [archives, settingsLoaded]);

  useEffect(() => {
    const tick = () => setNowLabel(todayJaLabel());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (!settingsLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const qs = customTickers
        ? `?tickers=${encodeURIComponent(customTickers.join(","))}`
        : "";
      const res = await fetch(`/api/summary${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SummaryResponse;
      setData(json);
      setActiveTicker((current) =>
        current && json.quotes.some((q) => q.ticker === current)
          ? current
          : json.quotes[0]?.ticker ?? null
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [customTickers, settingsLoaded]);

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
    if (settingsLoaded) load();
  }, [load, settingsLoaded]);

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

  const saveTodayArchive = () => {
    if (!data) return;
    const snapshot = buildSnapshot(data, holdings);
    setArchives((current) =>
      [snapshot, ...current.filter((item) => item.date !== snapshot.date)].sort((a, b) =>
        b.date.localeCompare(a.date)
      )
    );
  };

  const exportData: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    watchlist: customTickers,
    holdings,
    alerts: alertRules,
    archives
  };

  const importData = (next: ExportData) => {
    setCustomTickers(next.watchlist ?? null);
    setHoldings(next.holdings ?? {});
    setAlertRules(next.alerts ?? []);
    setArchives(next.archives ?? []);
  };

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
          {(loading || !settingsLoaded) && !data && (
            <div className="card text-sm text-slate-500 dark:text-slate-400">
              データを取得しています…
            </div>
          )}

          {data && (
            <>
              <DailySummary summary={data.summary} />

              <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
                <WatchlistManager
                  quotes={data.quotes}
                  customTickers={customTickers}
                  onChange={setCustomTickers}
                />
                <PortfolioPanel
                  quotes={data.quotes}
                  holdings={holdings}
                  onChange={setHoldings}
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                <DataToolsPanel data={exportData} onImport={importData} />
                <ArchivePanel
                  archives={archives}
                  onSaveToday={saveTodayArchive}
                  onDelete={(date) =>
                    setArchives((current) => current.filter((item) => item.date !== date))
                  }
                />
              </div>

              <AlertsPanel
                quotes={data.quotes}
                newsByTicker={data.newsByTicker}
                rules={alertRules}
                onChange={setAlertRules}
              />

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
