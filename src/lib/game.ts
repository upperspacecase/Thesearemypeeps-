import { randomUUID } from "node:crypto";
import {
  db,
  now,
  DECK_SIZE,
  type RoomRow,
  type RoomPlayerRow,
  type DeckRow,
  type PersonCardRow,
  type RoundRow,
  type QuestionRow,
} from "./db";
import { hashToken, newInviteToken } from "./tokens";
import { publish } from "./bus";
import { deleteCardImage } from "./storage";
import { promptById } from "./prompts";
import { track } from "./analytics";

// Every gameplay mutation lives here, runs inside a transaction, validates
// the actor + room state before writing (PRD §11.4), and publishes its
// realtime event only after the write commits.

export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const EXPIRY_HOURS = 24;

function bumpExpiry(roomId: string) {
  const expires = new Date(Date.now() + EXPIRY_HOURS * 3600_000).toISOString();
  db().prepare("UPDATE rooms SET expires_at = ?, updated_at = ? WHERE id = ?").run(expires, now(), roomId);
}

export function getRoom(roomId: string): RoomRow {
  const room = db().prepare("SELECT * FROM rooms WHERE id = ?").get(roomId) as RoomRow | undefined;
  if (!room) throw new GameError("Room not found", 404);
  if (room.status !== "expired" && room.expires_at < now()) {
    db().prepare("UPDATE rooms SET status = 'expired', updated_at = ? WHERE id = ?").run(now(), roomId);
    room.status = "expired";
  }
  return room;
}

export function getMembership(roomId: string, userId: string): RoomPlayerRow {
  const m = db()
    .prepare("SELECT * FROM room_players WHERE room_id = ? AND user_id = ?")
    .get(roomId, userId) as RoomPlayerRow | undefined;
  if (!m) throw new GameError("You are not in this room", 403);
  return m;
}

export function players(roomId: string): RoomPlayerRow[] {
  return db().prepare("SELECT * FROM room_players WHERE room_id = ? ORDER BY seat").all(roomId) as RoomPlayerRow[];
}

export function currentRound(roomId: string): RoundRow | undefined {
  return db()
    .prepare("SELECT * FROM rounds WHERE room_id = ? ORDER BY number DESC LIMIT 1")
    .get(roomId) as RoundRow | undefined;
}

function deckFor(roomId: string, userId: string): DeckRow | undefined {
  return db()
    .prepare("SELECT * FROM decks WHERE room_id = ? AND owner_id = ? AND status != 'deleted'")
    .get(roomId, userId) as DeckRow | undefined;
}

function cardsOf(deckId: string): PersonCardRow[] {
  return db()
    .prepare("SELECT * FROM person_cards WHERE deck_id = ? ORDER BY sort_order")
    .all(deckId) as PersonCardRow[];
}

function opponentOf(roomId: string, userId: string): RoomPlayerRow | undefined {
  return players(roomId).find((p) => p.user_id !== userId);
}

// ---------------------------------------------------------------- creation

export function createRoom(userId: string, opts: { displayName?: string; promptPolicy?: string }) {
  const token = newInviteToken();
  const roomId = randomUUID();
  const policy = opts.promptPolicy === "team_safe" ? "team_safe" : "friends";
  const t = now();
  db().transaction(() => {
    if (opts.displayName) setDisplayNameRow(userId, opts.displayName);
    db()
      .prepare(
        `INSERT INTO rooms (id, host_id, mode, status, prompt_policy, invite_token_hash, locked, expires_at, created_at, updated_at)
         VALUES (?, ?, 'quick', 'waiting_for_player', ?, ?, 0, ?, ?, ?)`
      )
      .run(roomId, userId, policy, hashToken(token), new Date(Date.now() + EXPIRY_HOURS * 3600_000).toISOString(), t, t);
    db()
      .prepare("INSERT INTO room_players (room_id, user_id, seat, joined_at) VALUES (?, ?, 1, ?)")
      .run(roomId, userId, t);
    createDeckRow(roomId, userId);
  })();
  track("room_created", { roomId, mode: policy });
  return { roomId, inviteToken: token };
}

