# Rekolto — PRD (Product Requirements Document)

> **Rekolto** = エスペラント語で「収集する」
> 自分専用の「第二の脳」— Telegram Bot でメモ・URL を投げ込み、AI が整理・記憶し、あとから自然言語で検索できる個人ナレッジツール。

---

## 1. 概要

### 1.1 プロダクトビジョン

「思いついたら Telegram に投げるだけ。あとは Rekolto が覚えておく。」

個人開発者が日常的に遭遇する技術記事、アイデアメモ、コードスニペット、ブックマークを Telegram Bot 経由で一箇所に集約し、AI による自動要約・タグ付け・自然言語検索で「あのとき見たあれ」を瞬時に取り出せるようにする。

### 1.2 解決する課題

- ブックマークは溜まるが見返さない
- メモアプリを開くのが面倒で、思いつきが消えていく
- 「前に読んだ記事なんだったっけ」を思い出せない
- 複数ソースに知識が分散して検索できない

### 1.3 ターゲットユーザー

- 個人開発者（自分自身が最初のユーザー）
- 日常的に Telegram を使っている人
- 技術記事やアイデアをよく読む/メモする人

---

## 2. コア機能

### 2.1 Telegram Bot インターフェース

Telegram Bot が唯一の入力インターフェース。常に手元にあるスマホから最速で投げ込める。

#### 入力パターン

| 入力 | 動作 |
|------|------|
| URL を送信 | Web ページをスクレイピング → 本文抽出 → AI 要約 → タグ自動付与 → 保存 |
| PDF を送信 | PageIndex でツリー構造を生成 → 要約・タグ付与 → 保存 |
| テキストメモを送信 | AI がカテゴリ・タグを推定 → メモリレイヤーに記憶 → 保存 |
| 画像を送信 | OCR でテキスト抽出 → メモとして保存 |
| `/search <クエリ>` | FTS5 + PageIndex ツリー検索 + メモリレイヤーのプロアクティブ提案で関連メモ・記事を返す |
| `/recent` | 直近の保存アイテム一覧を表示 |
| `/tags` | タグ一覧と件数を表示 |
| `/tag <タグ名>` | 特定タグのアイテム一覧 |
| `/random` | ランダムに過去メモを表示（偶発的な再発見） |
| `/stats` | 保存数・タグ分布などの統計 |
| `/delete <id>` | アイテム削除 |
| `/export` | 全データを JSON/Markdown でエクスポート |

#### Bot の応答例

```
ユーザー: https://example.com/blog/rust-async-patterns

Rekolto:
  ✅ 保存しました！

  📄 Rust の非同期パターン完全ガイド
  📝 Rust の async/await における主要な設計パターン（Select, Join, Spawn）
     を実例つきで解説。エラーハンドリングのベストプラクティスも。
  🏷️ #rust #async #design-pattern
  🆔 rklt_a3f8
  🧠 Rekolto: 「あなたは最近 Rust の非同期処理に関心が高まっています」
```

```
ユーザー: /search RAGの実装でチャンク分割どうするんだっけ

Rekolto:
  🔍 3 件見つかりました

  1. 📄 RAG チャンキング戦略比較 (2024/12/15)  [FTS5]
     → Semantic chunking が精度最良。512 トークン + 20% オーバーラップ推奨
     🆔 rklt_b7c2

  2. 📝 自分メモ: LangChain の RecursiveCharacterTextSplitter (2024/12/03)  [FTS5]
     → chunk_size=1000, chunk_overlap=200 でうまくいった
     🆔 rklt_d1e9

  3. 📄 Building Production RAG Systems (2024/11/28)  [PageIndex ツリー検索]
     → §3.2 Late Chunking → §3.2.1 Contextual Retrieval
     🆔 rklt_f4a1

  💡 メモリレイヤーの提案: 「以前保存した LangChain のドキュメントにも
     RecursiveCharacterTextSplitter の詳細があります」
```

### 2.2 カスタムメモリレイヤー

memU（NevaMind-AI/memU）の概念を参考に、TypeScript で自前構築する軽量メモリレイヤー。外部依存なしで Rekolto に内蔵する。

