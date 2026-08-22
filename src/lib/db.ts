import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// SQLite for the MVP: zero-infrastructure and runs anywhere. The schema uses
// UUID text keys, ISO timestamps, and plain SQL so it ports to managed
// Postgres (Neon/RDS) by swapping this module for a pg driver.

const DATA_DIR = process.env.IGC_DATA_DIR ?? path.join(process.cwd(), "data");

declare global {
  // eslint-disable-next-line no-var
  var __igcDb: Database.Database | undefined;
}

function open(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "igc.sqlite"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
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

  CREATE TABLE IF NOT EXISTS person_cards (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    relationship_label TEXT,
    storage_path TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL
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

  -- Secrets live apart from opponent-readable round data (PRD §12).
  CREATE TABLE IF NOT EXISTS round_secrets (
    round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL REFERENCES profiles(id),
    person_card_id TEXT NOT NULL REFERENCES person_cards(id),
    PRIMARY KEY (round_id, owner_id)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    turn_no INTEGER NOT NULL,
    asker_id TEXT NOT NULL REFERENCES profiles(id),
    text TEXT NOT NULL,
    prompt_id TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered')),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS answers (
    question_id TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
    responder_id TEXT NOT NULL REFERENCES profiles(id),
    answer TEXT NOT NULL CHECK (answer IN ('yes','no','not_sure','skip')),
    answered_at TEXT NOT NULL
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

  -- Aggregate analytics only: no names, photos, secrets, or free text (FR-35).
  CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    room_key TEXT,
    mode TEXT,
    turn_no INTEGER,
    prompt_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_rounds_room ON rounds(room_id, number);
  CREATE INDEX IF NOT EXISTS idx_questions_round ON questions(round_id, turn_no);
  CREATE INDEX IF NOT EXISTS idx_cards_deck ON person_cards(deck_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_rooms_expiry ON rooms(expires_at);
  `);
}

export function db(): Database.Database {
  if (!globalThis.__igcDb) globalThis.__igcDb = open();
  return globalThis.__igcDb;
}

export const now = () => new Date().toISOString();

export const DECK_SIZE = Math.max(2, parseInt(process.env.IGC_DECK_SIZE ?? "12", 10) || 12);

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
  relationship_label: string | null;
  storage_path: string;
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
export interface QuestionRow {
  id: string;
  round_id: string;
  turn_no: number;
  asker_id: string;
  text: string;
  prompt_id: string | null;
  status: "open" | "answered";
  created_at: string;
}
export interface AnswerRow {
  question_id: string;
  responder_id: string;
  answer: "yes" | "no" | "not_sure" | "skip";
  answered_at: string;
}
