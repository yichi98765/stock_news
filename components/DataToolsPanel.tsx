"use client";

import { useRef, useState } from "react";
import type { PortfolioSnapshot } from "@/lib/types";
import type { AlertRule } from "./AlertsPanel";
import type { Holdings } from "./PortfolioPanel";

export interface ExportData {
  version: 1;
  exportedAt: string;
  watchlist: string[] | null;
  holdings: Holdings;
  alerts: AlertRule[];
  archives: PortfolioSnapshot[];
}

export function DataToolsPanel({
  data,
  onImport
}: {
  data: ExportData;
  onImport: (data: ExportData) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-finder-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("JSONを書き出しました");
  };

  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ExportData;
      if (parsed.version !== 1 || typeof parsed.exportedAt !== "string") {
        throw new Error("形式が違います");
      }
      onImport(parsed);
      setMessage("JSONを読み込みました");
    } catch (e) {
      setMessage(`読み込みに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <section className="card flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold sm:text-lg">データ入出力</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          ウォッチリスト、保有、アラート、日次アーカイブをJSONで移行できます。
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportJson}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          JSON出力
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          JSON読込
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => importJson(e.target.files?.[0])}
          className="hidden"
        />
      </div>
      {message && <div className="text-xs text-slate-500 dark:text-slate-400">{message}</div>}
    </section>
  );
}
