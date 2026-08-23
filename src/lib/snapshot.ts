import { db, asInt, DECK_MIN, DECK_MAX, type DeckRow, type PersonCardRow } from "./db";
import { getRoom, getMembership, players, currentRound, isOnline } from "./game";

// The one place that decides what a viewer may see. Everything the client
// renders comes from here, so redaction rules live in exactly one function:
//  - your own deck: full detail, any time
//  - opponent identity/readiness: always; opponent CARDS: only from the
//    active round onward (decks stay hidden through setup, §7.2)
//  - secrets: your own always; the opponent's only after round completion
//  - eliminations: yours only — the opponent's are never serialized (FR-24)
//  - guesses: candidate card revealed only once the round has resolved

export interface CardView {
  id: string;
  name: string;
  imageUrl: string;
  /** Whether the viewer brought this person. Not shown on the board — the
   *  cards are deliberately undifferentiated — but used by tests/analytics. */
  mine: boolean;
}

export async function buildSnapshot(roomId: string, viewerId: string) {
  const room = await getRoom(roomId);
  await getMembership(roomId, viewerId); // non-members get a 403, not a snapshot
  const seats = await players(roomId);
  const round = await currentRound(roomId);
  const roundDone = round?.status === "completed";

  const profileOf = async (id: string) =>
    (await db().get<{ display_name: string }>("SELECT display_name FROM profiles WHERE id = ?", [id]))
      ?.display_name || "Player";

  const deckOf = (userId: string) =>
    db().get<DeckRow>("SELECT * FROM decks WHERE room_id = ? AND owner_id = ? AND status != 'deleted'", [
      roomId,
      userId,
    ]);

  // the image version rides along so a re-crop produces a new URL — otherwise
  // the person who cropped keeps seeing their own cached copy
  const cardsOf = (deckId: string) =>
    db().all<PersonCardRow & { version: number | null }>(
      `SELECT pc.*, ci.version FROM person_cards pc
       LEFT JOIN card_images ci ON ci.card_id = pc.id
       WHERE pc.deck_id = ? ORDER BY pc.sort_order`,
      [deckId]
    );

  const toView = (c: PersonCardRow & { version?: number | null }, mine: boolean): CardView => ({
    id: c.id,
    name: c.display_name,
    imageUrl: `/api/images/${c.id}?v=${asInt(c.version) || 1}`,
    mine,
  });

  const me = seats.find((s) => s.user_id === viewerId)!;
  const opponent = seats.find((s) => s.user_id !== viewerId);

  const myDeck = await deckOf(viewerId);
  const myCards = myDeck ? await cardsOf(myDeck.id) : [];

  // One shared board of everyone's people. It exists as soon as a round does
  // (both players ready) — secrets are chosen from it, so it must be visible
  // through secret selection, play, and the reveal.
  const boardVisible = !!round;
  const oppDeck = opponent ? await deckOf(opponent.user_id) : undefined;
  const oppAllCards = opponent && oppDeck ? await cardsOf(oppDeck.id) : [];
  const board = boardVisible
    ? [...oppAllCards.map((c) => toView(c, false)), ...myCards.map((c) => toView(c, true))]
    : [];

  const mySecret = round
    ? await db().get<{ person_card_id: string }>(
        "SELECT person_card_id FROM round_secrets WHERE round_id = ? AND owner_id = ?",
        [round.id, viewerId]
      )
    : undefined;

  // Opponent's secret id crosses the wire ONLY after the round resolves.
  const oppSecret =
    roundDone && round && opponent
      ? await db().get<{ person_card_id: string }>(
          "SELECT person_card_id FROM round_secrets WHERE round_id = ? AND owner_id = ?",
          [round.id, opponent.user_id]
        )
      : undefined;

  const myEliminations = round
    ? (
        await db().all<{ person_card_id: string }>(
          "SELECT person_card_id FROM eliminations WHERE round_id = ? AND player_id = ? AND eliminated = 1",
          [round.id, viewerId]
        )
      ).map((e) => e.person_card_id)
    : [];

  const guesses =
    roundDone && round
      ? await db().all<{ player_id: string; person_card_id: string; correct: number }>(
          "SELECT player_id, person_card_id, correct FROM guesses WHERE round_id = ?",
          [round.id]
        )
      : [];

  // Before the reveal a player sees only that they have guessed — never
  // whether it was right, and never the opponent's guess.
  const myGuess = round
    ? await db().get<{ person_card_id: string }>(
        "SELECT person_card_id FROM guesses WHERE round_id = ? AND player_id = ?",
        [round.id, viewerId]
      )
    : undefined;
  const oppGuessed = round && opponent
    ? !!(await db().get("SELECT 1 AS x FROM guesses WHERE round_id = ? AND player_id = ?", [round.id, opponent.user_id]))
    : false;

  const rematchVotes = round
    ? (
        await db().all<{ player_id: string }>("SELECT player_id FROM rematch_requests WHERE round_id = ?", [round.id])
      ).map((r) => r.player_id)
    : [];

  const secretCount = round
    ? asInt(
        (
          await db().get<{ n: unknown }>(
            "SELECT CAST(COUNT(*) AS INT) AS n FROM round_secrets WHERE round_id = ?",
            [round.id]
          )
        )?.n
      )
    : 0;

  return {
    room: {
      id: room.id,
      status: room.status,
      promptPolicy: room.prompt_policy,
      deckMin: DECK_MIN,
      deckMax: DECK_MAX,
      expiresAt: room.expires_at,
      hostId: room.host_id,
      joinCode: room.host_id === viewerId ? (room.join_code ?? null) : null,
    },
    me: {
      id: viewerId,
      name: await profileOf(viewerId),
      seat: me.seat,
      ready: !!me.ready_at,
      deckCount: myCards.length,
      deckReady: myDeck?.status === "ready",
      cards: myCards.map((c) => toView(c, true)),
      secretCardId: mySecret?.person_card_id ?? null,
      eliminatedCardIds: myEliminations,
      guessedCardId: myGuess?.person_card_id ?? null,
      rematchRequested: rematchVotes.includes(viewerId),
    },
    opponent: opponent
      ? {
          id: opponent.user_id,
          name: await profileOf(opponent.user_id),
          ready: !!opponent.ready_at,
          online: isOnline(opponent),
          deckCount: oppAllCards.length,
          secretCardId: oppSecret?.person_card_id ?? null, // null until reveal
          hasGuessed: oppGuessed,
          rematchRequested: rematchVotes.includes(opponent.user_id),
        }
      : null,
    board,
    round: round
      ? {
          number: round.number,
          status: round.status,
          winnerId: round.winner_id,
          secretsChosen: secretCount,
          guesses: guesses.map((g) => ({
            playerId: g.player_id,
            cardId: g.person_card_id,
            correct: !!asInt(g.correct),
          })),
        }
      : null,
  };
}

export type Snapshot = Awaited<ReturnType<typeof buildSnapshot>>;
