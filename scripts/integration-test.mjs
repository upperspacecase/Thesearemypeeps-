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
  async uploadDeck(roomId, prefix, n) {
    for (let i = 0; i < n; i++) {
      const form = new FormData();
      form.append("file", new Blob([TINY_JPEG], { type: "image/jpeg" }), "card.jpg");
      form.append("name", `${prefix}${i + 1}`);
      const res = await this.req(`/api/rooms/${roomId}/cards`, { form });
      if (res.status !== 200) throw new Error(`upload failed: ${res.status} ${JSON.stringify(res.data)}`);
    }
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
const size = (await A.snapshot(roomId)).data.room.deckSize;
await A.uploadDeck(roomId, "A", size);
const notEnough = await B.action(roomId, { type: "mark_ready", consent: true });
ok(notEnough.status === 403 || notEnough.status === 401, "non-member cannot act on the room");

const joined = await B.req("/api/join", { json: { token: inviteToken, displayName: "Bo" } });
ok(joined.status === 200 && joined.data.roomId === roomId, "guest joins by link");
const third = await C.req("/api/join", { json: { token: inviteToken, displayName: "Eve" } });
ok(third.status === 403, "third player is refused (room locked at two seats)");

let snapB = (await B.snapshot(roomId)).data;
ok(snapB.room.status === "deck_setup", "room moves to deck_setup with two players");
ok(snapB.opponent && snapB.opponent.board.length === 0, "opponent deck hidden during setup");

await B.uploadDeck(roomId, "B", size);
const aCardId = (await A.snapshot(roomId)).data.me.cards[0].id;
const preview = await B.req(`/api/images/${aCardId}`);
ok(preview.status === 403, "opponent cannot fetch photos before the round starts");
const strangerImg = await C.req(`/api/images/${aCardId}`);
ok(strangerImg.status === 401 || strangerImg.status === 403, "stranger cannot fetch photos");

const badConsent = await A.action(roomId, { type: "mark_ready", consent: false });
ok(badConsent.status === 400, "readiness requires the consent confirmation");
await A.action(roomId, { type: "mark_ready", consent: true });
await B.action(roomId, { type: "mark_ready", consent: true });
let snapA = (await A.snapshot(roomId)).data;
ok(snapA.room.status === "secret_selection", "both ready → secret selection");

console.log("— secrets");
const aSecret = snapA.me.cards[2].id;
await A.action(roomId, { type: "select_secret", cardId: aSecret });
const wrongDeck = await B.action(roomId, { type: "select_secret", cardId: aSecret });
ok(wrongDeck.status === 403 || wrongDeck.status === 400, "cannot choose a secret from the opponent's deck");
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
const jsonA = JSON.stringify(snapA);
const controlB = snapA.opponent.board.find((c) => c.id !== bSecret).id;
ok(count(jsonA, bSecret) === count(jsonA, controlB), "nothing in A's payload singles out B's secret card");
const jsonB = JSON.stringify(snapB);
const controlA = snapB.opponent.board.find((c) => c.id !== aSecret).id;
ok(count(jsonB, aSecret) === count(jsonB, controlA), "nothing in B's payload singles out A's secret card");
ok(snapB.opponent.board.length === size, "board (opponent deck) is now visible");

console.log("— turns");
const active = snapA.round.activePlayerId;
const inactive = active === snapA.me.id ? B : A;
const activeC = active === snapA.me.id ? A : B;
const outOfTurn = await inactive.action(roomId, { type: "ask_question", text: "Out of turn?" });
ok(outOfTurn.status === 409, "out-of-turn question rejected");

const q1 = await activeC.action(roomId, { type: "ask_question", text: "Are they wearing a hat?" });
ok(q1.status === 200, "active player asks a custom question");
const dupQ = await activeC.action(roomId, { type: "ask_question", text: "Second question?" });
ok(dupQ.status === 409, "second open question rejected");

let respSnap = (await inactive.snapshot(roomId)).data;
const openQ = respSnap.round.questions.find((q) => q.status === "open");
const selfAnswer = await activeC.action(roomId, { type: "answer_question", questionId: openQ.id, answer: "yes" });
ok(selfAnswer.status === 403, "asker cannot answer their own question");
const ans = await inactive.action(roomId, { type: "answer_question", questionId: openQ.id, answer: "not_sure" });
ok(ans.status === 200, "responder answers (not sure)");
respSnap = (await inactive.snapshot(roomId)).data;
ok(respSnap.round.myTurn === true, "turn passes to the responder after answering");

console.log("— eliminations");
const targetCard = (await activeC.snapshot(roomId)).data.opponent.board[1].id;
await activeC.action(roomId, { type: "set_elimination", cardId: targetCard, eliminated: true });
snapA = (await activeC.snapshot(roomId)).data;
ok(snapA.me.eliminatedCardIds.includes(targetCard), "elimination persists for the actor");
const otherView = (await inactive.snapshot(roomId)).data;
ok(!JSON.stringify(otherView.me.eliminatedCardIds).includes(targetCard), "opponent never sees your eliminations");
const ownCardElim = await activeC.action(roomId, { type: "set_elimination", cardId: activeC === A ? aSecret : bSecret, eliminated: true });
ok(ownCardElim.status === 403, "cannot eliminate cards on your own deck");

console.log("— prompts");
const promptQ = await inactive.action(roomId, { type: "ask_question", promptId: "s3" });
ok(promptQ.status === 200, "suggested prompt question works");
await activeC.action(roomId, {
  type: "answer_question",
  questionId: (await activeC.snapshot(roomId)).data.round.questions.find((q) => q.status === "open").id,
  answer: "yes",
});

console.log("— guess & reveal");
// It's activeC's turn again. Guess wrong on purpose: pick a non-secret card.
const board = (await activeC.snapshot(roomId)).data.opponent.board;
const oppSecretId = activeC === A ? bSecret : aSecret;
const wrongCard = board.find((c) => c.id !== oppSecretId).id;
const guess = await activeC.action(roomId, { type: "submit_guess", cardId: wrongCard });
ok(guess.status === 200, "guess accepted");
snapA = (await A.snapshot(roomId)).data;
snapB = (await B.snapshot(roomId)).data;
ok(snapA.room.status === "completed" && snapB.room.status === "completed", "wrong guess completes the round on both clients");
const loser = activeC === A ? snapA : snapB;
const winner = activeC === A ? snapB : snapA;
ok(loser.round.winnerId === loser.opponent.id && winner.round.winnerId === winner.me.id, "wrong guess awards the round to the opponent");
ok(snapA.opponent.secretCardId === bSecret || snapB.opponent.secretCardId === aSecret, "secrets revealed after completion");
const postMutation = await activeC.action(roomId, { type: "ask_question", text: "Too late?" });
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
