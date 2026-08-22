import { randomUUID } from "node:crypto";
import {
  db,
  now,
  asInt,
  DECK_MIN,
  DECK_MAX,
  type Exec,
  type RoomRow,
  type RoomPlayerRow,
  type DeckRow,
  type PersonCardRow,
  type RoundRow,
  type QuestionRow,
} from "./db";
import { hashToken, newInviteToken } from "./tokens";
import { publish } from "./bus";
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
const PRESENCE_WINDOW_MS = 30_000;

async function bumpExpiry(roomId: string) {
  const expires = new Date(Date.now() + EXPIRY_HOURS * 3600_000).toISOString();
  await db().run("UPDATE rooms SET expires_at = ?, updated_at = ? WHERE id = ?", [expires, now(), roomId]);
}

export async function getRoom(roomId: string): Promise<RoomRow> {
  const room = await db().get<RoomRow>("SELECT * FROM rooms WHERE id = ?", [roomId]);
  if (!room) throw new GameError("Room not found", 404);
  if (room.status !== "expired" && room.expires_at < now()) {
    await db().run("UPDATE rooms SET status = 'expired', updated_at = ? WHERE id = ?", [now(), roomId]);
    room.status = "expired";
  }
  return room;
}

export async function getMembership(roomId: string, userId: string): Promise<RoomPlayerRow> {
  const m = await db().get<RoomPlayerRow>("SELECT * FROM room_players WHERE room_id = ? AND user_id = ?", [
    roomId,
    userId,
  ]);
  if (!m) throw new GameError("You are not in this room", 403);
  return m;
}

export async function players(roomId: string): Promise<RoomPlayerRow[]> {
  return db().all<RoomPlayerRow>("SELECT * FROM room_players WHERE room_id = ? ORDER BY seat", [roomId]);
}

/** Presence without sockets: viewers stamp last_seen_at as they poll. */
export async function touchPresence(roomId: string, userId: string) {
  await db().run("UPDATE room_players SET last_seen_at = ? WHERE room_id = ? AND user_id = ?", [
    now(),
    roomId,
    userId,
  ]);
}

export function isOnline(p: RoomPlayerRow): boolean {
  return !!p.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() < PRESENCE_WINDOW_MS;
}

export async function currentRound(roomId: string): Promise<RoundRow | undefined> {
  return db().get<RoundRow>("SELECT * FROM rounds WHERE room_id = ? ORDER BY number DESC LIMIT 1", [roomId]);
}

async function deckFor(roomId: string, userId: string, t: Exec = db()): Promise<DeckRow | undefined> {
  return t.get<DeckRow>("SELECT * FROM decks WHERE room_id = ? AND owner_id = ? AND status != 'deleted'", [
    roomId,
    userId,
  ]);
}

async function cardsOf(deckId: string, t: Exec = db()): Promise<PersonCardRow[]> {
  return t.all<PersonCardRow>("SELECT * FROM person_cards WHERE deck_id = ? ORDER BY sort_order", [deckId]);
}

async function opponentOf(roomId: string, userId: string): Promise<RoomPlayerRow | undefined> {
  return (await players(roomId)).find((p) => p.user_id !== userId);
}

// ---------------------------------------------------------------- creation

export async function createRoom(userId: string, opts: { displayName?: string; promptPolicy?: string }) {
  const token = newInviteToken();
  const roomId = randomUUID();
  const policy = opts.promptPolicy === "team_safe" ? "team_safe" : "friends";
  const t = now();
  await db().tx(async (x) => {
    if (opts.displayName) await setDisplayNameRow(userId, opts.displayName, x);
    await x.run(
      `INSERT INTO rooms (id, host_id, mode, status, prompt_policy, invite_token_hash, locked, expires_at, created_at, updated_at)
       VALUES (?, ?, 'quick', 'waiting_for_player', ?, ?, 0, ?, ?, ?)`,
      [roomId, userId, policy, hashToken(token), new Date(Date.now() + EXPIRY_HOURS * 3600_000).toISOString(), t, t]
    );
    await x.run("INSERT INTO room_players (room_id, user_id, seat, joined_at, last_seen_at) VALUES (?, ?, 1, ?, ?)", [
      roomId,
      userId,
      t,
      t,
    ]);
    await createDeckRow(roomId, userId, x);
  });
  track("room_created", { roomId, mode: policy });
  return { roomId, inviteToken: token };
}

