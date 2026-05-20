# Stock Finder — 米国株モニター (NBIS / TSLA など)

保有米国株について、株価・関連ニュース・市場全体の動きを **日本語** で確認するための簡易モニタリングツール。

> 投資助言ツールではありません。事実ベースの情報整理を目的とし、最終的な投資判断はご自身の責任で行ってください。

## 主な機能

- 保有銘柄の現在株価・前日比・前日比率カード（上昇=緑 / 下落=赤）
- 銘柄別ニュース（タイトル / 要約 / ソース / 公開日時 / リンク / 上昇要因・下落要因・中立の自動分類）
- その日の値動き理由の推定（断定を避け、根拠ニュースを必ず併記）
- 市場全体の状況（S&P500 / NASDAQ / Dow / Russell 2000 と主要セクターETF）
- セクターローテーション・市場テーマの自動推定（金利・AI・EV など）
- iPhone と PC の両対応レスポンシブ + ダークモード切替
- AI 要約は Gemini / Claude / OpenAI を任意で差し替え可能。**APIキー無しでもルールベースで動作**。
- 保有数量・取得単価の端末保存、評価損益・銘柄比率表示、JSON入出力
- 1日/5日/1か月/6か月チャート、出来高、前日終値ライン、ローソク足、プレ/アフター市場切替
- 価格・前日比・ニュース語句アラート、ブラウザ通知、Slack/Pushover/LINE/Email/Webhook 送信
- 日次アーカイブで要約と保有損益を保存

## 技術構成

- **Next.js 14 (App Router)** + **TypeScript** + **Tailwind CSS**
- `app/api/*` で最小限のサーバ層 (株価・ニュース・市場・要約)
- 株価・指数・セクターETF: **`yahoo-finance2`** (npm) — APIキー不要
- ニュース: Yahoo Finance のニュース API + Finnhub (任意)
- AI: Gemini → Anthropic Claude → OpenAI → ルールベース の優先順位でフォールバック
- インメモリ TTL キャッシュ（株価60秒、ニュース5分、市場2分、要約5分）

## 必要な API 候補（全て無料枠あり / 設定不要でも動く）