#### memU から引き継ぐ概念

| 概念 | 説明 | Rekolto での実装 |
|------|------|-----------------|
| 階層メモリ | category → item → source の 3 階層構造 | SQLite テーブル（memory_categories, memory_items） |
| memorize ワークフロー | 取り込み → 構造化抽出 → カテゴリ分類 → 永続化 | `src/memory/memorize.ts` |
| memory type | knowledge / profile / skill の 3 種分類 | memory_items.type カラム |
| カテゴリ自動生成・要約 | LLM で適切なカテゴリを自動決定、要約も生成 | `src/memory/categorize.ts` |
| salience スコアリング | アクセス頻度に基づく重み付け | `src/memory/salience.ts` |
| プロアクティブ提案 | 検索時に関連情報を先回りして提示 | `src/memory/proactive.ts` |

#### Rekolto メモリ構造（SQLite テーブル）

```sql
-- メモリカテゴリ
CREATE TABLE memory_categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT UNIQUE NOT NULL,       -- カテゴリ名（例: "Rust", "AI/ML"）
  summary     TEXT,                       -- カテゴリの要約（LLM 生成）
  item_count  INTEGER DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- メモリアイテム（抽出されたファクト・知識）
CREATE TABLE memory_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id  INTEGER REFERENCES memory_categories(id),
  type         TEXT NOT NULL,              -- 'knowledge' | 'profile' | 'skill'
  content      TEXT NOT NULL,              -- 抽出されたファクト・知識
  source_id    TEXT REFERENCES items(id),  -- 元アイテムへの参照
  salience     REAL DEFAULT 0.0,          -- salience スコア（0.0〜1.0）
  access_count INTEGER DEFAULT 0,
  last_accessed DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### memorize ワークフロー

```
[ユーザーがメモ/URLを送信]
        │
        ▼
[memorize()]  ──→  LLM で構造化抽出（ファクト・知識・スキル）
        │              + カテゴリ自動分類
        │              + SQLite に永続化
        ▼
[salience 更新]  ──→  アクセス頻度・関連度でスコア更新
        │
        ▼
[次回の検索時]
        │
        ▼
[retrieve()]  ──→  FTS5 高速検索 + salience 重み付き結果
   or
[proactive()]  ──→  検索コンテキストから関連メモリを先回り提示
```

#### 検索バックエンド

メモリレイヤーの検索はベクトル検索を使わず、以下の 2 系統で実現する:

- **FTS5**: 短いメモ・タグ・タイトル・抽出ファクトに対する高速全文検索（ミリ秒オーダー）
- **PageIndex ツリー検索**: 長文ドキュメントのセクション特定（LLM 推論、高精度）

### 2.3 PageIndex による統一検索エンジン

PageIndex（VectifyAI/PageIndex）をドキュメントインデックスとして統合する。PageIndex はベクトル DB もチャンキングも不要な、推論ベースの RAG システムで、長文ドキュメントの「人間らしい検索」を実現する。

**Rekolto における PageIndex の位置づけ**: ベクトル検索を完全に置き換える統一検索エンジン。Embedding API は一切使用しない。

#### Rekolto における PageIndex の役割

| 機能 | 説明 |
|------|------|
| ベクトルレス検索 | ベクトル類似度ではなく、LLM の推論でドキュメント内を探索。「似ている」ではなく「関連している」を見つける |
| ツリーインデックス生成 | 保存した長文記事・PDF を階層的な目次ツリーに変換。人間が目次をたどるように、LLM がツリーを辿って情報を見つける |
| チャンキング不要 | 文書を自然なセクション単位で管理。人工的なチャンク分割による文脈の断絶がない |
| 高い説明可能性 | 「§3.2 → §3.2.1」のようにどのセクションから情報を取得したかが明確 |
| SQLite ストレージ | ツリー構造は JSON テキストとして SQLite に保存。外部データベース不要 |

#### PageIndex 統合フロー

```
[URL/PDF を保存]
        │
        ▼
[本文抽出 (Readability / PDF パース)]
        │
        ▼
[PageIndex run_pageindex]
        │
        ▼