async function createDeckRow(roomId: string, userId: string, t: Exec) {
  await t.run(
    "INSERT INTO decks (id, owner_id, room_id, status, created_at, updated_at) VALUES (?, ?, ?, 'building', ?, ?)",
    [randomUUID(), userId, roomId, now(), now()]
  );
}

export async function joinByToken(userId: string, token: string, displayName?: string): Promise<{ roomId: string }> {
  const room = await db().get<RoomRow>("SELECT * FROM rooms WHERE invite_token_hash = ?", [hashToken(token)]);
  if (!room) throw new GameError("This invite link is not valid", 404);
  const live = await getRoom(room.id);
  if (live.status === "expired" || live.status === "ended") throw new GameError("This room has closed", 410);

  const existing = await db().get<RoomPlayerRow>("SELECT * FROM room_players WHERE room_id = ? AND user_id = ?", [
    room.id,
    userId,
  ]);
  if (existing) return { roomId: room.id }; // resuming is idempotent

  if (live.locked) throw new GameError("This room is locked", 403);
  const seated = await players(room.id);
  if (seated.length >= 2) throw new GameError("This room already has two players", 403);

  await db().tx(async (x) => {
    if (displayName) await setDisplayNameRow(userId, displayName, x);
    await x.run("INSERT INTO room_players (room_id, user_id, seat, joined_at, last_seen_at) VALUES (?, ?, 2, ?, ?)", [
      room.id,
      userId,
      now(),
      now(),
    ]);
    await createDeckRow(room.id, userId, x);
    // Two players seated: lock the link and move to deck_setup (FR-05).
    await x.run("UPDATE rooms SET status = 'deck_setup', locked = 1, updated_at = ? WHERE id = ?", [now(), room.id]);
  });
  await bumpExpiry(room.id);
  track("join_completed", { roomId: room.id });
  publish(room.id, { type: "player.joined", userId });
  return { roomId: room.id };
}