| 用途 | サービス | キー必要 | 備考 |
| --- | --- | --- | --- |
| 株価・指数・セクターETF | Yahoo Finance (`yahoo-finance2`) | 不要 | 非公式。本ツールの既定。 |
| 銘柄ニュース (基本) | Yahoo Finance Search API | 不要 | yahoo-finance2 経由 |
| 銘柄ニュース (拡充) | [Finnhub](https://finnhub.io/) | 任意 | 無料60req/min。`FINNHUB_API_KEY` |
| AI 要約 (無料枠・推奨) | [Google Gemini (AI Studio)](https://aistudio.google.com/apikey) | 任意 | `GEMINI_API_KEY` (無料・クレカ不要) |
| AI 要約 (有料・高品質) | [Anthropic Claude](https://console.anthropic.com/) | 任意 | `ANTHROPIC_API_KEY` |
| AI 要約 (代替) | [OpenAI](https://platform.openai.com/) | 任意 | `OPENAI_API_KEY` |

将来的に有料・正式 API へ移行したい場合は [`lib/providers/`](lib/providers/) を差し替えるだけで済みます。

## ディレクトリ構成

```
stock_finder/
├── app/
│   ├── api/
│   │   ├── stocks/route.ts      # 株価
│   │   ├── news/route.ts        # ニュース
│   │   ├── market/route.ts      # 市場・セクター
│   │   └── summary/route.ts     # 全部まとめてAI要約
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Dashboard.tsx            # 画面全体の状態管理
│   ├── DailySummary.tsx         # 今日の要約
│   ├── StockCard.tsx            # 銘柄カード
│   ├── NewsCard.tsx             # ニュース1件カード（開閉）
│   ├── MarketOverview.tsx       # 指数・セクター・テーマ
│   ├── ThemeToggle.tsx          # ライト/ダーク切替
│   └── Disclaimer.tsx
├── lib/
│   ├── ai/
│   │   ├── ruleBased.ts         # APIキー無しでも動く要約
│   │   └── summarizer.ts        # Claude / OpenAI 抽象化
│   ├── providers/
│   │   ├── stockProvider.ts     # 株価
│   │   ├── newsProvider.ts      # ニュース + ポジ/ネガ語分類
│   │   └── marketProvider.ts    # 指数・セクター・テーマ推定
│   ├── config.ts                # 監視銘柄・指数・ETF・キャッシュTTL
│   ├── types.ts
│   └── utils.ts
├── .env.example
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

## 起動手順

```bash
# 1. リポジトリ直下で
cd stock_finder

# 2. 依存インストール
npm install

# 3. 環境変数ファイル（任意。無くても動作）
copy .env.example .env.local      # Windows
# cp .env.example .env.local      # macOS / Linux
# .env.local を開き、必要に応じて API キーや銘柄を設定

# 4. 開発サーバ起動
npm run dev

# ブラウザで http://localhost:3000 を開く
```

本番ビルドは `npm run build` → `npm run start`。型チェックは `npm run typecheck`。

## 監視銘柄を追加する

`.env.local` で `NEXT_PUBLIC_TICKERS` を変えるだけ。

```env
NEXT_PUBLIC_TICKERS=NBIS,TSLA,NVDA,AAPL
```

[lib/config.ts](lib/config.ts) の `KNOWN_NAMES` に和名を足すと表示が綺麗になります。

## iPhone から確認する方法

**A. 同じWi-Fi内のPCで起動して、iPhoneでアクセス**
1. PC で `npm run dev -- -H 0.0.0.0` を起動（または `npm run dev` のまま）。
2. PC のローカル IP (例: `192.168.1.20`) を確認。
3. iPhone の Safari で `http://192.168.1.20:3000` を開く。
4. 共有ボタン → 「ホーム画面に追加」でアプリ風アイコン化。

**B. Vercel に無料デプロイ**
1. このリポジトリを GitHub に push (機密は `.env.local` のみで `.env*.local` は gitignore 済み)。
2. [vercel.com](https://vercel.com/) で Import → 環境変数に `ANTHROPIC_API_KEY` などを設定 → Deploy。
3. 払い出された `https://xxx.vercel.app` を iPhone から開いてホームに追加。

> APIキーは絶対にコミットしないでください。`.env.example` のみ公開し、実値は Vercel の環境変数に入れるのが定石です。

## AI 要約の挙動

優先順位は以下:

1. `GEMINI_API_KEY` があれば Google Gemini — **無料枠あり・推奨**
   - 既定で複数モデルを順に試す: `gemini-3.1-flash-lite-preview` (500 RPD) → `gemini-flash-lite-latest` → `gemini-2.5-flash-lite` (20 RPD) → `gemini-2.0-flash-lite` → `gemini-flash-latest` → `gemini-2.5-flash`
   - 1日のクォータが尽きても次のモデルにフォールバックする
   - `GEMINI_MODEL` で最優先モデル指定、`GEMINI_MODELS` (カンマ区切り) で全置換可能
2. なければ `ANTHROPIC_API_KEY` で Claude (`claude-haiku-4-5-20251001` 既定、`ANTHROPIC_MODEL` で変更可)
3. なければ `OPENAI_API_KEY` で OpenAI (`gpt-4o-mini` 既定)
4. どれも無ければ **ルールベース** ([lib/ai/ruleBased.ts](lib/ai/ruleBased.ts))

### Gemini キーの取り方（無料）

1. <https://aistudio.google.com/apikey> にアクセス（Google アカウント必要）
2. **Create API key** → プロジェクトを選択 → 払い出された文字列をコピー
3. ローカル: `.env.local` に `GEMINI_API_KEY=AIza...` を追記して `npm run dev` を再起動
4. Vercel: ダッシュボード → Project → **Settings → Environment Variables** に `GEMINI_API_KEY` を追加 → Redeploy

クレカ登録不要。1分15リクエスト・1日1500リクエスト程度の無料枠で個人モニタリング用途には十分。

[lib/ai/summarizer.ts](lib/ai/summarizer.ts) の `SYSTEM_PROMPT` で「投資助言禁止」「断定回避」を明示してあります。

## ニュースのポジ/ネガ分類

[lib/providers/newsProvider.ts](lib/providers/newsProvider.ts) で英語/日本語のキーワード辞書を使った素朴な分類。誤分類は前提なので、画面では「分類根拠（ヒットしたキーワード）」を確認できます。重要度はキーワード判定を初期値にし、`GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` がある場合は AI 判定で `重要/普通/軽微` と理由を補正します。

## 外部アラート通知

画面内通知とブラウザ通知は設定なしで使えます。外部通知を使う場合は `.env.local` に必要なキーだけを設定してください。

```env
SLACK_WEBHOOK_URL=
PUSHOVER_APP_TOKEN=
PUSHOVER_USER_KEY=
LINE_CHANNEL_ACCESS_TOKEN=
LINE_USER_ID=
RESEND_API_KEY=
ALERT_EMAIL_TO=
ALERT_WEBHOOK_URL=
```

設定済みの送信先はアラート欄の「接続」に表示されます。外部通知は同じ条件で30分以内に重複送信しないようにしています。

## 今後の拡張案

- **永続キャッシュ**: 現状はインメモリ。Upstash Redis や Vercel KV に差し替えるとデプロイ時の冷起動でも軽くなります。
- **PWA 対応**: `manifest.json` + Service Worker でオフライン表示。
- **要約の質向上**: Claude のニュース要約モデル + tool use で SEC EDGAR 直近 8-K の自動取り込み。
- **マルチユーザー**: 認証（NextAuth）+ ユーザー別銘柄リスト。
- **アナリスト評価**: Finnhub の `/stock/recommendation` で目標株価・買い/売り推奨数の推移を表示。
- **マクロ指標**: FRED API で 10年金利・CPI・FFレートを取得。

## 注意・免責

- 表示価格は遅延を含みます (`yahoo-finance2` は約15分遅延が一般的)。
- ニュースのポジ/ネガ分類はキーワードベースで誤分類があります。
- AI 要約は推定であり、断定や投資助言を意図したものではありません。
- 元記事リンクを必ず確認し、一次情報を最優先してください。
