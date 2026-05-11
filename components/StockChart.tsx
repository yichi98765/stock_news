"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  type ChartOptions,
  type DeepPartial,
  type UTCTimestamp
} from "lightweight-charts";
import type { ChartPoint, ChartRange } from "@/lib/types";
import { classNames, formatPrice } from "@/lib/utils";

const RANGES: { id: ChartRange; label: string }[] = [
  { id: "1d", label: "1日" },
  { id: "5d", label: "5日" },
  { id: "1mo", label: "1か月" },
  { id: "6mo", label: "6か月" }
];

interface ChartResponse {
  points: ChartPoint[];
  previousClose: number | null;
}

type ChartStyle = "line" | "candle";

function chartOptions(): DeepPartial<ChartOptions> {
  return {
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: "#64748b",
      fontSize: 11
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: "rgba(148, 163, 184, 0.18)" }
    },
    rightPriceScale: {
      borderVisible: false,
      scaleMargins: { top: 0.2, bottom: 0.15 }
    },
    timeScale: {
      borderVisible: false,
      timeVisible: true,
      secondsVisible: false
    },
    crosshair: {
      horzLine: { visible: false }
    }
  };
}

export function StockChart({ ticker, currency }: { ticker: string; currency: string }) {
  const [range, setRange] = useState<ChartRange>("5d");
  const [style, setStyle] = useState<ChartStyle>("line");
  const [showVolume, setShowVolume] = useState(true);
  const [includePrePost, setIncludePrePost] = useState(false);
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [previousClose, setPreviousClose] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(
      `/api/chart?ticker=${encodeURIComponent(ticker)}&range=${range}&prepost=${
        includePrePost ? "1" : "0"
      }`,
      {
      cache: "no-store",
      signal: controller.signal
      }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ChartResponse;
      })
      .then((json) => {
        setPoints(json.points ?? []);
        setPreviousClose(json.previousClose ?? null);
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : String(e));
        setPoints([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [ticker, range, includePrePost]);

  const trend = useMemo(() => {
    if (points.length < 2) return 0;
    return points[points.length - 1].value - points[0].value;
  }, [points]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || points.length === 0) return;

    const chart = createChart(el, {
      ...chartOptions(),
      width: el.clientWidth,
      height: showVolume ? 230 : 180
    });
    const priceColor = trend >= 0 ? "#16a34a" : "#dc2626";
    const priceSeries =
      style === "candle"
        ? chart.addSeries(CandlestickSeries, {
            upColor: "#16a34a",
            downColor: "#dc2626",
            borderVisible: false,
            wickUpColor: "#16a34a",
            wickDownColor: "#dc2626",
            priceLineVisible: false
          })
        : chart.addSeries(LineSeries, {
            color: priceColor,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false
          });

    if (style === "candle") {
      priceSeries.setData(
        points.map((p) => ({
          time: Math.floor(new Date(p.time).getTime() / 1000) as UTCTimestamp,
          open: p.open,
          high: p.high,
          low: p.low,
          close: p.close
        }))
      );
    } else {
      priceSeries.setData(
        points.map((p) => ({
          time: Math.floor(new Date(p.time).getTime() / 1000) as UTCTimestamp,
          value: p.close
        }))
      );
    }

    if (previousClose != null) {
      priceSeries.createPriceLine({
        price: previousClose,
        color: "#94a3b8",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "前日終値"
      });
    }

    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "",
        base: 0,
        priceLineVisible: false,
        lastValueVisible: false
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.75, bottom: 0 }
      });
      volumeSeries.setData(
        points
          .filter((p) => p.volume != null)
          .map((p) => ({
            time: Math.floor(new Date(p.time).getTime() / 1000) as UTCTimestamp,
            value: p.volume ?? 0,
            color: p.close >= p.open ? "rgba(22, 163, 74, 0.28)" : "rgba(220, 38, 38, 0.28)"
          }))
      );
    }
    chart.timeScale().fitContent();

    const resize = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0]?.contentRect.width ?? el.clientWidth);
      chart.applyOptions({ width, height: showVolume ? 230 : 180 });
      chart.timeScale().fitContent();
    });
    resize.observe(el);

    return () => {
      resize.disconnect();
      chart.remove();
    };
  }, [points, previousClose, showVolume, style, trend]);

  const last = points[points.length - 1]?.value ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          チャート {last != null && <span className="tabular-nums">{formatPrice(last, currency)}</span>}
        </div>
        <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={classNames(
                "rounded-md px-2 py-1 text-xs font-medium",
                range === r.id
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => setStyle((v) => (v === "line" ? "candle" : "line"))}
          className="rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {style === "line" ? "折れ線" : "ローソク足"}
        </button>
        <label className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            checked={showVolume}
            onChange={(e) => setShowVolume(e.target.checked)}
          />
          出来高
        </label>
        <label className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            checked={includePrePost}
            onChange={(e) => setIncludePrePost(e.target.checked)}
          />
          プレ/アフター
        </label>
        {previousClose != null && (
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            前日終値 {formatPrice(previousClose, currency)}
          </span>
        )}
      </div>

      <div
        className={classNames(
          "relative overflow-hidden rounded-lg bg-slate-50 dark:bg-slate-950/60",
          showVolume ? "h-[230px]" : "h-[180px]"
        )}
      >
        <div ref={containerRef} className="h-full w-full" />
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-white/50 text-xs text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
            読み込み中…
          </div>
        )}
        {!loading && error && (
          <div className="absolute inset-0 grid place-items-center px-3 text-center text-xs text-down">
            チャート取得に失敗しました: {error}
          </div>
        )}
        {!loading && !error && points.length === 0 && (
          <div className="absolute inset-0 grid place-items-center text-xs text-slate-500 dark:text-slate-400">
            チャートデータがありません
          </div>
        )}
      </div>
    </div>
  );
}