export async function peekInvite(token: string) {
  const room = await db().get<RoomRow>("SELECT * FROM rooms WHERE invite_token_hash = ?", [hashToken(token)]);
  if (!room) throw new GameError("This invite link is not valid", 404);
  const live = await getRoom(room.id);
  const host = await db().get<{ display_name: string }>("SELECT display_name FROM profiles WHERE id = ?", [
    room.host_id,
  ]);
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

async function setDisplayNameRow(userId: string, name: string, t: Exec = db()) {
  const clean = name.trim().slice(0, 40);
  if (!clean) return;
  await t.run("UPDATE profiles SET display_name = ?, updated_at = ? WHERE id = ?", [clean, now(), userId]);
}

export async function setDisplayName(userId: string, roomId: string, name: string) {
  await getMembership(roomId, userId);
  await setDisplayNameRow(userId, name);
  publish(roomId, { type: "player.updated" });
}

export async function addCard(
  userId: string,
  roomId: string,
  card: { name: string; relationship?: string; image: { bytes: Buffer; mime: string } }
): Promise<{ id: string }> {
  const room = await getRoom(roomId);
  await getMembership(roomId, userId);
  if (!["waiting_for_player", "deck_setup"].includes(room.status))
    throw new GameError("The deck is locked once the round starts");
  const deck = await deckFor(roomId, userId);
  if (!deck) throw new GameError("No deck for this room", 409);
  if (deck.status === "ready") throw new GameError("Un-ready your deck before editing it");
  const existing = await cardsOf(deck.id);
  if (existing.length >= DECK_MAX) throw new GameError(`A deck holds at most ${DECK_MAX} people`);
  const name = card.name.trim().slice(0, 30);
  if (!name) throw new GameError("Every card needs a first name or nickname");
  const id = randomUUID();
  await db().tx(async (x) => {
    await x.run(
      `INSERT INTO person_cards (id, deck_id, display_name, relationship_label, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, deck.id, name, card.relationship?.trim().slice(0, 40) || null, existing.length, now()]
    );
    await x.run("INSERT INTO card_images (card_id, mime, bytes) VALUES (?, ?, ?)", [id, card.image.mime, card.image.bytes]);
  });
  await bumpExpiry(roomId);
  if (existing.length === 0) track("first_card_added", { roomId });
  publish(roomId, { type: "deck.progress", userId, count: existing.length + 1 });
  return { id };
}

export async function removeCard(userId: string, roomId: string, cardId: string) {
  const room = await getRoom(roomId);
  await getMembership(roomId, userId);
  const deck = await deckFor(roomId, userId);
  if (!deck) throw new GameError("No deck for this room", 409);
  const cards = await cardsOf(deck.id);
  if (!cards.some((c) => c.id === cardId)) throw new GameError("That card is not in your deck", 404);
  if (!["waiting_for_player", "deck_setup"].includes(room.status))
    throw new GameError("The deck is locked once the round starts");
  await db().tx(async (x) => {
    await x.run("DELETE FROM person_cards WHERE id = ?", [cardId]); // cascades card_images
    await x.run("UPDATE decks SET status = 'building', consent_confirmed_at = NULL, updated_at = ? WHERE id = ?", [
      now(),
      deck.id,
    ]);
    await x.run("UPDATE room_players SET ready_at = NULL WHERE room_id = ? AND user_id = ?", [roomId, userId]);
    const rest = await cardsOf(deck.id, x);
    for (const [i, c] of rest.entries()) {
      await x.run("UPDATE person_cards SET sort_order = ? WHERE id = ?", [i, c.id]);
    }
  });
  publish(roomId, { type: "deck.progress", userId });
}

export async function renameCard(userId: string, roomId: string, cardId: string, name: string, relationship?: string) {
  await getMembership(roomId, userId);
  const deck = await deckFor(roomId, userId);
  if (!deck || !(await cardsOf(deck.id)).some((c) => c.id === cardId))
    throw new GameError("That card is not in your deck", 404);
  const clean = name.trim().slice(0, 30);
  if (!clean) throw new GameError("Every card needs a first name or nickname");
  await db().run("UPDATE person_cards SET display_name = ?, relationship_label = ? WHERE id = ?", [
    clean,
    relationship?.trim().slice(0, 40) || null,
    cardId,
  ]);
}

export async function moveCard(userId: string, roomId: string, cardId: string, direction: "up" | "down") {
  await getMembership(roomId, userId);
  const deck = await deckFor(roomId, userId);
  if (!deck) throw new GameError("No deck for this room", 409);
  const cards = await cardsOf(deck.id);
  const idx = cards.findIndex((c) => c.id === cardId);
  if (idx < 0) throw new GameError("That card is not in your deck", 404);
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= cards.length) return;
  await db().tx(async (x) => {
    await x.run("UPDATE person_cards SET sort_order = ? WHERE id = ?", [swap, cards[idx].id]);
    await x.run("UPDATE person_cards SET sort_order = ? WHERE id = ?", [idx, cards[swap].id]);
  });
}

export async function markReady(userId: string, roomId: string, consent: boolean) {
  const room = await getRoom(roomId);
  await getMembership(roomId, userId);
  if (!["waiting_for_player", "deck_setup"].includes(room.status))
    throw new GameError("The round has already started");
  const deck = await deckFor(roomId, userId);
  if (!deck) throw new GameError("No deck for this room", 409);
  const count = (await cardsOf(deck.id)).length;
  if (count < DECK_MIN || count > DECK_MAX)
    throw new GameError(`Bring between ${DECK_MIN} and ${DECK_MAX} people (you have ${count})`);
  if (!consent) throw new GameError("Please confirm you have permission to share these photos");

  await db().tx(async (x) => {
    await x.run("UPDATE decks SET status = 'ready', consent_confirmed_at = ?, updated_at = ? WHERE id = ?", [
      now(),
      now(),
      deck.id,
    ]);
    await x.run("UPDATE room_players SET ready_at = ? WHERE room_id = ? AND user_id = ?", [now(), roomId, userId]);
  });
  track("deck_completed", { roomId });
  track("consent_confirmed", { roomId });

  // Both ready → secret selection begins (state machine §10.1).
  const all = await players(roomId);
  let bothReady = all.length === 2 && all.every((p) => p.ready_at);
  if (bothReady) {
    for (const p of all) {
      const d = await deckFor(roomId, p.user_id);
      if (d?.status !== "ready") bothReady = false;
    }
  }
  if (bothReady) {
    const round = await currentRound(roomId);
    await db().tx(async (x) => {
      await x.run("UPDATE rooms SET status = 'secret_selection', updated_at = ? WHERE id = ?", [now(), roomId]);
      await x.run("INSERT INTO rounds (id, room_id, number, status, created_at) VALUES (?, ?, ?, 'secret_selection', ?)", [
        randomUUID(),
        roomId,
        (round?.number ?? 0) + 1,
        now(),
      ]);
    });
    track("both_ready", { roomId });
  }
  await bumpExpiry(roomId);
  publish(roomId, { type: "player.ready", userId, bothReady });
}

export async function deleteDeck(userId: string, roomId: string) {
  await getRoom(roomId);
  await getMembership(roomId, userId);
  const deck = await deckFor(roomId, userId);
  if (!deck) return;
  await db().tx(async (x) => {
    // Revoke access first (PRD §13.1): photo bytes go now; card rows stay
    // until the retention sweep because rounds reference them.
    await x.run(
      "DELETE FROM card_images WHERE card_id IN (SELECT id FROM person_cards WHERE deck_id = ?)",
      [deck.id]
    );
    await x.run("UPDATE decks SET status = 'deleted', updated_at = ? WHERE id = ?", [now(), deck.id]);
    await x.run("UPDATE rooms SET status = 'ended', updated_at = ? WHERE id = ?", [now(), roomId]);
  });
  track("deck_deleted", { roomId });
  publish(roomId, { type: "room.ended", reason: "deck_deleted" });
}

export async function endRoom(userId: string, roomId: string) {
  await getRoom(roomId);
  await getMembership(roomId, userId);
  await db().run("UPDATE rooms SET status = 'ended', updated_at = ? WHERE id = ?", [now(), roomId]);
  publish(roomId, { type: "room.ended", reason: "ended" });
}

// ---------------------------------------------------------------- rounds

export async function selectSecret(userId: string, roomId: string, cardId: string) {
  const room = await getRoom(roomId);
  await getMembership(roomId, userId);
  if (room.status !== "secret_selection") throw new GameError("Secrets are only chosen before the round starts");
  const round = await currentRound(roomId);
  if (!round || round.status !== "secret_selection") throw new GameError("No round awaiting secrets", 409);
  const deck = await deckFor(roomId, userId);
  if (!deck || !(await cardsOf(deck.id)).some((c) => c.id === cardId))
    throw new GameError("You can only choose a secret from your own deck", 403);

  await db().run(
    `INSERT INTO round_secrets (round_id, owner_id, person_card_id) VALUES (?, ?, ?)
     ON CONFLICT (round_id, owner_id) DO UPDATE SET person_card_id = EXCLUDED.person_card_id`,
    [round.id, userId, cardId]
  );

  const row = await db().get<{ n: unknown }>(
    "SELECT CAST(COUNT(*) AS INT) AS n FROM round_secrets WHERE round_id = ?",
    [round.id]
  );
  const secretCount = asInt(row?.n);

  let started = false;
  if (secretCount === 2) {
    // First turn: seat 1 for round 1, alternating on rematches (PRD FR-21).
    const seats = await players(roomId);
    const first = seats[(round.number - 1) % seats.length].user_id;
    await db().tx(async (x) => {
      await x.run("UPDATE rounds SET status = 'active', active_player_id = ?, started_at = ? WHERE id = ?", [
        first,
        now(),
        round.id,
      ]);
      await x.run("UPDATE rooms SET status = 'active', updated_at = ? WHERE id = ?", [now(), roomId]);
    });
    started = true;
    track("round_started", { roomId });
  }
  await bumpExpiry(roomId);
  publish(roomId, started ? { type: "round.started" } : { type: "secret.progress", count: secretCount });
}

async function activeRound(roomId: string): Promise<RoundRow> {
  const round = await currentRound(roomId);
  if (!round || round.status !== "active") throw new GameError("The round is not active", 409);
  return round;
}

async function openQuestion(roundId: string): Promise<QuestionRow | undefined> {
  return db().get<QuestionRow>("SELECT * FROM questions WHERE round_id = ? AND status = 'open'", [roundId]);
}

export async function turnCount(roundId: string): Promise<number> {
  const row = await db().get<{ n: unknown }>("SELECT CAST(COUNT(*) AS INT) AS n FROM questions WHERE round_id = ?", [
    roundId,
  ]);
  return asInt(row?.n);
}

export async function askQuestion(userId: string, roomId: string, text: string, promptId?: string) {
  const room = await getRoom(roomId);
  await getMembership(roomId, userId);
  const round = await activeRound(roomId);
  if (round.active_player_id !== userId) throw new GameError("It is not your turn", 409);
  if (await openQuestion(round.id)) throw new GameError("Wait for the answer to your open question", 409);

  let finalText = text.trim().slice(0, 200);
  if (promptId) {
    const p = promptById(promptId);
    if (!p) throw new GameError("Unknown prompt");
    if (room.prompt_policy === "team_safe" && !p.teamSafe)
      throw new GameError("That prompt is not in the team-safe pack");
    finalText = p.text;
  } else {
    if (room.prompt_policy === "team_safe")
      throw new GameError("Custom questions are off in team-safe rooms — pick a suggested prompt");
    if (!finalText) throw new GameError("Ask a yes-or-no question");
  }

  const turnNo = (await turnCount(round.id)) + 1;
  await db().run(
    "INSERT INTO questions (id, round_id, turn_no, asker_id, text, prompt_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)",
    [randomUUID(), round.id, turnNo, userId, finalText, promptId ?? null, now()]
  );
  await bumpExpiry(roomId);
  track("question_asked", { roomId, turnNo, promptId });
  publish(roomId, { type: "question.asked", turnNo });
}

export async function answerQuestion(userId: string, roomId: string, questionId: string, answer: string) {
  await getRoom(roomId);
  await getMembership(roomId, userId);
  const round = await activeRound(roomId);
  const q = await openQuestion(round.id);
  if (!q || q.id !== questionId) throw new GameError("That question is not open", 409);
  if (q.asker_id === userId) throw new GameError("The other player answers your question", 403);
  if (!["yes", "no", "not_sure", "skip"].includes(answer))
    throw new GameError("Answer must be yes, no, not sure, or skip");

  await db().tx(async (x) => {
    await x.run("INSERT INTO answers (question_id, responder_id, answer, answered_at) VALUES (?, ?, ?, ?)", [
      q.id,
      userId,
      answer,
      now(),
    ]);
    await x.run("UPDATE questions SET status = 'answered' WHERE id = ?", [q.id]);
    // Turn passes to the responder once they answer (PRD §5.2).
    await x.run("UPDATE rounds SET active_player_id = ? WHERE id = ?", [userId, round.id]);
  });
  await bumpExpiry(roomId);
  track("answer_submitted", { roomId, turnNo: q.turn_no });
  publish(roomId, { type: "question.answered", turnNo: q.turn_no });
  publish(roomId, { type: "turn.changed" });
}

export async function setElimination(userId: string, roomId: string, cardId: string, eliminated: boolean) {
  await getRoom(roomId);
  await getMembership(roomId, userId);
  const round = await activeRound(roomId);
  // Cards you eliminate belong to the opponent's deck (FR-24).
  const opp = await opponentOf(roomId, userId);
  if (!opp) throw new GameError("No opponent yet", 409);
  const oppDeck = await deckFor(roomId, opp.user_id);
  if (!oppDeck || !(await cardsOf(oppDeck.id)).some((c) => c.id === cardId))
    throw new GameError("You can only eliminate cards on the opponent's board", 403);

  await db().run(
    `INSERT INTO eliminations (round_id, player_id, person_card_id, eliminated, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (round_id, player_id, person_card_id) DO UPDATE SET eliminated = EXCLUDED.eliminated, updated_at = EXCLUDED.updated_at`,
    [round.id, userId, cardId, eliminated ? 1 : 0, now()]
  );
  // Private: broadcast to the actor's own connections only (§10.3).
  publish(roomId, { type: "cards.eliminated", cardId, eliminated }, userId);
}

export async function submitGuess(userId: string, roomId: string, cardId: string) {
  await getRoom(roomId);
  await getMembership(roomId, userId);
  const round = await activeRound(roomId);
  if (round.active_player_id !== userId) throw new GameError("You can only guess at the start of your turn", 409);
  if (await openQuestion(round.id)) throw new GameError("Wait for the answer to your open question", 409);

  const opp = await opponentOf(roomId, userId);
  if (!opp) throw new GameError("No opponent yet", 409);
  const oppDeck = await deckFor(roomId, opp.user_id);
  if (!oppDeck || !(await cardsOf(oppDeck.id)).some((c) => c.id === cardId))
    throw new GameError("Guess a person from the opponent's board", 403);

  const secret = await db().get<{ person_card_id: string }>(
    "SELECT person_card_id FROM round_secrets WHERE round_id = ? AND owner_id = ?",
    [round.id, opp.user_id]
  );
  if (!secret) throw new GameError("The opponent has no secret set", 409);

  const correct = secret.person_card_id === cardId;
  const winner = correct ? userId : opp.user_id; // wrong guess loses the round (§5.2)
  await db().tx(async (x) => {
    await x.run(
      "INSERT INTO guesses (id, round_id, player_id, person_card_id, correct, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [randomUUID(), round.id, userId, cardId, correct ? 1 : 0, now()]
    );
    await x.run(
      "UPDATE rounds SET status = 'completed', winner_id = ?, ended_at = ?, active_player_id = NULL WHERE id = ?",
      [winner, now(), round.id]
    );
    await x.run("UPDATE rooms SET status = 'completed', updated_at = ? WHERE id = ?", [now(), roomId]);
  });
  await bumpExpiry(roomId);
  track("guess_submitted", { roomId });
  track("round_completed", { roomId });
  publish(roomId, { type: "guess.resolved", correct });
  publish(roomId, { type: "round.completed" });
}

export async function requestRematch(userId: string, roomId: string) {
  const room = await getRoom(roomId);
  await getMembership(roomId, userId);
  if (!["completed", "rematch"].includes(room.status)) throw new GameError("Finish the round before a rematch");
  const round = await currentRound(roomId);
  if (!round || round.status !== "completed") throw new GameError("No completed round", 409);

  await db().run(
    "INSERT INTO rematch_requests (round_id, player_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
    [round.id, userId, now()]
  );
  const row = await db().get<{ n: unknown }>(
    "SELECT CAST(COUNT(*) AS INT) AS n FROM rematch_requests WHERE round_id = ?",
    [round.id]
  );

  if (asInt(row?.n) === 2) {
    await db().tx(async (x) => {
      await x.run("UPDATE rooms SET status = 'secret_selection', updated_at = ? WHERE id = ?", [now(), roomId]);
      await x.run(
        "INSERT INTO rounds (id, room_id, number, status, created_at) VALUES (?, ?, ?, 'secret_selection', ?)",
        [randomUUID(), roomId, round.number + 1, now()]
      );
    });
    track("rematch_started", { roomId });
    publish(roomId, { type: "rematch.accepted" });
  } else {
    await db().run("UPDATE rooms SET status = 'rematch', updated_at = ? WHERE id = ?", [now(), roomId]);
    publish(roomId, { type: "rematch.requested" });
  }
}

export async function reportOutcome(userId: string, roomId: string, learned: boolean) {
  await getRoom(roomId);
  await getMembership(roomId, userId);
  track(learned ? "learned_something_yes" : "learned_something_no", { roomId });
}
