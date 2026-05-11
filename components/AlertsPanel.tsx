"use client";

import { useEffect, useMemo, useState } from "react";
import type { NewsItem, StockQuote } from "@/lib/types";
import { classNames, formatPercent, formatPrice } from "@/lib/utils";

export type AlertKind =
  | "price-above"
  | "price-below"
  | "change-up"
  | "change-down"
  | "news-keyword";

export interface AlertRule {
  id: string;
  ticker: string;
  kind: AlertKind;
  threshold: number;
  keyword: string;
  enabled: boolean;
}

interface TriggeredAlert {
  id: string;
  message: string;
  tone: "up" | "down" | "neutral";
}

interface NotifyChannels {
  slack: boolean;
  pushover: boolean;
  line: boolean;
  email: boolean;
  webhook: boolean;
}

const ALERT_SENT_KEY = "stockFinder.alerts.sent.v1";
const ALERT_NOTIFY_KEY = "stockFinder.alerts.notify.v1";
const NOTIFY_COOLDOWN_MS = 30 * 60 * 1000;

const KIND_LABEL: Record<AlertKind, string> = {
  "price-above": "価格が指定値以上",
  "price-below": "価格が指定値以下",
  "change-up": "前日比が指定%以上",
  "change-down": "前日比が指定%以下",
  "news-keyword": "ニュース語句を検知"
};

function buildTriggeredAlerts(
  rules: AlertRule[],
  quotes: StockQuote[],
  newsByTicker: Record<string, NewsItem[]>
): TriggeredAlert[] {
  return rules
    .filter((r) => r.enabled)
    .flatMap((rule): TriggeredAlert[] => {
      const quote = quotes.find((q) => q.ticker === rule.ticker);
      if (!quote) return [];
      const price = quote.price;
      const pct = quote.changePercent;
      if (rule.kind === "price-above" && price != null && price >= rule.threshold) {
        return [{ id: rule.id, message: `${rule.ticker} が ${formatPrice(rule.threshold, quote.currency)} 以上です`, tone: "up" as const }];
      }
      if (rule.kind === "price-below" && price != null && price <= rule.threshold) {
        return [{ id: rule.id, message: `${rule.ticker} が ${formatPrice(rule.threshold, quote.currency)} 以下です`, tone: "down" as const }];
      }
      if (rule.kind === "change-up" && pct != null && pct >= Math.abs(rule.threshold)) {
        return [{ id: rule.id, message: `${rule.ticker} の前日比が ${formatPercent(Math.abs(rule.threshold))} 以上です`, tone: "up" as const }];
      }
      if (rule.kind === "change-down" && pct != null && pct <= -Math.abs(rule.threshold)) {
        return [{ id: rule.id, message: `${rule.ticker} の前日比が -${Math.abs(rule.threshold).toFixed(2)}% 以下です`, tone: "down" as const }];
      }
      if (rule.kind === "news-keyword" && rule.keyword.trim()) {
        const keyword = rule.keyword.trim().toLowerCase();
        const hit = (newsByTicker[rule.ticker] ?? []).find((n) =>
          `${n.title} ${n.summary}`.toLowerCase().includes(keyword)
        );
        if (hit) {
          return [{ id: rule.id, message: `${rule.ticker} ニュースで「${rule.keyword}」を検知: ${hit.title}`, tone: "neutral" as const }];
        }
      }
      return [];
    });
}

