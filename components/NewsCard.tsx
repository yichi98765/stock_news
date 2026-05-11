"use client";

import { useState } from "react";
import type { NewsItem } from "@/lib/types";
import { classNames, relativeTimeJa } from "@/lib/utils";

const SENTIMENT_BADGE: Record<string, { label: string; cls: string }> = {
  up: { label: "上昇要因", cls: "badge-up" },
  down: { label: "下落要因", cls: "badge-down" },
  neutral: { label: "中立", cls: "badge-neutral" }
};

const IMPORTANCE_BADGE: Record<string, { label: string; cls: string }> = {
  high: { label: "重要", cls: "bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200" },
  medium: { label: "普通", cls: "bg-sky-100 text-sky-800 dark:bg-sky-400/20 dark:text-sky-200" },
  low: { label: "軽微", cls: "badge-neutral" }
};

export function NewsCard({ item }: { item: NewsItem }) {
  const [open, setOpen] = useState(true);
  const badge = SENTIMENT_BADGE[item.sentiment];
  const importance = IMPORTANCE_BADGE[item.importance] ?? IMPORTANCE_BADGE.low;

  return (
    <article className="card flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <span className={classNames("badge", badge.cls)}>{badge.label}</span>
          <span className={classNames("badge", importance.cls)}>
            {importance.label} {item.importanceScore}
          </span>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {relativeTimeJa(item.publishedAt)}
        </span>
      </div>

      <h3 className="text-sm font-semibold leading-snug sm:text-base">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          {item.title}
        </a>
      </h3>

      <div className="text-xs text-slate-500 dark:text-slate-400">
        {item.source}
      </div>

      {open && (
        <>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {item.summary}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            分類根拠: {item.sentimentReason}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            重要度根拠: {item.importanceReason}
          </p>
        </>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-medium text-slate-600 hover:underline dark:text-slate-300"
        >
          {open ? "要約を閉じる" : "要約を開く"}
        </button>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-slate-600 hover:underline dark:text-slate-300"
        >
          元記事を開く →
        </a>
      </div>
    </article>
  );
}