[ツリー構造インデックス生成]
        │
  {
    "title": "Rust Async Patterns Guide",
    "summary": "Comprehensive guide to...",
    "nodes": [
      {
        "title": "Select Pattern",
        "start_index": 1, "end_index": 5,
        "summary": "Using tokio::select!...",
        "nodes": [...]
      },
      ...
    ]
  }
        │
        ▼
[SQLite に保存]  ──→  検索時にツリーサーチで該当セクションを特定
```

#### 検索時の動作

```
/search "Rustで複数のfutureを同時に待つ方法"
        │
        ▼
[PageIndex ツリーサーチ]
  ルート → "Concurrency Patterns" → "Select Pattern" → 該当セクション特定
        │
        ▼
[該当セクションのテキスト + ページ参照を返却]
  → §2.3 Select Pattern (p.12-15)
  → 「tokio::select! マクロで複数の Future を同時に待機し、
     最初に完了したものを処理する」
```

### 2.4 3 層ハイブリッド検索

FTS5、PageIndex、LLM リランキングを組み合わせた 3 層検索アーキテクチャ。

```
/search <クエリ>
        │
        ├──→ [Layer 1: SQLite FTS5]
        │      短いメモ・タグ・タイトル・抽出ファクトの全文検索
        │      → 無料、ミリ秒オーダー
        │
        ├──→ [Layer 2: PageIndex ツリー検索]
        │      長文ドキュメントのセクション特定
        │      → LLM 推論、高精度
        │
        └──→ [Layer 3: LLM リランキング]
               Layer 1 + Layer 2 の結果をマージ
               → 意図マッチング + salience 重み付け + プロアクティブ提案
```

| 検索レイヤー | 得意なこと | コスト | レイテンシ |
|-------------|-----------|--------|-----------|
| SQLite FTS5 | 短いメモ、タグ、タイトル、抽出ファクト | 無料 | ミリ秒 |
| PageIndex ツリー検索 | 長文の構造化検索、セクション特定、説明可能性 | LLM API | 数秒 |
| LLM リランキング | 意図マッチング、結果統合、プロアクティブ提案 | LLM API | 数秒 |

通常の検索は FTS5 + PageIndex で処理し、LLM リランキングで結果をマージ・最適化する。

### 2.5 Web スクレイピング & 本文抽出

URL が送信された際に自動で以下を実行する。

#### 通常モード（HTTP + Readability）

- HTTP リクエストで HTML を取得
- Readability アルゴリズムで本文を抽出（広告・ナビを除去）
- メタデータ取得（タイトル、OGP 画像、公開日）
- AI で要約（2〜3 行）とタグ（最大 5 個）を自動生成
- 長文記事の場合は PageIndex でツリーインデックスも生成

#### ブラウザリレーモード（対策サイト用）

x.com 等ボット対策の厳しいサイト向けに、openclaw の Chrome 拡張リレーを参考にしたブラウザリレーを用意する。デスクトップ PC 上で動作するため、実ブラウザとの連携が自然。

| コンポーネント | 説明 |
|--------------|------|
| Chrome 拡張（MV3） | 実ブラウザのタブを `chrome.debugger` API で制御。ログイン済みセッションをそのまま利用 |
| WebSocket リレーサーバー | Rekolto ↔ Chrome 拡張間のローカル通信を仲介 |
| フォールバック制御 | 通常サイト → HTTP + Readability、対策サイト → ブラウザリレーに自動切り替え |

```
[URL 受信]
    │
    ├─ 通常サイト ──→ HTTP + Readability ──→ 本文抽出
    │
    └─ 対策サイト ──→ WebSocket ──→ Chrome 拡張 ──→ 実ブラウザで取得
         (x.com等)      リレー       (debugger API)     ──→ 本文抽出