export function AlertsPanel({
  quotes,
  newsByTicker,
  rules,
  onChange
}: {
  quotes: StockQuote[];
  newsByTicker: Record<string, NewsItem[]>;
  rules: AlertRule[];
  onChange: (next: AlertRule[]) => void;
}) {
  const [ticker, setTicker] = useState(quotes[0]?.ticker ?? "");
  const [kind, setKind] = useState<AlertKind>("price-above");
  const [threshold, setThreshold] = useState("");
  const [keyword, setKeyword] = useState("");
  const [browserNotify, setBrowserNotify] = useState(false);
  const [externalNotify, setExternalNotify] = useState(false);
  const [channels, setChannels] = useState<NotifyChannels | null>(null);
  const [notifyStatus, setNotifyStatus] = useState<string>("");

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(ALERT_NOTIFY_KEY) ?? "{}") as {
        browser?: boolean;
        external?: boolean;
      };
      setBrowserNotify(Boolean(saved.browser));
      setExternalNotify(Boolean(saved.external));
    } catch {
      // ignore malformed localStorage
    }
    fetch("/api/notify")
      .then((res) => res.json())
      .then((json: { channels?: NotifyChannels }) => setChannels(json.channels ?? null))
      .catch(() => setChannels(null));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      ALERT_NOTIFY_KEY,
      JSON.stringify({ browser: browserNotify, external: externalNotify })
    );
  }, [browserNotify, externalNotify]);

  useEffect(() => {
    if (quotes.length > 0 && !quotes.some((q) => q.ticker === ticker)) {
      setTicker(quotes[0].ticker);
    }
  }, [quotes, ticker]);

  const triggered = useMemo(
    () => buildTriggeredAlerts(rules, quotes, newsByTicker),
    [rules, quotes, newsByTicker]
  );

  useEffect(() => {
    if (triggered.length === 0) return;

    let sent: Record<string, number> = {};
    try {
      sent = JSON.parse(window.localStorage.getItem(ALERT_SENT_KEY) ?? "{}") as Record<string, number>;
    } catch {
      sent = {};
    }

    const now = Date.now();
    const unsent = triggered.filter((alert) => now - (sent[alert.id] ?? 0) > NOTIFY_COOLDOWN_MS);
    if (unsent.length === 0) return;

    if (browserNotify && "Notification" in window && Notification.permission === "granted") {
      for (const alert of unsent) {
        new Notification("Stock Finder Alert", { body: alert.message });
      }
    }

    if (externalNotify) {
      fetch("/api/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alerts: unsent })
      })
        .then((res) => res.json())
        .then((json: { failures?: number }) => {
          setNotifyStatus(json.failures ? `外部通知の一部に失敗しました (${json.failures}件)` : "外部通知を送信しました");
        })
        .catch(() => setNotifyStatus("外部通知に失敗しました"));
    }

    for (const alert of unsent) sent[alert.id] = now;
    window.localStorage.setItem(ALERT_SENT_KEY, JSON.stringify(sent));
  }, [browserNotify, externalNotify, triggered]);

  const enableBrowserNotify = async () => {
    if (!("Notification" in window)) {
      setNotifyStatus("このブラウザは通知に対応していません");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setBrowserNotify(true);
      setNotifyStatus("ブラウザ通知を有効化しました");
    } else {
      setBrowserNotify(false);
      setNotifyStatus("ブラウザ通知が許可されませんでした");
    }
  };

  const addRule = () => {
    const selectedTicker = ticker || quotes[0]?.ticker;
    if (!selectedTicker) return;
    const numericThreshold = Number(threshold);
    const needsKeyword = kind === "news-keyword";
    if (needsKeyword && !keyword.trim()) return;
    if (!needsKeyword && (!Number.isFinite(numericThreshold) || numericThreshold < 0)) return;
    onChange([
      ...rules,
      {
        id: `${Date.now()}-${selectedTicker}-${kind}`,
        ticker: selectedTicker,
        kind,
        threshold: needsKeyword ? 0 : numericThreshold,
        keyword: needsKeyword ? keyword.trim() : "",
        enabled: true
      }
    ]);
    setThreshold("");
    setKeyword("");
  };

  const updateRule = (id: string, patch: Partial<AlertRule>) => {
    onChange(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  return (
    <section className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">アラート</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            条件はこの端末に保存され、画面内/ブラウザ/外部Webhookへ通知できます。
          </p>
        </div>
        <span className="badge badge-neutral">{rules.filter((r) => r.enabled).length}件有効</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={enableBrowserNotify}
          className="rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {browserNotify ? "ブラウザ通知: 有効" : "ブラウザ通知を有効化"}
        </button>
        <label className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            checked={externalNotify}
            onChange={(e) => setExternalNotify(e.target.checked)}
          />
          外部通知
        </label>
        {channels && (
          <span className="text-slate-500 dark:text-slate-400">
            接続:{" "}
            {Object.entries(channels)
              .filter(([, enabled]) => enabled)
              .map(([name]) => name)
              .join(", ") || "未設定"}
          </span>
        )}
        {notifyStatus && <span className="text-slate-500 dark:text-slate-400">{notifyStatus}</span>}
      </div>

      {triggered.length > 0 && (
        <div className="grid gap-2">
          {triggered.map((alert) => (
            <div
              key={alert.id}
              className={classNames(
                "rounded-lg px-3 py-2 text-sm",
                alert.tone === "up" && "bg-up-soft text-up dark:bg-up/20 dark:text-up-dark",
                alert.tone === "down" && "bg-down-soft text-down dark:bg-down/20 dark:text-down-dark",
                alert.tone === "neutral" && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              )}
            >
              {alert.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_1fr_auto]">
        <select
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {quotes.map((q) => (
            <option key={q.ticker} value={q.ticker}>
              {q.ticker}
            </option>
          ))}
        </select>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as AlertKind)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {Object.entries(KIND_LABEL).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        {kind === "news-keyword" ? (
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="earnings"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        ) : (
          <input
            type="number"
            min="0"
            step="0.01"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={kind.startsWith("price") ? "250.00" : "5.00"}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        )}
        <button
          type="button"
          onClick={addRule}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          追加
        </button>
      </div>

      {rules.length > 0 && (
        <div className="grid gap-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800"
            >
              <label className="flex min-w-0 items-center gap-2">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                />
                <span className="font-semibold">{rule.ticker}</span>
                <span className="text-slate-600 dark:text-slate-300">
                  {KIND_LABEL[rule.kind]}{" "}
                  {rule.kind === "news-keyword" ? `「${rule.keyword}」` : rule.threshold}
                </span>
              </label>
              <button
                type="button"
                onClick={() => onChange(rules.filter((r) => r.id !== rule.id))}
                className="text-xs font-medium text-slate-500 hover:text-down"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
