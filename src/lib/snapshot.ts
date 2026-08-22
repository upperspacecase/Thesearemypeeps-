import {
  db,
  DECK_SIZE,
  type DeckRow,
  type PersonCardRow,
  type QuestionRow,
  type AnswerRow,
} from "./db";
import { getRoom, getMembership, players, currentRound, turnCount } from "./game";
import { onlineUsers } from "./bus";
import { suggestionsFor } from "./prompts";

// The one place that decides what a viewer may see. Everything the client
// renders comes from here, so redaction rules live in exactly one function:
//  - your own deck: full detail, any time
//  - opponent identity/readiness: always; opponent CARDS: only from the
//    active round onward (decks stay hidden through setup, FR/§7.2)
//  - secrets: your own always; the opponent's only after round completion
//  - eliminations: yours only — the opponent's are never serialized (FR-24)
//  - guesses: candidate card revealed only once the round has resolved

export interface CardView {
  id: string;
  name: string;
  relationship: string | null; // only revealed post-round
  imageUrl: string;
}

export function buildSnapshot(roomId: string, viewerId: string) {
  const room = getRoom(roomId);
  getMembership(roomId, viewerId); // non-members get a 403, not a snapshot
  const seats = players(roomId);
  const online = new Set(onlineUsers(roomId));
  const round = currentRound(roomId);
  const roundDone = round?.status === "completed";

  const profileOf = (id: string) =>
    (db().prepare("SELECT display_name FROM profiles WHERE id = ?").get(id) as { display_name: string })
      ?.display_name || "Player";

  const deckOf = (userId: string) =>
    db()
      .prepare("SELECT * FROM decks WHERE room_id = ? AND owner_id = ? AND status != 'deleted'")
      .get(roomId, userId) as DeckRow | undefined;

  const cardsOf = (deckId: string) =>
    db()
      .prepare("SELECT * FROM person_cards WHERE deck_id = ? ORDER BY sort_order")
      .all(deckId) as PersonCardRow[];

  const toView = (c: PersonCardRow, revealLabels: boolean): CardView => ({
    id: c.id,
    name: c.display_name,
    relationship: revealLabels ? c.relationship_label : null,
    imageUrl: `/api/images/${c.id}`,
  });

  const me = seats.find((s) => s.user_id === viewerId)!;
  const opponent = seats.find((s) => s.user_id !== viewerId);

  const myDeck = deckOf(viewerId);
  const myCards = myDeck ? cardsOf(myDeck.id) : [];

  const boardVisible = round ? ["active", "completed"].includes(round.status) && room.status !== "secret_selection" : false;
  const oppDeck = opponent ? deckOf(opponent.user_id) : undefined;
  const oppCards = opponent && oppDeck && boardVisible ? cardsOf(oppDeck.id) : [];

  // Questions + answers for the current round (room members only, §12).
  const questions = round
    ? (db()
        .prepare("SELECT * FROM questions WHERE round_id = ? ORDER BY turn_no")
        .all(round.id) as QuestionRow[])
    : [];
  const answers = round
    ? new Map(
        (db()
          .prepare("SELECT a.* FROM answers a JOIN questions q ON q.id = a.question_id WHERE q.round_id = ?")
          .all(round.id) as AnswerRow[]).map((a) => [a.question_id, a])
      )
    : new Map<string, AnswerRow>();

  const mySecret = round
    ? (db()
        .prepare("SELECT person_card_id FROM round_secrets WHERE round_id = ? AND owner_id = ?")
        .get(round.id, viewerId) as { person_card_id: string } | undefined)
    : undefined;

  // Opponent's secret id crosses the wire ONLY after the round resolves.
  const oppSecret =
    roundDone && round && opponent
      ? (db()
          .prepare("SELECT person_card_id FROM round_secrets WHERE round_id = ? AND owner_id = ?")
          .get(round.id, opponent.user_id) as { person_card_id: string } | undefined)
      : undefined;

  const myEliminations = round
    ? (db()
        .prepare("SELECT person_card_id FROM eliminations WHERE round_id = ? AND player_id = ? AND eliminated = 1")
        .all(round.id, viewerId) as { person_card_id: string }[]).map((e) => e.person_card_id)
    : [];

  const guesses = roundDone && round
    ? (db()
        .prepare("SELECT player_id, person_card_id, correct FROM guesses WHERE round_id = ?")
        .all(round.id) as { player_id: string; person_card_id: string; correct: number }[])
    : [];

  const rematchVotes = round
    ? (db()
        .prepare("SELECT player_id FROM rematch_requests WHERE round_id = ?")
        .all(round.id) as { player_id: string }[]).map((r) => r.player_id)
    : [];

  const secretCount = round
    ? (db().prepare("SELECT COUNT(*) AS n FROM round_secrets WHERE round_id = ?").get(round.id) as { n: number }).n
    : 0;

  const nextTurnNo = round ? turnCount(round.id) + (questions.some((q) => q.status === "open") ? 0 : 1) : 1;

  return {
    room: {
      id: room.id,
      status: room.status,
      promptPolicy: room.prompt_policy,
      deckSize: DECK_SIZE,
      expiresAt: room.expires_at,
      hostId: room.host_id,
    },
    me: {
      id: viewerId,
      name: profileOf(viewerId),
      seat: me.seat,
      ready: !!me.ready_at,
      deckCount: myCards.length,
      deckReady: myDeck?.status === "ready",
      cards: myCards.map((c) => toView(c, true)),
      secretCardId: mySecret?.person_card_id ?? null,
      eliminatedCardIds: myEliminations,
      rematchRequested: rematchVotes.includes(viewerId),
    },
    opponent: opponent
      ? {
          id: opponent.user_id,
          name: profileOf(opponent.user_id),
          ready: !!opponent.ready_at,
          online: online.has(opponent.user_id),
          deckCount: oppDeck ? cardsOf(oppDeck.id).length : 0,
          board: oppCards.map((c) => toView(c, roundDone)),
          secretCardId: oppSecret?.person_card_id ?? null, // null until reveal
          rematchRequested: rematchVotes.includes(opponent.user_id),
        }
      : null,
    round: round
      ? {
          number: round.number,
          status: round.status,
          activePlayerId: round.active_player_id,
          winnerId: round.winner_id,
          secretsChosen: secretCount,
          myTurn: round.active_player_id === viewerId,
          questions: questions.map((q) => ({
            id: q.id,
            turnNo: q.turn_no,
            askerId: q.asker_id,
            text: q.text,
            status: q.status,
            answer: answers.get(q.id)?.answer ?? null,
          })),
          guesses: guesses.map((g) => ({ playerId: g.player_id, cardId: g.person_card_id, correct: !!g.correct })),
        }
      : null,
    prompts: suggestionsFor(nextTurnNo, room.prompt_policy),
  };
}

export type Snapshot = ReturnType<typeof buildSnapshot>;
