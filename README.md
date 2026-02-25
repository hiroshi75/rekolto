# Rekolto

A personal knowledge management tool powered by a Telegram Bot and a Next.js Web UI. Send memos, URLs, images, or PDFs — the AI automatically summarizes, tags, and memorizes everything, making it searchable by natural language later.

[日本語版はこちら](README.ja.md)

## Features

- **AI Auto-Summary & Tagging** — Just send a memo, URL, image, or PDF; Gemini handles summarization and classification
- **3-Layer Hybrid Search** — SQLite FTS5 (full-text) + PageIndex (tree inference) + LLM re-ranking
- **Memory Layer** — Automatically categorizes saved knowledge, weights by salience score, and offers proactive suggestions
- **Image OCR** — Extracts text from screenshots and photos via Gemini Vision
- **PDF Support** — Text extraction + section search via PageIndex for long documents
- **Browser Relay** — Scrapes bot-protected sites (e.g. x.com) through a Chrome extension
- **Web UI** — Browse, search, and manage your knowledge base from a browser (Next.js)
- **Swappable LLM Providers** — Switch between Gemini / OpenAI / local models in config
- **Single SQLite File** — No server required; backup is just a file copy

## Prerequisites

- Node.js 20+
- Python 3.11+ / [uv](https://docs.astral.sh/uv/)
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Google AI API Key (for Gemini)

## Setup

```bash
git clone https://github.com/yourname/rekolto.git
cd rekolto

# Node.js dependencies
npm install

# Python dependencies (for PageIndex service)
cd python && uv sync && cd ..

# Web UI dependencies
cd web && npm install && cd ..

# Environment variables
cp .env.example .env
# Edit .env to set TELEGRAM_BOT_TOKEN and GOOGLE_API_KEY
```

`.env`:
```
TELEGRAM_BOT_TOKEN=your_bot_token
GOOGLE_API_KEY=your_google_api_key
```

Add your Telegram user ID to `allowed_users` in `rekolto.config.yaml`:
```yaml
telegram:
  bot_token: ${TELEGRAM_BOT_TOKEN}
  allowed_users: [123456789]
```

## Running

### Telegram Bot

```bash
# Development (hot-reload)
npm run dev

# Production
npm run build
npm start
```

### Web UI

```bash
cd web
npm run dev
# Open http://localhost:3000
```

The Web UI shares the same SQLite database as the Telegram Bot. Both can run simultaneously.

## Web UI

The Next.js Web UI provides a browser-based interface to your knowledge base:

- **Search** — Full-text search powered by FTS5, same engine as the bot
- **Item Detail** — View full content, summary, tags, OG images; delete items
- **Tags** — Browse all tags and filter items by tag
- **Insight** — AI-generated weekly digest summarizing your recent interests and trends, rediscovery of forgotten knowledge, key memory items, and category browser
- **Statistics** — Dashboard with item counts, tag counts, memory stats, and type distribution
- **Settings** — Switch UI language (English, Japanese, Chinese Simplified/Traditional, Spanish, Brazilian Portuguese, Korean)

## Bot Commands

| Command | Description |
|---------|-------------|
| `/search <query>` | Hybrid search |
| `/recent` | List recent saves |
| `/tags` | Show all tags |
| `/tag <name>` | Filter by tag |
| `/insight` | Learned interests & categories |
| `/random` | Show a random item |
| `/stats` | Statistics |
| `/delete <ID>` | Delete an item |
| `/export` | JSON export |

You can also just send text, URLs, images, or PDFs directly — they are automatically processed and saved.

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────┐
│  Telegram    │     │  Rekolto                                 │
│  (Phone/PC)  │────>│                                          │
│              │<────│  grammY Bot → Router → Handlers          │
└─────────────┘     │       │          │          │            │
                    │       v          v          v            │
┌─────────────┐     │  ┌────────┐ ┌─────────┐ ┌──────────┐   │
│  Browser     │     │  │Scraper │ │ Memory  │ │PageIndex │   │
│  (Next.js)   │────>│  │Service │ │ Layer   │ │(Python)  │   │
└─────────────┘     │  └────┬───┘ └────┬────┘ └────┬─────┘   │
                    │       └──────────┼───────────┘          │
                    │                  v                       │
                    │  ┌─────────────────────────────────┐    │
                    │  │  SQLite (FTS5 + Memory + Tags)   │    │
                    │  └─────────────────────────────────┘    │
                    │                                          │
                    │  ┌─────────────────────────────────┐    │
                    │  │  Browser Relay (Chrome Extension) │    │
                    │  └─────────────────────────────────┘    │
                    └──────────────────────────────────────────┘
```

## Project Structure

```
src/
├── index.ts                  # Entry point
├── bot/
│   ├── bot.ts                # Bot init & middleware
│   ├── commands.ts           # Command routing
│   └── handlers/             # Message type handlers
├── db/
│   ├── database.ts           # SQLite init & migrations
│   ├── fts.ts                # FTS5 full-text search
│   ├── items.ts              # Item CRUD
│   ├── tags.ts               # Tag CRUD
│   ├── memory-store.ts       # Memory categories & items
│   └── page-indices.ts       # PageIndex tree CRUD
├── memory/
│   ├── salience.ts           # Salience scoring
│   ├── categorize.ts         # LLM category suggestions
│   ├── retrieve.ts           # Salience-weighted retrieval
│   └── proactive.ts          # Proactive suggestions
├── services/
│   ├── ai.ts                 # Summarization, tagging, memory extraction
│   ├── llm/                  # LLM provider abstraction
│   ├── scraper.ts            # Web scraping
│   ├── hybrid-search.ts      # 3-layer hybrid search
│   ├── pageindex-bridge.ts   # Python PageIndex bridge
│   ├── browser-relay.ts      # Chrome extension WS relay
│   └── search-history.ts     # Search history
├── utils/
│   ├── config.ts             # YAML config loader
│   ├── id.ts                 # ID generation
│   └── logger.ts             # Logger
web/
├── app/                      # Next.js App Router pages
│   ├── page.tsx              # Search (main)
│   ├── items/[id]/page.tsx   # Item detail
│   ├── tags/page.tsx         # All tags
│   ├── tags/[name]/page.tsx  # Items by tag
│   ├── insight/page.tsx      # Memory insight + AI digest
│   ├── stats/page.tsx        # Statistics dashboard
│   └── settings/page.tsx     # Language settings
├── lib/
│   ├── db.ts                 # DB queries (shared SQLite)
│   ├── actions.ts            # Server Actions
│   ├── i18n.ts               # Internationalization (7 languages)
│   └── ai.ts                 # LLM insight summary generation
└── components/               # Reusable UI components
python/
├── pageindex_service.py      # PageIndex Flask service
└── pyproject.toml
assets/
└── chrome-extension/         # Browser Relay Chrome Extension (MV3)
```

## Configuration (`rekolto.config.yaml`)

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
  ws_port: 9333

scraper:
  timeout_ms: 10000
  max_content_length: 50000

database:
  path: ./data/rekolto.db
  backup_dir: ./data/backups
```

## Browser Relay (Optional)

For bot-protected sites like x.com. The Chrome extension uses the logged-in browser session to fetch pages.

1. Set `browser_relay.enabled: true` in `rekolto.config.yaml`
2. Chrome → `chrome://extensions` → Enable Developer Mode
3. "Load unpacked" → select `assets/chrome-extension/`
4. Check the extension popup for a green connection status

## License

MIT