```

### 2.6 AI 要約 & 自動タグ付け

保存される全アイテムに対して自動で実行。

- 要約: 2〜3 行の簡潔な要約
- タグ: 既存タグとの一貫性を保ちつつ、新規タグも提案（メモリレイヤーのカテゴリと同期）
- カテゴリ: article / memo / code / idea / reference から自動分類

### 2.7 データエクスポート

`/export` で全データをエクスポート可能。ロックインしない設計。

- JSON 形式（完全データ + メモリレイヤー構造 + PageIndex ツリー）
- Markdown 形式（Obsidian 互換）

---

## 3. アーキテクチャ

### 3.1 技術スタック

| レイヤー | 技術 | 理由 |
|---------|------|------|
| 言語 | TypeScript + Python | Bot・メモリレイヤーは TS、PageIndex は Python |
| ランタイム | Node.js (Bun も可) | Telegram Bot ライブラリの充実 |
| Telegram Bot | grammY | 軽量・高機能・TypeScript ファースト |
| メモリエンジン | **カスタムメモリレイヤー（TS 内蔵）** | memU の概念を参考に自前構築。外部依存なし |
| ドキュメントインデックス | **PageIndex** (VectifyAI/PageIndex) | ベクトルレス推論検索、ツリー構造インデックス |
| LLM | **プロバイダ交換可能**（Claude / GPT / ローカルモデル等） | 設定で自由に切り替え |
| 全文検索 | **SQLite FTS5** | 無料・高速・組み込み |
| データベース | **SQLite** | 単一ファイル、サーバープロセス不要、バックアップはファイルコピー |
| Web スクレイピング | Readability + cheerio / **ブラウザリレー**（対策サイト用） | 通常サイトとボット対策サイトの両方に対応 |
| プロセス間通信 | Python subprocess / HTTP API | TS ↔ Python 間のブリッジ |
| ホスティング | **デスクトップ PC（ローカル）** | セルフホスト、常時起動、VPS 不要 |

### 3.1.1 LLM プロバイダ抽象化

LLM プロバイダを設定で自由に切り替え可能にする。用途別に異なるモデルを指定できる。

```yaml
llm:
  profiles:
    default:          # 要約・タグ付け・メモリ抽出用
      provider: anthropic
      model: claude-sonnet-4-20250514
      api_key: ${ANTHROPIC_API_KEY}
    pageindex:        # PageIndex ツリー生成・検索用
      provider: openai
      model: gpt-4o
      api_key: ${OPENAI_API_KEY}
    local:            # ローカルモデル（オプション）
      provider: openai-compatible
      base_url: http://localhost:11434/v1
      model: llama3
```

TS 側で共通インターフェースを定義し、プロバイダアダプターで差し替える:

```typescript
// src/services/llm/provider.ts
interface LLMProvider {
  chat(messages: Message[], options?: ChatOptions): Promise<string>;
}

// プロバイダアダプター
// src/services/llm/anthropic.ts  — Claude API
// src/services/llm/openai.ts     — OpenAI API
// src/services/llm/openai-compatible.ts — OpenAI 互換 API（ローカルモデル等）
```

### 3.2 システム構成図

```
┌─────────────┐     ┌──────────────────────────────────────────────┐
│  Telegram    │     │  Rekolto (デスクトップ PC)                    │
│  (スマホ/PC) │────>│                                              │
│             │<────│  ┌─────────┐  ┌────────┐  ┌──────────────┐  │
└─────────────┘     │  │ grammY  │─>│ Router │─>│  Handlers    │  │
                    │  │ Bot     │  │ (TS)   │  │  (TS)        │  │
                    │  └─────────┘  └────────┘  └──────┬───────┘  │
                    │                                   │          │
                    │       ┌─────────────┬─────────────┤          │
                    │       v             v             v          │
                    │ ┌──────────┐ ┌───────────┐ ┌───────────┐   │
                    │ │ Scraper  │ │ Memory    │ │ PageIndex │   │
                    │ │ Service  │ │ Layer     │ │ Service   │   │
                    │ │(TS/Relay)│ │ (TS)      │ │ (Python)  │   │
                    │ └──────────┘ └─────┬─────┘ └─────┬─────┘   │
                    │       │            │             │          │
                    │       v            v             v          │
                    │  ┌─────────────────────────────────────┐    │
                    │  │  SQLite (rekolto.db)                │    │
                    │  │  items | tags | FTS5 | memory_*     │    │
                    │  │  page_indices | search_history       │    │
                    │  └─────────────────────────────────────┘    │
                    │                                              │
                    │  ┌─────────────────────────────────────┐    │
                    │  │  Browser Relay (対策サイト用)         │    │
                    │  │  Chrome 拡張 ↔ WebSocket リレー      │    │
                    │  └─────────────────────────────────────┘    │
                    └──────────────────────────────────────────────┘
