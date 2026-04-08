# System Setup Directive

## Goal
Initialize and verify the Relationship AI Operating System workspace is correctly configured.

## Prerequisites
- Node.js >= 18 installed (`node --version`)
- npm available (`npm --version`)

## Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
- Open `.env` and fill in your API keys:
  - `ANTHROPIC_API_KEY` — from https://console.anthropic.com (REQUIRED for all modes)
  - `MEMORY_SPREADSHEET_ID` — Google Sheets ID for client memory (production only)
  - `TRIGGER_API_KEY` — from https://cloud.trigger.dev (production only)
  - `TRIGGER_API_URL` — Trigger.dev project URL (production only)
  - `GOOGLE_APPLICATION_CREDENTIALS` — path to `credentials.json` (production only)

### 3. Quick Start — Local Dev Mode
This runs the full AI pipeline with in-memory storage (no Google Sheets or Trigger.dev needed):
```bash
npm run dev:local
```
Or with a specific client ID:
```bash
npx tsx execution/local_dev.ts --client=test-user
```

### 4. Local Dev REPL Commands
- Type messages to chat with the AI
- `profile` — view current client profile
- `debug` — view intent history, timeline events, follow-ups
- `reset` — clear memory and start fresh
- `quit` — exit

### 5. Production Mode — Full Stack
Requires all env vars set (Google Sheets, Trigger.dev, Anthropic):

```bash
# Verify TypeScript compiles
npm run typecheck

# Start Trigger.dev for scheduled tasks
npm run dev

# Deploy Trigger.dev tasks
npm run deploy
```

### 6. Google Sheets Setup (Production)
Create a Google Spreadsheet with two tabs:
- **Profiles** — client profile storage (headers auto-populated on first run)
- **Conversations** — message log (headers auto-populated on first run)

Copy the spreadsheet ID from the URL and set `MEMORY_SPREADSHEET_ID` in `.env`.

## Directory Structure Checklist
- [x] `directives/` — relationship_ai.md, setup.md, add_webhook.md
- [x] `execution/` — all 8 TypeScript modules + personality config + webhooks.json
- [x] `.tmp/` — for intermediate files
- [x] `.env` — with API keys
- [x] `.gitignore` — excludes .env, credentials, .tmp, node_modules
- [x] `package.json` — all dependencies
- [x] `tsconfig.json` — configured for ESM

## Execution Scripts Reference
| Script | Purpose |
|--------|---------|
| `ai_engine.ts` | Core dual-brain engine — Claude integration |
| `memory_store.ts` | Client profile CRUD — Google Sheets |
| `intent_analyzer.ts` | Sales Intelligence Brain — intent/emotion analysis |
| `variability_engine.ts` | 8 response modes + pattern breakers |
| `momentum_engine.ts` | Real-time engagement tracking |
| `proactive_engine.ts` | Trigger.dev scheduled follow-ups |
| `conversation_handler.ts` | Main pipeline router (production) |
| `local_dev.ts` | Interactive REPL (development) |

## Edge Cases
- If `npm install` fails, ensure Node.js >= 18 is installed and on PATH
- Local dev mode only needs `ANTHROPIC_API_KEY` — all other services are stubbed
- Google APIs require OAuth flow on first run — `credentials.json` must be present
- Trigger.dev requires a project to be linked via `npx trigger.dev@latest init`
- If Claude returns malformed JSON in intent analysis, the system falls back to safe defaults
