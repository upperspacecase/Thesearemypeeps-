import fs from "node:fs";
import path from "node:path";

// Dual-driver data layer with one async interface:
//  - DATABASE_URL / POSTGRES_URL set → Postgres (Neon, RDS, Vercel Postgres…)
//    — required on serverless hosts like Vercel, where there is no disk.
//  - otherwise → local SQLite file, zero-setup for development.
// SQL is written once with `?` placeholders in a dialect both engines accept;
// photo bytes live in the database (card_images), so no filesystem is needed.

export interface Exec {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<void>;
}
export interface Db extends Exec {
  tx<T>(fn: (t: Exec) => Promise<T>): Promise<T>;
}

// Vercel's Postgres integrations set several of these depending on provider.
const PG_URL =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.DATABASE_POSTGRES_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

/** A misconfigured deployment, not a bug — surfaced verbatim to the operator. */
export class ConfigError extends Error {}

export const storageDriver = (): "postgres" | "sqlite" => (PG_URL ? "postgres" : "sqlite");

function ddl(dialect: "sqlite" | "pg"): string {
  const AUTOID =
    dialect === "pg" ? "BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT";
  const BYTES = dialect === "pg" ? "BYTEA" : "BLOB";
  return `
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL DEFAULT '',
    is_anonymous INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    host_id TEXT NOT NULL REFERENCES profiles(id),
    mode TEXT NOT NULL DEFAULT 'quick',
    status TEXT NOT NULL DEFAULT 'waiting_for_player'
      CHECK (status IN ('waiting_for_player','deck_setup','secret_selection','active','completed','rematch','ended','expired')),
    prompt_policy TEXT NOT NULL DEFAULT 'friends' CHECK (prompt_policy IN ('friends','team_safe')),
    invite_token_hash TEXT NOT NULL UNIQUE,
    locked INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS room_players (
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES profiles(id),
    seat INTEGER NOT NULL CHECK (seat IN (1,2)),
    ready_at TEXT,
    joined_at TEXT NOT NULL,
    last_seen_at TEXT,
    PRIMARY KEY (room_id, user_id),
    UNIQUE (room_id, seat)
  );

  CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES profiles(id),
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    consent_confirmed_at TEXT,
    consent_version TEXT NOT NULL DEFAULT 'v1',
    status TEXT NOT NULL DEFAULT 'building' CHECK (status IN ('building','ready','deleted')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (owner_id, room_id)
  );

  -- A card is a photo and a first name. Nothing else: no notes, no labels.
  CREATE TABLE IF NOT EXISTS person_cards (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS card_images (
    card_id TEXT PRIMARY KEY REFERENCES person_cards(id) ON DELETE CASCADE,
    mime TEXT NOT NULL,
    bytes ${BYTES} NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rounds (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'secret_selection' CHECK (status IN ('secret_selection','active','completed')),
    active_player_id TEXT,
    winner_id TEXT,
    started_at TEXT,
    ended_at TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (room_id, number)
  );

  CREATE TABLE IF NOT EXISTS round_secrets (
    round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL REFERENCES profiles(id),
    person_card_id TEXT NOT NULL REFERENCES person_cards(id),
    PRIMARY KEY (round_id, owner_id)
  );

  CREATE TABLE IF NOT EXISTS eliminations (
    round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES profiles(id),
    person_card_id TEXT NOT NULL REFERENCES person_cards(id),
    eliminated INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (round_id, player_id, person_card_id)
  );

  CREATE TABLE IF NOT EXISTS guesses (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES profiles(id),
    person_card_id TEXT NOT NULL REFERENCES person_cards(id),
    correct INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rematch_requests (
    round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES profiles(id),
    created_at TEXT NOT NULL,
    PRIMARY KEY (round_id, player_id)
  );

  CREATE TABLE IF NOT EXISTS processed_actions (
    idempotency_key TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS analytics_events (
    id ${AUTOID},
    event TEXT NOT NULL,
    room_key TEXT,
    mode TEXT,
    turn_no INTEGER,
    prompt_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_rounds_room ON rounds(room_id, number);
  CREATE INDEX IF NOT EXISTS idx_cards_deck ON person_cards(deck_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_rooms_expiry ON rooms(expires_at);
  `;
}

// ------------------------------------------------------------- SQLite driver