```

### 3.3 データモデル

```sql
-- メインのアイテムテーブル
CREATE TABLE items (
  id          TEXT PRIMARY KEY,    -- rklt_ + nanoid(4)
  type        TEXT NOT NULL,       -- 'article' | 'memo' | 'code' | 'idea' | 'reference'
  title       TEXT,
  url         TEXT,
  content     TEXT NOT NULL,       -- 元のテキスト or 抽出本文
  summary     TEXT,                -- AI 生成の要約
  og_image    TEXT,                -- OGP 画像 URL
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- タグテーブル（多対多）
CREATE TABLE tags (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT UNIQUE NOT NULL
);

CREATE TABLE item_tags (
  item_id  TEXT REFERENCES items(id) ON DELETE CASCADE,
  tag_id   INTEGER REFERENCES tags(id),
  PRIMARY KEY (item_id, tag_id)
);

-- FTS5 仮想テーブル（アイテム全文検索）
CREATE VIRTUAL TABLE items_fts USING fts5(
  title, content, summary,
  content='items',
  content_rowid='rowid'
);

-- PageIndex ツリーインデックス
CREATE TABLE page_indices (
  item_id    TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  tree_json  TEXT NOT NULL,         -- PageIndex が生成したツリー構造（JSON）
  page_count INTEGER,              -- 総ページ数
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- メモリカテゴリ
CREATE TABLE memory_categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT UNIQUE NOT NULL,
  summary     TEXT,
  item_count  INTEGER DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- メモリアイテム（抽出されたファクト・知識）
CREATE TABLE memory_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id  INTEGER REFERENCES memory_categories(id),
  type         TEXT NOT NULL,       -- 'knowledge' | 'profile' | 'skill'
  content      TEXT NOT NULL,       -- 抽出されたファクト・知識
  source_id    TEXT REFERENCES items(id),
  salience     REAL DEFAULT 0.0,   -- salience スコア（0.0〜1.0）
  access_count INTEGER DEFAULT 0,
  last_accessed DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- メモリアイテム FTS5
CREATE VIRTUAL TABLE memory_items_fts USING fts5(
  content,
  content='memory_items',
  content_rowid='rowid'
);

-- 検索履歴（意図学習・プロアクティブ提案用）
CREATE TABLE search_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  query      TEXT NOT NULL,
  results    TEXT,                  -- 返却した結果 ID リスト（JSON）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. 開発フェーズ

### Phase 1: MVP

最小限の動作を確認する。

- [ ] Telegram Bot の起動と基本メッセージ受信
- [ ] テキストメモの保存（SQLite）
- [ ] URL 送信 → 本文抽出 → 保存
- [ ] LLM で要約 & タグ自動生成（プロバイダ交換可能）
- [ ] メモリレイヤー memorize() でメモリへの取り込み・構造化抽出
- [ ] SQLite FTS5 でキーワード検索
- [ ] `/recent` で直近アイテム表示

### Phase 2: PageIndex 統合 & ハイブリッド検索

長文ドキュメントの構造化検索を追加する。

- [ ] PageIndex でツリーインデックス生成パイプライン
- [ ] PDF 送信対応（Telegram のファイル受信）
- [ ] PageIndex ツリーサーチによるセクション特定
- [ ] 3 層ハイブリッド検索エンジン（FTS5 + PageIndex + LLM リランキング）
- [ ] 検索結果のマージ & ランキング

### Phase 3: プロアクティブ体験

メモリレイヤーのプロアクティブ機能で「先回り」する体験を作る。

- [ ] salience スコアリングの実装（アクセス頻度に基づく重み付け）
- [ ] 保存時に「最近の関心に関連するアイテム」を自動提示
- [ ] ユーザーの関心・意図の学習（検索履歴ベース）
- [ ] `/insight` — メモリレイヤーが学習した自分の関心・パターンを表示
- [ ] 週次ダイジェスト配信（カテゴリサマリーベース）

### Phase 4: ブラウザリレー & 体験の磨き込み

対策サイト対応と日常利用のための機能を追加する。

- [ ] ブラウザリレー Chrome 拡張（MV3）の実装
- [ ] WebSocket リレーサーバーの実装
- [ ] x.com 等ボット対策サイトのスクレイピング対応
- [ ] 画像送信 → OCR → メモ保存
- [ ] `/random` — 偶発的再発見機能
- [ ] `/stats` — 統計ダッシュボード
- [ ] `/export` — JSON / Markdown エクスポート
- [ ] `/delete` — アイテム削除
- [ ] Inline keyboard でタグの編集・修正
- [ ] 重複 URL の検知と通知

### Phase 5: 発展（将来）

- [ ] Web UI ダッシュボード（PageIndex ツリーの可視化を含む）
- [ ] Obsidian との双方向同期
- [ ] 複数 LLM プロファイルの高度な活用（用途別の最適モデル選定）
- [ ] PageIndex の Vision モード対応（OCR 不要の PDF 画像直接解析）

---

## 5. 非機能要件

### 5.1 パフォーマンス

- Bot の応答: 1 秒以内にリアクション（⏳ 表示）、処理完了後に結果表示
- FTS5 検索: 1000 件規模で 50ms 以内
- PageIndex ツリー検索: 5 秒以内
- PageIndex ツリー生成: 長文記事で 30 秒以内（非同期処理）
- スクレイピング: タイムアウト 10 秒

### 5.2 データ安全性

- SQLite ファイルの定期コピー（日次）でバックアップ完了
- 全データはローカルデスクトップ PC に保存（第三者サービスに依存しない）
- API キーは環境変数で管理

### 5.3 コスト設計

個人利用を前提にした低コスト運用。

| 項目 | 見積もり |
|------|---------|
| LLM API（要約・タグ付け・ツリー生成・検索） | 〜$6/月（1日 20 記事想定、プロバイダ次第でさらに低減可能） |
| Embedding API | **$0**（不使用） |
| VPS / サーバー | **$0**（デスクトップ PC で動作） |
| **合計** | **〜$6/月** |

### 5.4 セルフホスト容易性

- Docker 不要も可 — 単一プロセス + SQLite ファイルで動作
- 環境変数は `.env` ファイル 1 つ
- PageIndex は Python 依存として同梱
- バックアップは `rekolto.db` をコピーするだけ

---

## 6. 設定ファイル

```yaml
# rekolto.config.yaml
telegram:
  bot_token: ${TELEGRAM_BOT_TOKEN}
  allowed_users:
    - 123456789  # 自分の Telegram user ID のみ許可

# LLM プロバイダ設定（プロファイル形式で交換可能）
llm:
  profiles:
    default:          # 要約・タグ付け・メモリ抽出用
      provider: anthropic
      model: claude-sonnet-4-20250514
      api_key: ${ANTHROPIC_API_KEY}
    pageindex:        # PageIndex ツリー生成・検索用
      provider: openai
      model: gpt-4o
      api_key: ${OPENAI_API_KEY}
    local:            # ローカルモデル（オプション）
      provider: openai-compatible
      base_url: http://localhost:11434/v1
      model: llama3

# PageIndex 設定
pageindex:
  llm_profile: pageindex    # 使用する LLM プロファイル
  max_pages_per_node: 10
  min_content_length_for_tree: 3000  # これ以上の長さの記事にツリー生成

# メモリレイヤー設定
memory:
  salience:
    decay_rate: 0.01         # 時間経過による salience 減衰率
    access_boost: 0.1        # アクセス時のスコア上昇量
  proactive:
    enabled: true            # プロアクティブ提案の ON/OFF
    max_suggestions: 3       # 提案の最大件数

# ブラウザリレー設定
browser_relay:
  enabled: false             # デフォルト無効（Phase 4 で有効化）
  ws_port: 9222              # WebSocket リレーサーバーのポート

scraper:
  timeout_ms: 10000
  max_content_length: 50000

database:
  path: ./data/rekolto.db    # SQLite ファイルパス
  backup_dir: ./data/backups
```

---

## 7. 成功指標

自分自身が毎日使い続けているかどうかが最大の指標。

| 指標 | 目標 |
|------|------|
| 日次保存数 | 5 件以上 |
| 週次検索数 | 10 回以上 |
| 検索ヒット率 | 探しものが 80% 以上見つかる |
| メモリレイヤーのプロアクティブ提案の有用率 | 50% 以上「役に立った」 |
| PageIndex 検索でのセクション特定精度 | 正しいセクションを 80% 以上特定 |
| 起動後 1 ヶ月の継続率 | 毎日使っている |

---

## 8. やらないこと（スコープ外）

- マルチユーザー対応（個人ツールに集中）
- リアルタイム共同編集
- モバイルアプリの開発（Telegram が UI）
- 複雑なフォルダ/ノートブック階層（メモリレイヤーの自動カテゴリで十分）
- Web クリッパー（Telegram に URL を投げるだけで良い）
- ブラウザリレーの多ブラウザ対応（Chrome のみ）

---

## 付録: プロジェクト構造

```
rekolto/
├── src/
│   ├── index.ts              # エントリーポイント
│   ├── bot/
│   │   ├── bot.ts            # grammY Bot 初期化
│   │   ├── commands.ts       # コマンドハンドラ定義
│   │   └── handlers/
│   │       ├── url.ts        # URL 受信ハンドラ
│   │       ├── pdf.ts        # PDF 受信ハンドラ（PageIndex 連携）
│   │       ├── memo.ts       # テキストメモハンドラ
│   │       ├── image.ts      # 画像ハンドラ
│   │       └── search.ts     # 検索ハンドラ（3 層ハイブリッド検索）
│   ├── memory/                # カスタムメモリレイヤー（memU 概念ベース）
│   │   ├── memorize.ts       # 取り込み・構造化抽出・永続化
│   │   ├── categorize.ts     # カテゴリ自動生成・分類
│   │   ├── retrieve.ts       # FTS5 + salience 重み付き検索
│   │   ├── salience.ts       # salience スコアリング
│   │   └── proactive.ts      # プロアクティブ提案
│   ├── services/
│   │   ├── scraper.ts        # Web スクレイピング（HTTP + Readability）
│   │   ├── browser-relay.ts  # ブラウザリレー WebSocket クライアント
│   │   ├── pageindex-bridge.ts # PageIndex Python プロセス連携
│   │   ├── hybrid-search.ts  # 3 層ハイブリッド検索統合
│   │   └── llm/              # LLM プロバイダ抽象化
│   │       ├── provider.ts   # 共通インターフェース
│   │       ├── anthropic.ts  # Claude API アダプター
│   │       ├── openai.ts     # OpenAI API アダプター
│   │       └── openai-compatible.ts  # OpenAI 互換 API アダプター
│   ├── db/
│   │   ├── database.ts       # SQLite 接続・マイグレーション
│   │   ├── items.ts          # items CRUD
│   │   ├── tags.ts           # tags CRUD
│   │   ├── page-indices.ts   # PageIndex ツリー CRUD
│   │   ├── memory-store.ts   # memory_categories / memory_items CRUD
│   │   └── fts.ts            # FTS5 インデックス管理
│   └── utils/
│       ├── config.ts         # 設定読み込み
│       ├── id.ts             # ID 生成 (rklt_ + nanoid)
│       └── logger.ts         # ロガー
├── python/                    # Python サービス
│   ├── pageindex_service.py  # PageIndex ラッパー（ツリー生成 / 検索）
│   └── requirements.txt      # PageIndex 依存
├── assets/
│   └── chrome-extension/     # ブラウザリレー Chrome 拡張（Phase 4）
├── data/
│   ├── rekolto.db            # SQLite データベース
│   └── backups/              # バックアップ
├── docker-compose.yml         # オプション（Docker で起動する場合）
├── Dockerfile
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```