function createDeckRow(roomId: string, userId: string) {
  db()
    .prepare(
      "INSERT INTO decks (id, owner_id, room_id, status, created_at, updated_at) VALUES (?, ?, ?, 'building', ?, ?)"
    )
    .run(randomUUID(), userId, roomId, now(), now());
}

export function joinByToken(userId: string, token: string, displayName?: string): { roomId: string } {
  const room = db()
    .prepare("SELECT * FROM rooms WHERE invite_token_hash = ?")
    .get(hashToken(token)) as RoomRow | undefined;
  if (!room) throw new GameError("This invite link is not valid", 404);
  const live = getRoom(room.id);
  if (live.status === "expired" || live.status === "ended") throw new GameError("This room has closed", 410);

  const existing = db()
    .prepare("SELECT * FROM room_players WHERE room_id = ? AND user_id = ?")
    .get(room.id, userId) as RoomPlayerRow | undefined;
  if (existing) return { roomId: room.id }; // resuming is idempotent

  if (live.locked) throw new GameError("This room is locked", 403);
  const seated = players(room.id);
  if (seated.length >= 2) throw new GameError("This room already has two players", 403);

  db().transaction(() => {
    if (displayName) setDisplayNameRow(userId, displayName);
    db()
      .prepare("INSERT INTO room_players (room_id, user_id, seat, joined_at) VALUES (?, ?, 2, ?)")
      .run(room.id, userId, now());
    createDeckRow(room.id, userId);
    // Two players seated: lock the link and move to deck_setup (FR-05).
    db()
      .prepare("UPDATE rooms SET status = 'deck_setup', locked = 1, updated_at = ? WHERE id = ?")
      .run(now(), room.id);
  })();
  bumpExpiry(room.id);
  track("join_completed", { roomId: room.id });
  publish(room.id, { type: "player.joined", userId });
  return { roomId: room.id };
}

export function peekInvite(token: string) {
  const room = db()
    .prepare("SELECT * FROM rooms WHERE invite_token_hash = ?")
    .get(hashToken(token)) as RoomRow | undefined;
  if (!room) throw new GameError("This invite link is not valid", 404);
  const live = getRoom(room.id);
  const host = db().prepare("SELECT display_name FROM profiles WHERE id = ?").get(room.host_id) as
    | { display_name: string }
    | undefined;
  return {
    roomId: room.id,
    hostName: host?.display_name || "A friend",
    promptPolicy: live.prompt_policy,
    status: live.status,
    joinable: !live.locked && live.status === "waiting_for_player",
    expiresAt: live.expires_at,
  };
}

// ---------------------------------------------------------------- deck

function setDisplayNameRow(userId: string, name: string) {
  const clean = name.trim().slice(0, 40);
  if (!clean) return;
  db().prepare("UPDATE profiles SET display_name = ?, updated_at = ? WHERE id = ?").run(clean, now(), userId);
}

export function setDisplayName(userId: string, roomId: string, name: string) {
  getMembership(roomId, userId);
  setDisplayNameRow(userId, name);
  publish(roomId, { type: "player.updated" });
}

