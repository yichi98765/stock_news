"use client";

import { useMemo, useState } from "react";
import type { StockQuote } from "@/lib/types";

function cleanTicker(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.^-]/g, "");
}

export function WatchlistManager({
  quotes,
  customTickers,
  onChange
}: {
  quotes: StockQuote[];
  customTickers: string[] | null;
  onChange: (tickers: string[] | null) => void;
}) {
  const [input, setInput] = useState("");
  const tickers = useMemo(
    () => customTickers ?? quotes.map((q) => q.ticker),
    [customTickers, quotes]
  );
  const isCustomized = customTickers !== null;

  const addTicker = () => {
    const ticker = cleanTicker(input);
    if (!ticker) return;
    onChange(Array.from(new Set([...tickers, ticker])));
    setInput("");
  };

  const removeTicker = (ticker: string) => {
    if (tickers.length <= 1) return;
    onChange(tickers.filter((t) => t !== ticker));
  };

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">ウォッチリスト</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            銘柄リストはこの端末に保存されます。
          </p>
        </div>
        {isCustomized && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            既定に戻す
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {tickers.map((ticker) => (
          <span
            key={ticker}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2 py-1 text-sm font-medium dark:bg-slate-800"
          >
            {ticker}
            <button
              type="button"
              onClick={() => removeTicker(ticker)}
              disabled={tickers.length <= 1}
              className="text-slate-500 hover:text-down disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`${ticker}を削除`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(cleanTicker(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTicker();
          }}
          placeholder="NVDA"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm uppercase dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="button"
          onClick={addTicker}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          追加
        </button>
      </div>
    </section>
  );
}
