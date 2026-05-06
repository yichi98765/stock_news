"use client";

import { useState } from "react";
import type { NewsItem } from "@/lib/types";
import { classNames, relativeTimeJa } from "@/lib/utils";

const SENTIMENT_BADGE: Record<string, { label: string; cls: string }> = {
  up: { label: "上昇要因", cls: "badge-up" },
  down: { label: "下落要因", cls: "badge-down" },
  neutral: { label: "中立", cls: "badge-neutral" }
};

export function NewsCard({ item }: { item: NewsItem }) {
  const [open, setOpen] = useState(false);
  const badge = SENTIMENT_BADGE[item.sentiment];

  return (
    <article className="card flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className={classNames("badge", badge.cls)}>{badge.label}</span>
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