export function addCard(
  userId: string,
  roomId: string,
  card: { name: string; relationship?: string; storagePath: string }
): PersonCardRow {
  const room = getRoom(roomId);
  getMembership(roomId, userId);
  if (!["waiting_for_player", "deck_setup"].includes(room.status))
    throw new GameError("The deck is locked once the round starts");
  const deck = deckFor(roomId, userId);
  if (!deck) throw new GameError("No deck for this room", 409);
  if (deck.status === "ready") throw new GameError("Un-ready your deck before editing it");
  const existing = cardsOf(deck.id);
  if (existing.length >= DECK_SIZE) throw new GameError(`A deck holds exactly ${DECK_SIZE} people`);
  const name = card.name.trim().slice(0, 30);
  if (!name) throw new GameError("Every card needs a first name or nickname");
  const id = randomUUID();
  db()
    .prepare(
      `INSERT INTO person_cards (id, deck_id, display_name, relationship_label, storage_path, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, deck.id, name, card.relationship?.trim().slice(0, 40) || null, card.storagePath, existing.length, now());
  bumpExpiry(roomId);
  if (existing.length === 0) track("first_card_added", { roomId });
  publish(roomId, { type: "deck.progress", userId, count: existing.length + 1 });
  return db().prepare("SELECT * FROM person_cards WHERE id = ?").get(id) as PersonCardRow;
}

export function removeCard(userId: string, roomId: string, cardId: string) {
  const room = getRoom(roomId);
  getMembership(roomId, userId);
  const deck = deckFor(roomId, userId);
  if (!deck) throw new GameError("No deck for this room", 409);
  const card = cardsOf(deck.id).find((c) => c.id === cardId);
  if (!card) throw new GameError("That card is not in your deck", 404);
  if (!["waiting_for_player", "deck_setup"].includes(room.status))
    throw new GameError("The deck is locked once the round starts");
  db().transaction(() => {
    db().prepare("DELETE FROM person_cards WHERE id = ?").run(cardId);
    db().prepare("UPDATE decks SET status = 'building', consent_confirmed_at = NULL, updated_at = ? WHERE id = ?")
      .run(now(), deck.id);
    db().prepare("UPDATE room_players SET ready_at = NULL WHERE room_id = ? AND user_id = ?").run(roomId, userId);
    resequence(deck.id);
  })();
  deleteCardImage(card.storage_path);
  publish(roomId, { type: "deck.progress", userId, count: cardsOf(deck.id).length });
}

export function renameCard(userId: string, roomId: string, cardId: string, name: string, relationship?: string) {
  getMembership(roomId, userId);
  const deck = deckFor(roomId, userId);
  if (!deck || !cardsOf(deck.id).some((c) => c.id === cardId)) throw new GameError("That card is not in your deck", 404);
  const clean = name.trim().slice(0, 30);
  if (!clean) throw new GameError("Every card needs a first name or nickname");
  db()
    .prepare("UPDATE person_cards SET display_name = ?, relationship_label = ? WHERE id = ?")
    .run(clean, relationship?.trim().slice(0, 40) || null, cardId);
}

export function moveCard(userId: string, roomId: string, cardId: string, direction: "up" | "down") {
  getMembership(roomId, userId);
  const deck = deckFor(roomId, userId);
  if (!deck) throw new GameError("No deck for this room", 409);
  const cards = cardsOf(deck.id);
  const idx = cards.findIndex((c) => c.id === cardId);
  if (idx < 0) throw new GameError("That card is not in your deck", 404);
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= cards.length) return;
  db().transaction(() => {
    db().prepare("UPDATE person_cards SET sort_order = ? WHERE id = ?").run(swap, cards[idx].id);
    db().prepare("UPDATE person_cards SET sort_order = ? WHERE id = ?").run(idx, cards[swap].id);
  })();
}

function resequence(deckId: string) {
  cardsOf(deckId).forEach((c, i) =>
    db().prepare("UPDATE person_cards SET sort_order = ? WHERE id = ?").run(i, c.id)
  );
}

export function markReady(userId: string, roomId: string, consent: boolean) {
  const room = getRoom(roomId);
  getMembership(roomId, userId);
  if (!["waiting_for_player", "deck_setup"].includes(room.status))
    throw new GameError("The round has already started");
  const deck = deckFor(roomId, userId);
  if (!deck) throw new GameError("No deck for this room", 409);
  const count = cardsOf(deck.id).length;
  if (count !== DECK_SIZE) throw new GameError(`Your deck needs exactly ${DECK_SIZE} people (you have ${count})`);
  if (!consent) throw new GameError("Please confirm you have permission to share these photos");

  db().transaction(() => {
    db()
      .prepare("UPDATE decks SET status = 'ready', consent_confirmed_at = ?, updated_at = ? WHERE id = ?")
      .run(now(), now(), deck.id);
    db().prepare("UPDATE room_players SET ready_at = ? WHERE room_id = ? AND user_id = ?").run(now(), roomId, userId);
  })();
  track("deck_completed", { roomId });
  track("consent_confirmed", { roomId });

  // Both ready → secret selection begins (state machine §10.1).
  const all = players(roomId);
  const bothReady =
    all.length === 2 &&
    all.every((p) => p.ready_at) &&
    all.every((p) => {
      const d = deckFor(roomId, p.user_id);
      return d?.status === "ready";
    });
  if (bothReady) {
    db().transaction(() => {
      db().prepare("UPDATE rooms SET status = 'secret_selection', updated_at = ? WHERE id = ?").run(now(), roomId);
      const roundNo = (currentRound(roomId)?.number ?? 0) + 1;
      db()
        .prepare("INSERT INTO rounds (id, room_id, number, status, created_at) VALUES (?, ?, ?, 'secret_selection', ?)")
        .run(randomUUID(), roomId, roundNo, now());
    })();
    track("both_ready", { roomId });
  }
  bumpExpiry(roomId);
  publish(roomId, { type: "player.ready", userId, bothReady });
}

export function deleteDeck(userId: string, roomId: string) {
  getRoom(roomId);
  getMembership(roomId, userId);
  const deck = deckFor(roomId, userId);
  if (!deck) return;
  const cards = cardsOf(deck.id);
  db().transaction(() => {
    // person_cards are referenced by secrets/guesses; deleting the deck row
    // cascades cards only in rooms without rounds. End the room instead:
    // revoke access first, clean storage after (PRD §13.1).
    db().prepare("UPDATE decks SET status = 'deleted', updated_at = ? WHERE id = ?").run(now(), deck.id);
    db().prepare("UPDATE rooms SET status = 'ended', updated_at = ? WHERE id = ?").run(now(), roomId);
  })();
  for (const c of cards) deleteCardImage(c.storage_path);
  track("deck_deleted", { roomId });
  publish(roomId, { type: "room.ended", reason: "deck_deleted" });
}

export function endRoom(userId: string, roomId: string) {
  getRoom(roomId);
  getMembership(roomId, userId);
  db().prepare("UPDATE rooms SET status = 'ended', updated_at = ? WHERE id = ?").run(now(), roomId);
  publish(roomId, { type: "room.ended", reason: "ended" });
}

// ---------------------------------------------------------------- rounds

export function selectSecret(userId: string, roomId: string, cardId: string) {
  const room = getRoom(roomId);
  getMembership(roomId, userId);
  if (room.status !== "secret_selection") throw new GameError("Secrets are only chosen before the round starts");
  const round = currentRound(roomId);
  if (!round || round.status !== "secret_selection") throw new GameError("No round awaiting secrets", 409);
  const deck = deckFor(roomId, userId);
  if (!deck || !cardsOf(deck.id).some((c) => c.id === cardId))
    throw new GameError("You can only choose a secret from your own deck", 403);

  db()
    .prepare(
      `INSERT INTO round_secrets (round_id, owner_id, person_card_id) VALUES (?, ?, ?)
       ON CONFLICT(round_id, owner_id) DO UPDATE SET person_card_id = excluded.person_card_id`
    )
    .run(round.id, userId, cardId);

  const secretCount = (
    db().prepare("SELECT COUNT(*) AS n FROM round_secrets WHERE round_id = ?").get(round.id) as { n: number }
  ).n;

  let started = false;
  if (secretCount === 2) {
    // First turn: seat 1 for round 1, alternating on rematches (PRD FR-21).
    const seats = players(roomId);
    const first = seats[(round.number - 1) % seats.length].user_id;
    db().transaction(() => {
      db()
        .prepare("UPDATE rounds SET status = 'active', active_player_id = ?, started_at = ? WHERE id = ?")
        .run(first, now(), round.id);
      db().prepare("UPDATE rooms SET status = 'active', updated_at = ? WHERE id = ?").run(now(), roomId);
    })();
    started = true;
    track("round_started", { roomId });
  }
  bumpExpiry(roomId);
  publish(roomId, started ? { type: "round.started" } : { type: "secret.progress", count: secretCount });
}

function activeRound(roomId: string): RoundRow {
  const round = currentRound(roomId);
  if (!round || round.status !== "active") throw new GameError("The round is not active", 409);
  return round;
}

function openQuestion(roundId: string): QuestionRow | undefined {
  return db()
    .prepare("SELECT * FROM questions WHERE round_id = ? AND status = 'open'")
    .get(roundId) as QuestionRow | undefined;
}

export function turnCount(roundId: string): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM questions WHERE round_id = ?").get(roundId) as { n: number }).n;
}

export function askQuestion(userId: string, roomId: string, text: string, promptId?: string) {
  const room = getRoom(roomId);
  getMembership(roomId, userId);
  const round = activeRound(roomId);
  if (round.active_player_id !== userId) throw new GameError("It is not your turn", 409);
  if (openQuestion(round.id)) throw new GameError("Wait for the answer to your open question", 409);

  let finalText = text.trim().slice(0, 200);
  if (promptId) {
    const p = promptById(promptId);
    if (!p) throw new GameError("Unknown prompt");
    if (room.prompt_policy === "team_safe" && !p.teamSafe) throw new GameError("That prompt is not in the team-safe pack");
    finalText = p.text;
  } else {
    if (room.prompt_policy === "team_safe")
      throw new GameError("Custom questions are off in team-safe rooms — pick a suggested prompt");
    if (!finalText) throw new GameError("Ask a yes-or-no question");
  }

  const turnNo = turnCount(round.id) + 1;
  db()
    .prepare(
      "INSERT INTO questions (id, round_id, turn_no, asker_id, text, prompt_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)"
    )
    .run(randomUUID(), round.id, turnNo, userId, finalText, promptId ?? null, now());
  bumpExpiry(roomId);
  track("question_asked", { roomId, turnNo, promptId });
  publish(roomId, { type: "question.asked", turnNo });
}

export function answerQuestion(userId: string, roomId: string, questionId: string, answer: string) {
  getRoom(roomId);
  getMembership(roomId, userId);
  const round = activeRound(roomId);
  const q = openQuestion(round.id);
  if (!q || q.id !== questionId) throw new GameError("That question is not open", 409);
  if (q.asker_id === userId) throw new GameError("The other player answers your question", 403);
  if (!["yes", "no", "not_sure", "skip"].includes(answer)) throw new GameError("Answer must be yes, no, not sure, or skip");

  db().transaction(() => {
    db()
      .prepare("INSERT INTO answers (question_id, responder_id, answer, answered_at) VALUES (?, ?, ?, ?)")
      .run(q.id, userId, answer, now());
    db().prepare("UPDATE questions SET status = 'answered' WHERE id = ?").run(q.id);
    // Turn passes to the responder once they answer (PRD §5.2).
    db().prepare("UPDATE rounds SET active_player_id = ? WHERE id = ?").run(userId, round.id);
  })();
  bumpExpiry(roomId);
  track("answer_submitted", { roomId, turnNo: q.turn_no });
  publish(roomId, { type: "question.answered", turnNo: q.turn_no });
  publish(roomId, { type: "turn.changed" });
}

export function setElimination(userId: string, roomId: string, cardId: string, eliminated: boolean) {
  getRoom(roomId);
  getMembership(roomId, userId);
  const round = activeRound(roomId);
  // Cards you eliminate belong to the opponent's deck (FR-24).
  const opp = opponentOf(roomId, userId);
  if (!opp) throw new GameError("No opponent yet", 409);
  const oppDeck = deckFor(roomId, opp.user_id);
  if (!oppDeck || !cardsOf(oppDeck.id).some((c) => c.id === cardId))
    throw new GameError("You can only eliminate cards on the opponent's board", 403);

  db()
    .prepare(
      `INSERT INTO eliminations (round_id, player_id, person_card_id, eliminated, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(round_id, player_id, person_card_id) DO UPDATE SET eliminated = excluded.eliminated, updated_at = excluded.updated_at`
    )
    .run(round.id, userId, cardId, eliminated ? 1 : 0, now());
  // Private: broadcast to the actor's own connections only (§10.3).
  publish(roomId, { type: "cards.eliminated", cardId, eliminated }, userId);
}

export function submitGuess(userId: string, roomId: string, cardId: string) {
  getRoom(roomId);
  getMembership(roomId, userId);
  const round = activeRound(roomId);
  if (round.active_player_id !== userId) throw new GameError("You can only guess at the start of your turn", 409);
  if (openQuestion(round.id)) throw new GameError("Wait for the answer to your open question", 409);

  const opp = opponentOf(roomId, userId);
  if (!opp) throw new GameError("No opponent yet", 409);
  const oppDeck = deckFor(roomId, opp.user_id);
  if (!oppDeck || !cardsOf(oppDeck.id).some((c) => c.id === cardId))
    throw new GameError("Guess a person from the opponent's board", 403);

  const secret = db()
    .prepare("SELECT person_card_id FROM round_secrets WHERE round_id = ? AND owner_id = ?")
    .get(round.id, opp.user_id) as { person_card_id: string } | undefined;
  if (!secret) throw new GameError("The opponent has no secret set", 409);

  const correct = secret.person_card_id === cardId;
  const winner = correct ? userId : opp.user_id; // wrong guess loses the round (§5.2)
  db().transaction(() => {
    db()
      .prepare("INSERT INTO guesses (id, round_id, player_id, person_card_id, correct, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(randomUUID(), round.id, userId, cardId, correct ? 1 : 0, now());
    db()
      .prepare("UPDATE rounds SET status = 'completed', winner_id = ?, ended_at = ?, active_player_id = NULL WHERE id = ?")
      .run(winner, now(), round.id);
    db().prepare("UPDATE rooms SET status = 'completed', updated_at = ? WHERE id = ?").run(now(), roomId);
  })();
  bumpExpiry(roomId);
  track("guess_submitted", { roomId });
  track("round_completed", { roomId });
  publish(roomId, { type: "guess.resolved", correct });
  publish(roomId, { type: "round.completed" });
}

export function requestRematch(userId: string, roomId: string) {
  const room = getRoom(roomId);
  getMembership(roomId, userId);
  if (!["completed", "rematch"].includes(room.status)) throw new GameError("Finish the round before a rematch");
  const round = currentRound(roomId);
  if (!round || round.status !== "completed") throw new GameError("No completed round", 409);

  db()
    .prepare("INSERT OR IGNORE INTO rematch_requests (round_id, player_id, created_at) VALUES (?, ?, ?)")
    .run(round.id, userId, now());
  const n = (
    db().prepare("SELECT COUNT(*) AS n FROM rematch_requests WHERE round_id = ?").get(round.id) as { n: number }
  ).n;

  if (n === 2) {
    db().transaction(() => {
      db().prepare("UPDATE rooms SET status = 'secret_selection', updated_at = ? WHERE id = ?").run(now(), roomId);
      db()
        .prepare("INSERT INTO rounds (id, room_id, number, status, created_at) VALUES (?, ?, ?, 'secret_selection', ?)")
        .run(randomUUID(), roomId, round.number + 1, now());
    })();
    track("rematch_started", { roomId });
    publish(roomId, { type: "rematch.accepted" });
  } else {
    db().prepare("UPDATE rooms SET status = 'rematch', updated_at = ? WHERE id = ?").run(now(), roomId);
    publish(roomId, { type: "rematch.requested" });
  }
}

export function reportOutcome(userId: string, roomId: string, learned: boolean) {
  getRoom(roomId);
  getMembership(roomId, userId);
  track(learned ? "learned_something_yes" : "learned_something_no", { roomId });
}
