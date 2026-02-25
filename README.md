# Rekolto

Telegram Bot で動く個人向けナレッジ管理ツール。メモや URL を送ると AI が自動で要約・タグ付け・記憶して、あとから自然言語で検索できる。

## 特徴

- **AI 自動要約・タグ付け** — メモ・URL・画像・PDF を送るだけで Gemini が要約・分類
- **3 層ハイブリッド検索** — SQLite FTS5（全文検索）+ PageIndex（ツリー推論）+ LLM リランキング
- **メモリレイヤー** — 保存した知識を自動カテゴリ分類、salience スコアで重み付け、プロアクティブ提案
- **画像 OCR** — スクリーンショットや写真のテキストを Gemini Vision で抽出・保存
- **PDF 対応** — テキスト抽出 + 長文は PageIndex でセクション検索可能に
- **ブラウザリレー** — Chrome 拡張経由で x.com 等ボット対策サイトもスクレイピング
- **LLM プロバイダ交換可能** — 設定で Gemini / OpenAI / ローカルモデルを切り替え
- **SQLite 単一ファイル** — サーバー不要、バックアップはファイルコピーだけ

## 必要なもの

- Node.js 20+
- Python 3.11+ / [uv](https://docs.astral.sh/uv/)
- Telegram Bot Token（[@BotFather](https://t.me/BotFather) で取得）
- Google AI API Key（Gemini 用）

## セットアップ

```bash
git clone https://github.com/yourname/rekolto.git
cd rekolto

# Node.js 依存
npm install

# Python 依存（PageIndex サービス用）
cd python && uv sync && cd ..

# 環境変数
cp .env.example .env
# .env を編集して TELEGRAM_BOT_TOKEN と GOOGLE_API_KEY を設定
```

`.env`:
```
TELEGRAM_BOT_TOKEN=your_bot_token
GOOGLE_API_KEY=your_google_api_key
```

`rekolto.config.yaml` で Telegram の `allowed_users` に自分の user ID を追加:
```yaml
telegram:
  bot_token: ${TELEGRAM_BOT_TOKEN}
  allowed_users: [123456789]
```

## 起動

```bash
# 開発（ホットリロード）
npm run dev

# プロダクション
npm run build
npm start
```

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `/search <クエリ>` | ハイブリッド検索 |
| `/recent` | 最近の保存一覧 |
| `/tags` | タグ一覧 |
| `/tag <名前>` | タグで絞り込み |
| `/insight` | 学習した関心・カテゴリ |
| `/random` | ランダムに 1 件表示 |
| `/stats` | 統計情報 |
| `/delete <ID>` | アイテム削除 |
| `/export` | JSON エクスポート |

テキスト、URL、画像、PDF をそのまま送信するだけでも自動で処理・保存されます。

## アーキテクチャ

```
┌─────────────┐     ┌──────────────────────────────────────────┐
│  Telegram    │     │  Rekolto                                 │
│  (スマホ/PC) │────>│                                          │
│              │<────│  grammY Bot → Router → Handlers          │
└─────────────┘     │       │          │          │            │
                    │       v          v          v            │
                    │  ┌────────┐ ┌─────────┐ ┌──────────┐   │
                    │  │Scraper │ │ Memory  │ │PageIndex │   │
                    │  │Service │ │ Layer   │ │(Python)  │   │
                    │  └────┬───┘ └────┬────┘ └────┬─────┘   │
                    │       └──────────┼───────────┘          │
                    │                  v                       │
                    │  ┌─────────────────────────────────┐    │
                    │  │  SQLite (FTS5 + メモリ + タグ)   │    │
                    │  └─────────────────────────────────┘    │
                    │                                          │
                    │  ┌─────────────────────────────────┐    │
                    │  │  Browser Relay (Chrome 拡張)     │    │
                    │  └─────────────────────────────────┘    │
                    └──────────────────────────────────────────┘
```

## プロジェクト構造

```
src/
├── index.ts                  # エントリポイント
├── bot/
│   ├── bot.ts                # Bot 初期化・ミドルウェア
│   ├── commands.ts           # コマンドルーティング
│   └── handlers/             # 各メッセージタイプのハンドラ
├── db/
│   ├── database.ts           # SQLite 初期化・マイグレーション
│   ├── fts.ts                # FTS5 全文検索
│   ├── items.ts              # アイテム CRUD
│   ├── tags.ts               # タグ CRUD
│   ├── memory-store.ts       # メモリカテゴリ・アイテム
│   └── page-indices.ts       # PageIndex ツリー CRUD
├── memory/
│   ├── salience.ts           # Salience スコアリング
│   ├── categorize.ts         # LLM カテゴリ提案・要約
│   ├── retrieve.ts           # Salience 重み付き検索
│   └── proactive.ts          # プロアクティブ提案
├── services/
│   ├── ai.ts                 # 要約・タグ付け・メモリ抽出
│   ├── llm/                  # LLM プロバイダ抽象化
│   ├── scraper.ts            # Web スクレイピング
│   ├── hybrid-search.ts      # 3 層ハイブリッド検索
│   ├── pageindex-bridge.ts   # Python PageIndex 連携
│   ├── browser-relay.ts      # Chrome 拡張 WS リレー
│   └── search-history.ts     # 検索履歴
├── utils/
│   ├── config.ts             # YAML 設定読み込み
│   ├── id.ts                 # ID 生成
│   └── logger.ts             # ロガー
python/
├── pageindex_service.py      # PageIndex Flask サービス
└── pyproject.toml
assets/
└── chrome-extension/         # ブラウザリレー Chrome 拡張 (MV3)
```

## 設定 (`rekolto.config.yaml`)

```yaml
telegram:
  bot_token: ${TELEGRAM_BOT_TOKEN}
  allowed_users: [123456789]

llm:
  profiles:
    default:
      provider: google
      model: gemini-2.5-flash
      api_key: ${GOOGLE_API_KEY}

pageindex:
  llm_profile: default
  min_content_length_for_tree: 3000

memory:
  salience:
    decay_rate: 0.01
    access_boost: 0.1
  proactive:
    enabled: true
    max_suggestions: 3

browser_relay:
  enabled: false
  ws_port: 9222

scraper:
  timeout_ms: 10000
  max_content_length: 50000

database:
  path: ./data/rekolto.db
  backup_dir: ./data/backups
```

## ブラウザリレー（オプション）

x.com 等ボット対策の厳しいサイト向け。Chrome 拡張がログイン済みブラウザセッションを使ってページを取得する。

1. `rekolto.config.yaml` で `browser_relay.enabled: true`
2. Chrome → `chrome://extensions` → デベロッパーモード ON
3. 「パッケージ化されていない拡張機能を読み込む」→ `assets/chrome-extension/`
4. 拡張ポップアップで接続状態（緑）を確認

## ライセンス

MIT
