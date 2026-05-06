import type { Sentiment } from "./types";

export function classNames(...args: (string | false | null | undefined)[]): string {
  return args.filter(Boolean).join(" ");
}

export function formatPrice(price: number | null, currency = "USD"): string {
  if (price == null || Number.isNaN(price)) return "—";
  const symbol = currency === "USD" ? "$" : "";
  return `${symbol}${price.toFixed(2)}`;
}

export function formatChange(change: number | null): string {
  if (change == null || Number.isNaN(change)) return "—";
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}`;
}

export function formatPercent(percent: number | null): string {
  if (percent == null || Number.isNaN(percent)) return "—";
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(2)}%`;
}

export function trendOf(percent: number | null): Sentiment {
  if (percent == null || Number.isNaN(percent)) return "neutral";
  if (percent > 0.05) return "up";
  if (percent < -0.05) return "down";
  return "neutral";
}

export function formatDateTimeJa(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo"
  });
}

export function relativeTimeJa(iso: string): string {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return iso;
  const diffMs = Date.now() - target;
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}日前`;
  return formatDateTimeJa(iso);
}

class TtlCache<V> {
  private store = new Map<string, { value: V; expiresAt: number }>();

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V, ttlMs: number) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}

export function createTtlCache<V>(): TtlCache<V> {
  return new TtlCache<V>();
}