function makeSqlite(): Db {
  // Serverless hosts have no writable, persistent disk. Rather than fail with
  // a mystery error on the first write, say exactly what is missing.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new ConfigError(
      "This deployment has no database connected yet. Add a Postgres database (Vercel → Storage → Neon) so DATABASE_URL is set, then redeploy."
    );
  }
  // Lazy require keeps the native module out of serverless bundles.
  let Database: typeof import("better-sqlite3");
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Database = require("better-sqlite3") as typeof import("better-sqlite3");
  } catch {
    throw new ConfigError(
      "No database available: set DATABASE_URL to a Postgres connection string, or install better-sqlite3 for local development."
    );
  }
  const dataDir = process.env.IGC_DATA_DIR ?? path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const sq = new Database(path.join(dataDir, "igc.sqlite"));
  sq.pragma("journal_mode = WAL");
  sq.pragma("foreign_keys = ON");
  sq.exec(ddl("sqlite"));

  const direct: Exec = {
    async all<T>(sql: string, params: unknown[] = []) {
      return sq.prepare(sql).all(...params) as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      return sq.prepare(sql).get(...params) as T | undefined;
    },
    async run(sql: string, params: unknown[] = []) {
      sq.prepare(sql).run(...params);
    },
  };

  // One connection → serialize top-level ops and transactions so an awaited
  // callback inside tx() can't interleave with other requests' statements.
  let chain: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
    const p = chain.then(job, job);
    chain = p.catch(() => {});
    return p;
  };

  return {
    all: (sql, params) => enqueue(() => direct.all(sql, params)),
    get: (sql, params) => enqueue(() => direct.get(sql, params)),
    run: (sql, params) => enqueue(() => direct.run(sql, params)),
    tx: (fn) =>
      enqueue(async () => {
        sq.exec("BEGIN");
        try {
          const result = await fn(direct);
          sq.exec("COMMIT");
          return result;
        } catch (err) {
          sq.exec("ROLLBACK");
          throw err;
        }
      }),
  };
}

// ------------------------------------------------------------ Postgres driver

function toPgSql(sql: string): string {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

function makePg(url: string): Db {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as typeof import("pg");
  const needsSsl = /sslmode=require|neon\.tech|supabase|render\.com|aws/.test(url) || !!process.env.VERCEL;
  const pool = new Pool({
    connectionString: url,
    max: 3,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });

  const ready: Promise<void> = (async () => {
    const client = await pool.connect();
    try {
      await client.query(ddl("pg"));
    } finally {
      client.release();
    }
  })();

  const execOn = (q: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>): Exec => ({
    async all<T>(sql: string, params: unknown[] = []) {
      await ready;
      const res = await q(toPgSql(sql), params);
      return res.rows as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      await ready;
      const res = await q(toPgSql(sql), params);
      return res.rows[0] as T | undefined;
    },
    async run(sql: string, params: unknown[] = []) {
      await ready;
      await q(toPgSql(sql), params);
    },
  });

  const base = execOn((text, values) => pool.query(text, values));

  return {
    ...base,
    async tx<T>(fn: (t: Exec) => Promise<T>): Promise<T> {
      await ready;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(execOn((text, values) => client.query(text, values)));
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

// ----------------------------------------------------------------- singleton

declare global {
  // eslint-disable-next-line no-var
  var __igcDbAsync: Db | undefined;
}

export function db(): Db {
  if (!globalThis.__igcDbAsync) {
    globalThis.__igcDbAsync = PG_URL ? makePg(PG_URL) : makeSqlite();
  }
  return globalThis.__igcDbAsync;
}

export const now = () => new Date().toISOString();

// Deck size is a range: bring at least DECK_MIN people, at most DECK_MAX.
export const DECK_MIN = Math.max(2, parseInt(process.env.IGC_DECK_MIN ?? "5", 10) || 5);
export const DECK_MAX = Math.max(DECK_MIN, parseInt(process.env.IGC_DECK_MAX ?? "15", 10) || 15);

// Postgres returns COUNT(*) as a string; normalize wherever we count.
export const asInt = (v: unknown): number => (typeof v === "string" ? parseInt(v, 10) : (v as number)) || 0;

// ---- row types ----
export interface ProfileRow {
  id: string;
  display_name: string;
  is_anonymous: number;
}
export interface RoomRow {
  id: string;
  host_id: string;
  mode: string;
  status:
    | "waiting_for_player"
    | "deck_setup"
    | "secret_selection"
    | "active"
    | "completed"
    | "rematch"
    | "ended"
    | "expired";
  prompt_policy: "friends" | "team_safe";
  invite_token_hash: string;
  locked: number;
  expires_at: string;
  created_at: string;
}
export interface RoomPlayerRow {
  room_id: string;
  user_id: string;
  seat: number;
  ready_at: string | null;
  joined_at: string;
  last_seen_at: string | null;
}
export interface DeckRow {
  id: string;
  owner_id: string;
  room_id: string;
  consent_confirmed_at: string | null;
  status: "building" | "ready" | "deleted";
}
export interface PersonCardRow {
  id: string;
  deck_id: string;
  display_name: string;
  sort_order: number;
}
export interface RoundRow {
  id: string;
  room_id: string;
  number: number;
  status: "secret_selection" | "active" | "completed";
  active_player_id: string | null;
  winner_id: string | null;
}
