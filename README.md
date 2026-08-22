# In Good Company

Meet the people behind the person.

In Good Company is a two-player guessing game made from the real people in your lives. Each player brings 12 people, chooses one in secret, and sees the other player's deck as their board. You alternate yes-or-no questions — "Are they wearing a hat?" one minute, "Is this the person you would call when everything went wrong?" a few minutes later — privately eliminate faces, and guess who the other player chose.

This repository contains the full working MVP: a link-first Next.js web app implementing the Quick Room mode from the [PRD](docs/PRD.md).

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Open the site, click **Start a game**, build a deck, and send the invite link to the second player (a second browser/incognito window works for trying it alone). No accounts, no external services — state lives in a local SQLite file under `data/`.

```bash
npm run build && npm start        # production build
npm run typecheck                 # strict TypeScript
npm run test:integration          # full two-player game over the API (server must be running)
```

Useful environment variables: `IGC_SECRET` (cookie-signing secret — set in production), `DATABASE_URL` (Postgres connection string — switches storage from local SQLite to Postgres), `IGC_DATA_DIR` (SQLite location), `IGC_DECK_SIZE` (default 12; smaller decks for quick testing).

## Deploy on Vercel

The app auto-detects its storage: with no configuration it uses a local SQLite file (laptops, VPSes); when `DATABASE_URL` is set it runs everything — game state **and photo bytes** — in Postgres, which is what serverless hosts like Vercel require (they have no persistent disk).

1. Import the repo into Vercel (framework: Next.js, no special settings).
2. In the project's **Storage** tab, create a **Neon Postgres** database (free tier) and connect it — Vercel injects `DATABASE_URL` automatically.
3. In **Settings → Environment Variables**, add `IGC_SECRET` set to a long random string.
4. Redeploy. The schema creates itself on first request.

On serverless, realtime falls back from SSE to short polling (a few seconds of latency — fine for a turn-based game), and presence comes from last-seen stamps in the database, so nothing depends on server memory.

## How it's built

- **Next.js App Router + TypeScript.** Server components for shells, client components for the live board. No Supabase — no third-party auth, database, or storage service.
- **Server-authoritative game engine** (`src/lib/game.ts`). Every mutation — join, ready, secret, question, answer, elimination, guess, rematch, delete — is validated in a transaction against the room state machine (PRD §10.1) before any write, with idempotency keys for safe retries.
- **One redaction point** (`src/lib/snapshot.ts`). Everything a client renders comes from a per-viewer snapshot: your own deck always; the opponent's cards only from the active round; their secret only after the reveal; your eliminations only ever yours. The integration test asserts nothing in the payload singles out the secret card.
- **Realtime over SSE** (`src/lib/bus.ts`, `/api/rooms/[id]/events`). One private channel per room, membership-checked before the stream opens. Events carry ids and enums only; clients refetch the authorized snapshot, so canonical state is always the database.
- **Anonymous identity** via a server-issued UUID in a signed HTTP-only cookie (`src/lib/auth.ts`). Invite links carry a high-entropy token; only its hash is stored.
- **Private photo pipeline.** Photos are cropped to card size in the browser (originals never upload), stored outside any public directory, and served only through `/api/images/[cardId]` with owner/room/phase authorization. SQLite via better-sqlite3, schema written to port to managed Postgres.
- **Trust & safety per PRD §13**: consent + adults-only confirmation before readiness, team-safe prompt policy (custom questions disabled), skip-without-penalty answers, immediate deck deletion, 24-hour retention sweep, no-PII analytics, noindex room pages.

## What's here

- **`src/`** — the application (see above).
- **`scripts/integration-test.mjs`** — 44 checks covering the PRD's §16 acceptance criteria and Appendix B security cases: non-member isolation, secret non-leakage, turn/state enforcement, private eliminations, wrong-guess resolution, rematch, deletion.
- **[`index.html`](index.html)** — static marketing-page prototype (the live landing page is `src/app/page.tsx`).
- **[Product Requirements Document](docs/PRD.md)** — build-ready draft (v0.9).
- **[Reference images](docs/reference/)** — visual references, including the warm frosted-card style direction the product follows.

## Not yet built (v1.1+ per PRD §6.2)

Team Session events (organizer lobby, pairing, status dashboard), saved decks / recoverable accounts, CAPTCHA on anonymous sign-up, spicy prompt pack, payments. The data model and engine were shaped so these bolt on without rebuilding the game loop.
