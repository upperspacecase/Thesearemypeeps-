/* Full two-player game driven over the HTTP API, asserting the PRD's
   acceptance criteria (§16) and Appendix B security cases. Run with the
   server already listening: BASE_URL=http://localhost:3111 node scripts/integration-test.mjs */

const BASE = process.env.BASE_URL ?? "http://localhost:3111";

// 1x1 white JPEG
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==",
  "base64"
);

let failures = 0;
function ok(cond, label) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.error(`  ✗ FAIL: ${label}`);
  }
}

class Client {
  constructor(name) {
    this.name = name;
    this.cookies = new Map();
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  absorb(res) {
    const set = res.headers.getSetCookie?.() ?? [];
    for (const line of set) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  async req(path, { method = "GET", json, form } = {}) {
    const headers = { cookie: this.header() };
    let body;
    if (json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(json);
      method = "POST";
    } else if (form) {
      body = form;
      method = "POST";
    }
    const res = await fetch(`${BASE}${path}`, { method, headers, body });
    this.absorb(res);
    let data = null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) data = await res.json();
    else await res.arrayBuffer();
    return { status: res.status, data };
  }
  async action(roomId, payload) {
    return this.req(`/api/rooms/${roomId}/actions`, {
      json: { ...payload, idempotencyKey: crypto.randomUUID() },
    });
  }
  async snapshot(roomId) {
    return this.req(`/api/rooms/${roomId}/snapshot`);
  }
  async uploadOne(roomId, name) {
    const form = new FormData();
    form.append("file", new Blob([TINY_JPEG], { type: "image/jpeg" }), "card.jpg");
    form.append("name", name);
    const res = await this.req(`/api/rooms/${roomId}/cards`, { form });
    if (res.status !== 200) throw new Error(`upload failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  async uploadDeck(roomId, prefix, n) {
    for (let i = 0; i < n; i++) await this.uploadOne(roomId, `${prefix}${i + 1}`);
  }
}

const A = new Client("A");
const B = new Client("B");
const C = new Client("C"); // never a member

console.log("— create & share");
const created = await A.req("/api/rooms", { json: { displayName: "Ada", promptPolicy: "friends" } });
ok(created.status === 200 && created.data.roomId && created.data.inviteToken, "host creates a room without an account");
const { roomId, inviteToken } = created.data;

const peek = await B.req(`/api/join?token=${inviteToken}`);
ok(peek.status === 200 && peek.data.hostName === "Ada", "invite preview shows host name only");

console.log("— decks");
const snap0 = (await A.snapshot(roomId)).data;
const size = snap0.room.deckMin; // play with the minimum deck (5–15 allowed)
await A.uploadDeck(roomId, "A", 1);
const tooSmall = await A.action(roomId, { type: "mark_ready", consent: true });
ok(tooSmall.status === 400, `deck below the minimum (${size}) cannot be marked ready`);
await A.uploadDeck(roomId, "A", size - 2);
await A.uploadOne(roomId, ""); // photos upload unnamed; the name box under the card fills them in
const notEnough = await B.action(roomId, { type: "mark_ready", consent: true });
ok(notEnough.status === 403 || notEnough.status === 401, "non-member cannot act on the room");

const joined = await B.req("/api/join", { json: { token: inviteToken, displayName: "Bo" } });
ok(joined.status === 200 && joined.data.roomId === roomId, "guest joins by link");
const third = await C.req("/api/join", { json: { token: inviteToken, displayName: "Eve" } });
ok(third.status === 403, "third player is refused (room locked at two seats)");

let snapB = (await B.snapshot(roomId)).data;
ok(snapB.room.status === "deck_setup", "room moves to deck_setup with two players");
ok(snapB.board.length === 0, "shared board hidden during setup");

await B.uploadDeck(roomId, "B", size);
const aCardId = (await A.snapshot(roomId)).data.me.cards[0].id;
const preview = await B.req(`/api/images/${aCardId}`);
ok(preview.status === 403, "opponent cannot fetch photos before the round starts");
const strangerImg = await C.req(`/api/images/${aCardId}`);
ok(strangerImg.status === 401 || strangerImg.status === 403, "stranger cannot fetch photos");

// re-crop: the owner can replace a card's photo; the opponent cannot
{
  const form = new FormData();
  form.append("file", new Blob([TINY_JPEG], { type: "image/jpeg" }), "c.jpg");
  const rep = await A.req(`/api/rooms/${roomId}/cards/${aCardId}`, { form });
  ok(rep.status === 200, "owner can replace a card's photo (re-crop)");
  const form2 = new FormData();
  form2.append("file", new Blob([TINY_JPEG], { type: "image/jpeg" }), "c.jpg");
  const rep2 = await B.req(`/api/rooms/${roomId}/cards/${aCardId}`, { form: form2 });
  ok(rep2.status === 403 || rep2.status === 404, "opponent cannot replace someone else's photo");
}

const badConsent = await A.action(roomId, { type: "mark_ready", consent: false });
ok(badConsent.status === 400, "readiness requires the consent confirmation");
const unnamedReady = await A.action(roomId, { type: "mark_ready", consent: true });
ok(unnamedReady.status === 400 && /name/i.test(unnamedReady.data.error), "every photo must be named before the deck is ready");
const blankCard = (await A.snapshot(roomId)).data.me.cards.find((c) => !c.name.trim());
await A.action(roomId, { type: "rename_card", cardId: blankCard.id, name: `A${size}` });
await A.action(roomId, { type: "mark_ready", consent: true });
await B.action(roomId, { type: "mark_ready", consent: true });
let snapA = (await A.snapshot(roomId)).data;
ok(snapA.room.status === "secret_selection", "both ready → secret selection");

console.log("— secrets");
ok(snapA.board.length === size * 2, "the shared board (both decks) is visible at secret selection");
// One board: A's secret is one of B's people, proving cross-deck selection.
const aSecret = snapA.board.find((c) => !c.mine).id;
const crossPick = await A.action(roomId, { type: "select_secret", cardId: aSecret });
ok(crossPick.status === 200, "a secret can be chosen from the other player's people");
const bogusSecret = await B.action(roomId, { type: "select_secret", cardId: crypto.randomUUID() });
ok(bogusSecret.status === 403 || bogusSecret.status === 404, "a secret must be a person on this board");
snapB = (await B.snapshot(roomId)).data;
const bSecret = snapB.me.cards[4].id;
await B.action(roomId, { type: "select_secret", cardId: bSecret });

snapA = (await A.snapshot(roomId)).data;
snapB = (await B.snapshot(roomId)).data;
ok(snapA.room.status === "active", "both secrets → active round");
ok(snapA.me.secretCardId === aSecret, "player sees their own secret");
ok(snapA.opponent.secretCardId === null, "opponent's secret is not in the snapshot");
// The secret card sits on the board like any other card; nothing may single
// it out. So its id must occur in the payload exactly as often as a control
// non-secret card's id does.
const count = (haystack, needle) => haystack.split(needle).length - 1;
// A card the viewer owns naturally appears in both me.cards and board, so
// the control card must come from the same deck as the secret being checked.
const sameDeckControl = (snap, secretId) => {
  const sec = snap.board.find((c) => c.id === secretId);
  return snap.board.find((c) => c.mine === sec.mine && c.id !== aSecret && c.id !== bSecret).id;
};
const jsonA = JSON.stringify(snapA);
ok(count(jsonA, bSecret) === count(jsonA, sameDeckControl(snapA, bSecret)), "nothing in A's payload singles out B's secret card");
const jsonB = JSON.stringify(snapB);
ok(count(jsonB, aSecret) === count(jsonB, sameDeckControl(snapB, aSecret)), "nothing in B's payload singles out A's secret card");
ok(snapB.board.length === size * 2, "everyone's people are on the play board");

console.log("— no turns: the conversation lives off-app");
// Nothing gates play — either player acts whenever. Eliminations first:
const elimSnap = (await A.snapshot(roomId)).data;
const targetCard = elimSnap.board.find((c) => !c.mine).id;
await A.action(roomId, { type: "set_elimination", cardId: targetCard, eliminated: true });
snapA = (await A.snapshot(roomId)).data;
ok(snapA.me.eliminatedCardIds.includes(targetCard), "elimination persists for the actor");
const otherView = (await B.snapshot(roomId)).data;
ok(!JSON.stringify(otherView.me.eliminatedCardIds).includes(targetCard), "opponent never sees your eliminations");
const ownCard = elimSnap.board.find((c) => c.mine).id;
const ownCardElim = await A.action(roomId, { type: "set_elimination", cardId: ownCard, eliminated: true });
ok(ownCardElim.status === 200, "your own people can be flipped too (one board)");
const bogusElim = await A.action(roomId, { type: "set_elimination", cardId: crypto.randomUUID(), eliminated: true });
ok(bogusElim.status === 403 || bogusElim.status === 404, "cannot flip a card that is not on this board");

console.log("— guess & reveal");
// B guesses whenever they like — no turn to wait for. Wrong on purpose:
// B hunts A's secret (aSecret); pick any other card.
const board = (await B.snapshot(roomId)).data.board;
const wrongCard = board.find((c) => c.id !== aSecret && c.id !== bSecret).id;
const guess = await B.action(roomId, { type: "submit_guess", cardId: wrongCard });
ok(guess.status === 200, "either player can guess at any time — no turns");
snapA = (await A.snapshot(roomId)).data;
snapB = (await B.snapshot(roomId)).data;
ok(snapA.room.status === "completed" && snapB.room.status === "completed", "wrong guess completes the round on both clients");
ok(snapB.round.winnerId === snapB.opponent.id && snapA.round.winnerId === snapA.me.id, "wrong guess awards the round to the opponent");
ok(snapA.opponent.secretCardId === bSecret || snapB.opponent.secretCardId === aSecret, "secrets revealed after completion");
const postMutation = await A.action(roomId, { type: "set_elimination", cardId: targetCard, eliminated: false });
ok(postMutation.status === 409, "completed round rejects new gameplay mutations");
const imgAfter = await B.req(`/api/images/${aCardId}`);
ok(imgAfter.status === 200, "opponent can view photos at the reveal");

console.log("— non-member isolation");
const cSnap = await C.snapshot(roomId);
ok(cSnap.status === 401 || cSnap.status === 403, "stranger cannot read the room snapshot");

console.log("— rematch");
await A.action(roomId, { type: "request_rematch" });
let midRematch = (await B.snapshot(roomId)).data;
ok(midRematch.opponent.rematchRequested === true, "rematch request visible to the other player");
await B.action(roomId, { type: "request_rematch" });
snapA = (await A.snapshot(roomId)).data;
ok(snapA.room.status === "secret_selection" && snapA.round.number === 2, "both accept → round 2 secret selection");
ok(snapA.me.secretCardId === null, "new round starts without a secret");

console.log("— deletion");
await A.action(roomId, { type: "select_secret", cardId: snapA.me.cards[0].id });
const del = await A.action(roomId, { type: "delete_deck" });
ok(del.status === 200, "player deletes their own deck");
snapB = (await B.snapshot(roomId)).data;
ok(snapB.room.status === "ended", "deck deletion closes the room");
const imgGone = await B.req(`/api/images/${aCardId}`);
ok(imgGone.status !== 200, "deleted deck's photos are no longer served");

console.log("— team-safe policy");
const team = await A.req("/api/rooms", { json: { displayName: "Ada", promptPolicy: "team_safe" } });
ok(team.data.roomId, "team-safe room created");

if (failures === 0) {
  console.log("\nAll integration checks passed.");
} else {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
