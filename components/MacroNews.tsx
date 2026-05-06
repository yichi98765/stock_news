"use client";

import type { NewsItem } from "@/lib/types";
import { NewsCard } from "./NewsCard";

export interface MacroCategory {
  id: string;
  label: string;
  items: NewsItem[];
}

export function MacroNews({ categories }: { categories: MacroCategory[] }) {
  if (!categories || categories.length === 0) {
    return (
      <div className="card text-sm text-slate-500 dark:text-slate-400">
        マクロニュースを取得できませんでした。
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        日本・米国・世界のマクロテーマ別に直近の重要ニュースをピックアップ。
        要約は Gemini で日本語化（記事本文を読みに行きます）。
      </p>
      {categories.map((cat) => (
        <div key={cat.id} className="card flex flex-col gap-3">
          <h3 className="text-base font-semibold sm:text-lg">{cat.label}</h3>
          {cat.items.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              関連ニュースは取得できませんでした。
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {cat.items.map((item) => (
                <NewsCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
