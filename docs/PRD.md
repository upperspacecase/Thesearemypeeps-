# KNOWERS — Product Requirements Document

| | |
|---|---|
| **Status** | Build-ready draft (v0.9) |
| **Product owner** | Tay Pattison |
| **Audience** | Product, design, engineering, and early pilot partners |
| **Platform** | Link-first responsive web app built with Next.js |
| **Date** | August 21, 2026 |

> **Product decision:** Build the first version as a standalone real-time web app that sits beside any phone or video call. Do not begin with a browser extension, Zoom app, native mobile app, or built-in calling.

---

## 1. Executive summary

KNOWERS is a two-player deduction game made from the real people in each player's life. Each player uploads a small deck of people, secretly chooses one person from their own deck, and sees the other player's deck as their game board. They alternate asking yes/no questions, privately eliminating cards, and eventually guessing the other player's chosen person.

The visual mechanic gives the conversation structure. The value is not guessing fastest. It is learning who matters to someone, how they see those people, and the stories behind their answers. A question can be visible and literal — "Is this person wearing a hat?" — or relational and revealing — "Is this the funniest person you know?"

The commercial wedge is remote and hybrid teams that need a useful way for people to connect during onboarding, offsites, and team calls. A free friends mode is the distribution loop: people learn the game socially, then bring it to work. The same two-player engine powers both uses, but the workplace version has stricter prompt controls, consent, retention, and organizer tools.

## 2. Product definition

### 2.1 One-line product

> **One sentence:** A link-based two-player game where your people become the board and the questions reveal how you see them.

### 2.2 The change this product should create

Before a game, a player may know their friend or colleague but know almost nothing about the people around them. After a ten-minute round, they should recognize several names and faces, understand at least one relationship more clearly, and have heard a story that would not have surfaced through a standard icebreaker.

### 2.3 Product boundaries

- This is a conversation game, not a social network.
- This is a call companion, not a video or audio calling product.
- This is an identity-elimination game with original branding and interaction design, not a digital reproduction of Guess Who?.
- This is not facial recognition, personality inference, photo analysis, or automated judgement about the people shown.
- This is not an employee assessment, culture score, or HR evaluation tool.

## 3. Customer and positioning

### 3.1 Primary paying customer

The primary buyer is a People Ops lead, founder, chief of staff, team lead, or facilitator responsible for connection inside a remote or hybrid company. The first target should be teams of roughly 8–30 people: large enough that people do not naturally know one another, but small enough that a lightweight social product can be adopted without procurement becoming the product.

The initial paid use cases are new-hire onboarding, virtual offsites, recurring team socials, distributed-team pairings, and post-reorganization connection. The person buying wants an activity that starts quickly, does not feel like training, and creates better conversation than generic icebreakers.

### 3.2 Secondary user and acquisition loop

Friends, dates, couples, siblings, and small social groups use a free one-to-one room. This mode should be easy enough to share in a text message. It creates familiarity and word of mouth, while the workplace product supplies willingness to pay.

### 3.3 Positioning statement

> **For teams:** A social game that helps colleagues meet the people behind the person — without another awkward round of work-safe facts.

## 4. Product principles

- **The people are the content.** The product should feel personal even before the first question. Real names and photos matter more than game decoration.
- **The conversation stays on the call.** The app provides turns, prompts, answers, and a board. It should not compete with the call through excessive animation, chat, audio, or instructions.
- **A link is the installation.** A participant should be able to open the room and join without an account, download, extension, or meeting-platform dependency.
- **Subjectivity is useful.** The same person can be funny to one player and intimidating to another. The game should expose perspective rather than pretend every question has an objective answer.
- **Elimination is private.** Each player's deductions are part of their strategy and must not be shown to the opponent.
- **Consent comes before cleverness.** The system should collect the minimum data needed, make visibility clear, and keep workplace prompts safe by default.
- **The reveal should deepen the game.** Winning is not the end state. The reveal should create a short recap, story, or reason to play again.

## 5. Core game design

### 5.1 Decks and hidden choices

- Each player brings a deck of **12 people** for the MVP. Twelve is enough to create deduction without making setup feel like work. A 16- or 24-card option can follow after testing.
- A card contains a photo and the person's first name or nickname. An optional relationship label (for example, "cousin" or "old flatmate") may be revealed only after the round.
- Each player secretly chooses one person from their own deck. The secret selection is never sent to the opponent's client.
- Each player's board displays the opponent's deck. Players never guess from their own deck.
- Photos are cropped into a consistent card ratio, but the original file is not exposed to the opponent.

### 5.2 Turn loop

1. The active player asks one yes/no question about the opponent's secret person. They may choose a suggested prompt or type their own.
2. The opponent answers **Yes**, **No**, **Not sure**, or **Skip**. The answer appears to both players and is added to the round history.
3. The asker privately taps any cards they want to eliminate. The app does not infer which cards should be removed.
4. The asker may tap "Tell me why" to invite a short story, but the story stays on the call and is not recorded.
5. The turn passes. At the start of any turn, the active player may guess a person instead of asking a question.
6. A correct guess wins the round. An incorrect guess ends that player's chance and awards the round to the opponent. This rule should be configurable only after the core loop is validated.

### 5.3 Question types

Questions do not need to map to structured attributes. The deck owner answers from their own knowledge and perspective. This is what allows a deduction mechanic to become a relationship game.

| Question family | Example | MVP behavior |
|---|---|---|
| Visible | "Is this person wearing a hat?" | Available in every mode. Useful for learning the mechanic, even when the visual answer looks obvious. |
| Relationship | "Have you known this person for more than ten years?" | Available in friends and team-safe packs. |
| Personality | "Is this person funny?" | Available in every mode when phrased respectfully. |
| Superlative | "Is this the funniest person you know?" | Encouraged because it reveals the owner's view, not a fact in the photo. |
| Experience | "Have you travelled with this person?" | Available in friends and team-safe packs. |
| Spicy / sensitive | "Do you think this person has been arrested?" | Friends-only, explicit opt-in, adults only, never included in the workplace prompt pack. |
| Custom | Player-written yes/no question | Allowed in friends mode. Corporate organizers can disable custom prompts. |

### 5.4 End-of-round experience

- Reveal both secret cards and show the path of questions that led to each guess.
- Prompt each player with one optional reflection: "What should I know about this person?"
- Ask a lightweight outcome question: "Did you learn something you did not know?"
- Offer **Rematch**, **Swap decks**, **Save my deck**, **Delete my deck**, and **Share a new room**.

## 6. Modes and release scope

### 6.1 Mode definitions

| Mode | Who it is for | How it starts | Data behavior |
|---|---|---|---|
| Quick Room | Two friends or colleagues | One player creates a room and sends one link | No account required; one-time decks expire automatically |
| Saved Deck | Repeat players | Player signs in and reuses or edits a deck | Deck remains private to the owner until explicitly shared into a room |
| Team Session | Remote or hybrid teams | Organizer sends one event link; participants are paired into rooms | Team-safe prompts; organizer never sees private decks, answers, or eliminations |

### 6.2 Recommended release cut

> **MVP:** Ship Quick Room first, but model rooms, memberships, decks, and events so Team Session can be added without rebuilding the game engine.

The paid hypothesis cannot be validated with a friends-only prototype forever. Once the two-player loop works, the next release should add a simple team event lobby and pair assignment — not a Zoom integration.

| In the first shippable MVP | Explicitly later |
|---|---|
| Create and join a private two-player room by link | Zoom, Teams, Meet, Slack, or browser-extension integrations |
| Anonymous joining and one-time decks | Native iOS or Android apps |
| 12-card upload, crop, label, reorder, and remove | Contact import, social-network import, or directory scraping |
| Secret choice, turns, prompts, answers, private elimination, guesses, and reveal | AI question generation, face analysis, automatic tagging, or inferred eliminations |
| Reconnect to an active room on the same browser | Async play, spectators, group boards, tournaments, or public profiles |
| Team-safe and friends prompt packs | Payments, subscriptions, SSO, HRIS, and enterprise administration |
| Delete now and automatic expiry controls | Long-term analytics on identifiable game content |

## 7. Primary user flows

### 7.1 Create and share a Quick Room

1. Creator lands on the homepage and chooses "Play with someone".
2. The app creates an anonymous session and asks for a display name.
3. Creator builds a 12-person deck, confirms they have permission to share the images in this private game, and chooses a prompt safety level.
4. The app creates a hard-to-guess room link and presents Copy link, native Share, and QR code actions.
5. Creator enters the lobby and can keep the link open on a laptop or phone while continuing their existing call.

### 7.2 Join from a shared link

1. Invitee opens the link and sees the host name, mode, expected time, privacy summary, and a single Join button.
2. Invitee enters a display name and creates their own 12-person deck.
3. The room shows both players' readiness without showing either deck early.
4. When both players are ready, each privately chooses a secret person from their own deck.
5. The game starts automatically after both secret selections are confirmed.

### 7.3 Play and reconnect

- The current turn, latest question, latest answer, opponent status, and the player's private board are visible on one screen.
- A reconnecting player returns to the current canonical room state, including their own eliminations, without exposing the opponent's secret or eliminations.
- If a player is offline for more than 60 seconds, the opponent can wait, copy the link again, or end the room. No automatic win is awarded in the MVP.
- A room expires after inactivity. Expiry is visible before uploads begin and again on the result screen.

### 7.4 Team Session flow (v1.1)

1. Organizer creates an event, sets a start time, chooses team-safe prompt settings, and receives one event link.
2. Participants join, create or select a deck, and wait in a shared lobby.
3. Organizer clicks Pair participants. The app creates one two-player room for each pair and displays the assigned partner.
4. Participants move into existing breakout rooms or calls and play. The product does not create the call.
5. Organizer can see connection and completion status only. They cannot see decks, questions, answers, chosen people, or eliminated cards.
6. Organizer may reshuffle for another round. Participants keep control of whether their deck is reused.

## 8. Functional requirements

### 8.1 Room, identity, and sharing

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | A user can create a Quick Room without registering. | Must |
| FR-02 | The room produces one shareable HTTPS link plus native share, copy, and QR actions. | Must |
| FR-03 | Only two active player memberships are allowed in a Quick Room. | Must |
| FR-04 | Opening a link creates or resumes an anonymous authenticated user session. | Must |
| FR-05 | A room can be locked after both players join so the link cannot admit a replacement. | Must |
| FR-06 | The host can end the room; either player can leave and delete their own one-time deck. | Must |
| FR-07 | The room page is marked noindex and does not reveal participant names or photos in link previews. | Must |

### 8.2 Deck creation

| ID | Requirement | Priority |
|---|---|---|
| FR-10 | Upload exactly 12 valid cards before marking the deck ready; show progress as x/12. | Must |
| FR-11 | Accept common phone and web image formats; normalize orientation, resize, and crop before storage. | Must |
| FR-12 | Each card requires a first name or nickname. Relationship label and short note are optional and hidden during play. | Must |
| FR-13 | Users can crop, reorder, replace, or remove a card before the round begins. | Must |
| FR-14 | The user must confirm permission to share the images in a private game and confirm that every depicted person is an adult. | Must |
| FR-15 | The interface explains exactly who can see the deck and for how long before upload. | Must |
| FR-16 | A saved deck requires a recoverable account. Anonymous decks cannot silently become permanent. | Should |

### 8.3 Game state and turns

| ID | Requirement | Priority |
|---|---|---|
| FR-20 | Both players choose one secret from their own deck; selection remains readable only by its owner and trusted server-side validation. | Must |
| FR-21 | The server assigns the first turn and rejects actions submitted out of turn. | Must |
| FR-22 | A question contains text, prompt-pack identifier when applicable, author, turn, and timestamp. | Must |
| FR-23 | The responder can answer Yes, No, Not sure, or Skip. Only the responder can submit or change the answer before the turn closes. | Must |
| FR-24 | Each player can eliminate and restore opponent cards on their private board. These changes survive reconnects. | Must |
| FR-25 | A guess is validated on the server without exposing the secret person identifier to the opposing client. | Must |
| FR-26 | A completed round cannot accept new gameplay mutations. | Must |
| FR-27 | Both clients converge on the same question, answer, turn, and result state after reconnect. | Must |

### 8.4 Prompts, result, and replay

- **FR-30:** Offer a curated set of prompts without requiring the user to browse a large library.
- **FR-31:** Start with lighter visual and relationship prompts, then surface more revealing prompts as the round progresses.
- **FR-32:** Friends mode allows custom questions and an explicit spicy pack. Team mode defaults to curated team-safe prompts and lets an organizer disable custom questions.
- **FR-33:** The result screen reveals both chosen people, asks one optional story prompt, and offers a rematch.
- **FR-34:** A player can delete a one-time deck immediately from the result screen.
- **FR-35:** Analytics must not store names, photos, secret selections, or free-text question content.

## 9. Screens and interaction model

| Screen | Purpose and required elements |
|---|---|
| Home | Explain the game in one sentence; start Quick Room; join by existing link; show privacy cue. |
| Room setup | Display name, mode, prompt safety level, and expiry summary. |
| Deck builder | 12-card progress, multi-upload, crop, names, reorder, consent confirmation, and readiness. |
| Share / lobby | Host, invite link, QR code, connection state, deck readiness, and call-sidecar guidance. |
| Secret selection | Private view of the player's own deck; one clear confirmation step. |
| Game board | Opponent deck, private eliminations, own secret reminder, turn state, question composer, and history. |
| Answer sheet | Question in large type; Yes, No, Not sure, Skip; optional "Tell them why" cue. |
| Guess confirmation | Selected name and photo; explicit warning that a wrong guess loses the round. |
| Reveal / result | Winner, both secrets, story prompt, outcome check, rematch, save, delete, and share. |
| Team event lobby | Participant readiness, pairing, round status, reshuffle, and privacy-safe organizer view. |

### 9.1 Responsive game board

- **Mobile:** three card columns, sticky turn/action bar, question composer as a bottom sheet, and large tap targets.
- **Laptop:** four to six columns depending on viewport, with question history beside the board when space allows.
- Eliminated cards remain recognizable but are visibly flipped, dimmed, or crossed out. Animation must respect reduced-motion settings.
- Names remain legible at every supported size. Cropping cannot remove the name or critical controls.
- The player's own secret appears in a small private reminder area; it is never present in opponent-accessible markup or payloads.
- Turn state cannot rely on color alone. Text, icon, and disabled-state behavior must agree.

### 9.2 First-use guidance

The first turn should teach the game in place: ask a yes/no question, wait for the answer, then tap cards to eliminate. Avoid a multi-screen tutorial. A short tooltip should explain that eliminations are private and that the other person answers from their own perspective.

## 10. State machine and real-time behavior

### 10.1 Room and round states

| State | Entry condition | Permitted next states |
|---|---|---|
| draft | Room created; host may still be building a deck | waiting_for_player, expired |
| waiting_for_player | Host has a valid invite link | deck_setup, expired, ended |
| deck_setup | Two players joined; at least one deck incomplete | secret_selection, ended, expired |
| secret_selection | Both decks ready | active, ended, expired |
| active | Both secrets selected; turn owner assigned | completed, ended, expired |
| completed | Correct or incorrect final guess resolved | rematch, ended, expired |
| rematch | Both players accept rematch | secret_selection, ended, expired |
| ended / expired | User action or retention policy closes room | None |

### 10.2 Synchronization rules

- Postgres holds canonical room state. Realtime messages improve latency but are not the only copy of meaningful state.
- Presence communicates connection, readiness, and temporary online status. Presence is not used for the turn ledger or secret selection.
- Question, answer, turn, guess, completion, and private elimination changes are persisted before or atomically with their broadcast.
- Every mutation includes room_id, round_id, actor_id, expected_state, and an idempotency key. Stale or duplicate actions are rejected safely.
- The client may update private eliminations optimistically, then reconcile with persisted state. It must not optimistically announce a winner.
- On reconnect, the client fetches a fresh authorized snapshot before subscribing to the private room channel.

### 10.3 Realtime event contract

| Event | Authority | Audience | Persisted |
|---|---|---|---|
| player.joined | Server | Both room members | Yes |
| player.presence | Client via Presence | Both room members | No |
| player.ready | Server | Both room members | Yes |
| round.started | Server | Both room members | Yes |
| question.asked | Server | Both room members | Yes |
| question.answered | Server | Both room members | Yes |
| cards.eliminated | Server | Actor only | Yes |
| turn.changed | Server | Both room members | Yes |
| guess.resolved | Server | Both room members | Yes |
| round.completed | Server | Both room members | Yes |
| room.ended | Server | Both room members | Yes |

## 11. Technical architecture

> **Recommended stack:** Next.js App Router and TypeScript for the web application; Supabase Auth, Postgres, Realtime, and private Storage for identity, state, synchronization, and images; deploy the Next.js application on Vercel.

### 11.1 Application structure

- Use Server Components for initial authorized room and deck snapshots; use Client Components for the live board, uploader, prompt composer, and presence indicators.
- Use Next.js Route Handlers or server-side functions for room creation, link-token exchange, readiness, secret selection, question and answer mutations, and guess validation.
- Do not expose a service-role credential to the browser. Browser access uses a publishable key plus authenticated user JWT and Row Level Security.
- Use one private realtime channel per room: `room:{room_id}`. Authorize Broadcast and Presence membership against room_players.
- Keep the call outside the product. Add an unobtrusive "Keep your call open — this game works in another tab or on your phone" cue in the lobby.

### 11.2 Authentication and link joining

- Create an anonymous authenticated user on first interaction so every player has a stable user ID and RLS-scoped records without sign-up friction.
- The share URL contains a high-entropy invite token, not the raw room ID. Exchange the token server-side for a room membership; then remove it from subsequent navigation where practical.
- A browser session can resume the same active room. Cross-device recovery and saved decks require email magic link or another recoverable identity.
- Apply CAPTCHA or equivalent abuse controls to anonymous account creation and upload initiation before a public launch.

### 11.3 Photo pipeline

1. Client validates file type and size, corrects orientation, lets the user crop, and resizes to the required card dimensions before upload.
2. Client uploads into a private bucket path scoped to the authenticated owner and deck.
3. Opponent access is permitted only while both users are authorized members of the active room. Serve transformed card-sized assets through short-lived signed URLs or an authenticated image endpoint.
4. Do not retain the original high-resolution file when the normalized card asset is sufficient.
5. On deletion or expiry, delete both database rows and underlying storage objects through supported storage APIs.

### 11.4 Server-authoritative actions

The following actions must be validated on the server or inside tightly scoped database functions. A direct client write is acceptable only when equivalent authorization and state-transition checks are enforced by RLS and constraints.

| Action | Required validation |
|---|---|
| create_room | Authenticated actor; rate limit; issue high-entropy invite token; set expiry |
| join_room | Valid unused/active token; room has capacity; create idempotent membership |
| mark_ready | Actor owns exactly one valid 12-card deck assigned to room |
| select_secret | Actor owns selected card; room is in secret_selection; store in owner-only field/table |
| ask_question | Actor owns current turn; no unanswered question exists; prompt allowed by mode |
| answer_question | Actor is responder; question open; allowed answer enum |
| set_eliminations | Actor only; card IDs belong to opponent deck; private visibility |
| submit_guess | Actor owns current turn; candidate belongs to opponent deck; compare without returning secret ID |
| complete_round | Derived only from guess result; exactly-once winner and state transition |
| delete_deck | Actor owns deck; revoke current sharing; remove storage objects |

## 12. Data model

Identifiers should be UUIDs. Every table includes created_at and updated_at where useful. Use explicit foreign keys, check constraints, unique constraints, and RLS on every exposed table. Store secret selections separately from opponent-readable round data to make accidental disclosure harder.

| Entity | Key fields | Visibility |
|---|---|---|
| profiles | id (auth user), display_name, account_type, is_anonymous | Owner; minimal room-member projection |
| decks | id, owner_id, title, persistence, expires_at, consent_version, status | Owner only except active room projection |
| person_cards | id, deck_id, display_name, relationship_label, storage_path, sort_order | Owner; authorized opponent gets game-safe fields only |
| rooms | id, host_id, mode, status, invite_token_hash, prompt_policy, expires_at | Room members; token never returned after exchange |
| room_players | room_id, user_id, seat, ready_at, joined_at, deck_id | Room members; constrained to two seats |
| rounds | id, room_id, number, status, active_player_id, winner_id, started_at, ended_at | Room members |
| round_secrets | round_id, owner_id, person_card_id | Owner and trusted validation only |
| questions | id, round_id, turn_no, asker_id, text, prompt_id, status | Room members while active |
| answers | question_id, responder_id, answer_enum, answered_at | Room members while active |
| eliminations | round_id, player_id, person_card_id, eliminated | Player only |
| guesses | id, round_id, player_id, person_card_id, correct, created_at | Candidate hidden until resolved; result visible to room |
| team_events | id, organizer_id, name, policy, status, starts_at, expires_at | Organizer and participants |
| team_event_members | event_id, user_id, display_name, readiness, current_room_id | Organizer sees status; no deck contents |

## 13. Privacy, consent, and safety

> **Non-negotiable:** The product asks users to upload images of people who are not necessarily users. Privacy is therefore part of the core experience, not a terms-page afterthought.

### 13.1 Consent and visibility

- Before upload, state that the other player will see the photo and name during the private room.
- Require the uploader to confirm they have permission to share the image in this context and that the depicted person is an adult. The MVP does not accept cards of minors.
- Do not create public profile pages, searchable people directories, shared social graphs, or shareable card URLs.
- Do not allow the organizer of a Team Session to inspect participant decks or gameplay content.
- Provide immediate Delete card and Delete deck controls. Deletion should revoke access before the user leaves the screen and complete storage cleanup asynchronously with auditability.
- Warn users that another participant can still take a screenshot; the product cannot technically prevent this.

### 13.2 Retention defaults

| Data | Default retention | Notes |
|---|---|---|
| One-time room and deck | Delete 24 hours after room completion or expiry | Allow either player to delete their own deck immediately |
| Saved deck | Until owner deletion; prompt review after prolonged inactivity | Requires recoverable account and clear persistent-storage choice |
| Team event metadata | 30 days after event | Organizer sees participant and completion status only |
| Questions and answers | Same as room | Do not send free-text content to product analytics |
| Aggregate analytics | Per analytics policy | No names, photos, secrets, or question text |

### 13.3 Prompt safety

- Team-safe mode excludes prompts about criminal history, sexual behavior, health, disability, religion, politics, race or ethnicity, finances, substance use, and other highly sensitive personal information.
- Custom questions are disabled by default for paid workplace sessions. Organizers can enable them only after seeing the risk explanation.
- Friends-only spicy prompts require an explicit adult opt-in by both players for that room. Leaving spicy mode immediately removes those suggestions.
- Either player can Skip any question without penalty. The interface should normalize skipping rather than framing it as refusal.
- Add report and block controls before public discovery or stranger matching. Stranger matching itself is out of scope.
- Do not use AI to infer whether a question is true about a person or to generate sensitive facts from an image.

### 13.4 Legal and brand review

Use Guess Who? only as an internal explanatory reference. Do not use the name in product branding, app-store text, SEO, room copy, or a look-and-feel that could imply affiliation. Complete a focused privacy, trademark, image-rights, workplace-use, and data-processing review before a public or paid launch. This PRD defines product requirements, not legal advice.

## 14. Non-functional requirements

- **Performance:** First useful room content should render quickly on ordinary mobile connections. Card thumbnails should be normalized and lazy-loaded; uploads should show per-file progress and recover from transient failures.
- **Reliability:** No secret may appear in an opponent-authorized response, HTML payload, realtime event, client cache, error message, or analytics event. Reconnect must restore canonical game state.
- **Concurrency:** Design for many independent two-player rooms rather than one large shared board. Room isolation must be enforced in channel authorization and RLS.
- **Accessibility:** Keyboard support for every action, visible focus, 44px-class touch targets, descriptive labels, high contrast, reduced motion, and no color-only status.
- **Compatibility:** Support current evergreen desktop and mobile browsers. The core flow must work in an ordinary browser tab while another app handles the call.
- **Observability:** Log mutation failures, reconnects, channel authorization errors, upload failures, and state-transition conflicts using room-safe identifiers. Never log photos, names, secrets, or free-text questions.
- **Abuse controls:** Rate-limit room creation, token exchange, uploads, and anonymous sign-ins. Enforce file type, size, and content-policy checks.
- **Deletion:** Deletion jobs must be idempotent, retryable, and observable. A failed storage deletion cannot be treated as successful merely because the database row disappeared.

## 15. Analytics and success criteria

### 15.1 North-star behavior

> **Meaningful completion:** Both players reach the reveal and at least one reports that they learned something they did not know.

### 15.2 Funnel events

- room_created, invite_copied, invite_opened, join_started, join_completed
- deck_started, first_card_added, deck_completed, consent_confirmed
- both_ready, round_started, question_asked, answer_submitted, guess_submitted, round_completed
- learned_something_yes/no, rematch_started, deck_saved, deck_deleted, new_room_shared
- team_event_created, event_joined, pair_assigned, pair_completed, next_round_started

Analytics payloads may include product mode, anonymized room identifier, turn number, prompt-pack identifier, device class, latency, and error class. They must not include photo data, person names, selected card IDs, relationship labels, or free-text question text.

### 15.3 Initial hypothesis targets

These are testable launch hypotheses, not forecasts. Replace them with observed baselines after the first 50–100 completed rooms.

| Metric | Initial target | Why it matters |
|---|---|---|
| Invite open to joined room | 70% or higher | Tests whether the link and join explanation feel safe and easy |
| Deck start to valid 12-card deck | 60% or higher | The largest expected friction point |
| Both-ready rooms that complete | 75% or higher | Tests stability and clarity of the core loop |
| Median active round length | 6–12 minutes | Long enough for conversation; short enough for calls |
| Players reporting "learned something" | 60% or higher | Measures the intended change rather than only game completion |
| Completed players who rematch or share | 35% or higher | Early signal of repeatability and organic distribution |
| Team pilot organizer intent to reuse | 50% or higher | Early willingness-to-pay proxy before pricing optimization |

## 16. Acceptance criteria for the MVP

- [ ] Two people on different devices can create/join the same room from one link without making permanent accounts.
- [ ] Each can upload, crop, name, reorder, and confirm a 12-person deck on mobile and desktop.
- [ ] Neither player can see the other deck before the intended reveal point or access a room they have not joined.
- [ ] Each can choose a private secret; inspection of authorized API responses and realtime payloads does not reveal the opponent's choice.
- [ ] The server enforces turn order, one open question at a time, allowed answers, and valid guesses.
- [ ] Each player's eliminated cards remain private and survive refresh/reconnect.
- [ ] A correct and incorrect guess both resolve deterministically, produce the same result on both clients, and prevent further round mutations.
- [ ] The reveal offers a rematch and immediate deletion. Expired one-time assets are removed according to the retention job.
- [ ] Team-safe rooms do not surface sensitive prompt packs. Custom prompt availability follows the room policy.
- [ ] The complete core loop is usable with keyboard-only interaction, screen-reader labels, high contrast, and reduced motion.
- [ ] No analytics event, application log, or error trace contains a photo, person name, secret, relationship label, or free-text question.
- [ ] The application remains usable beside an active Zoom, Meet, FaceTime, WhatsApp, or ordinary phone call without requiring integration with any of them.

## 17. Build sequence

### Phase 0 — Test the game before infrastructure

- Run five to ten moderated games with a clickable/local prototype and real participant photos.
- Validate 12 cards, wrong-guess rule, turn length, question categories, and whether the reveal creates a story.
- Observe deck-creation time and where users hesitate about privacy or photo selection.

### Phase 1 — Link, decks, and room authorization

- Anonymous auth, room creation, invite-token exchange, two seats, private storage, deck builder, expiry, and RLS tests.
- Mobile-first upload/crop pipeline with reliable reconnect and deletion.

### Phase 2 — Complete real-time game loop

- Secret selection, server-authoritative turn state, prompts, questions, answers, private elimination, guesses, reveal, and rematch.
- Concurrency, stale-action, duplicate-action, refresh, offline, and multi-tab tests.

### Phase 3 — Trust and pilot readiness

- Retention workers, immediate deletion, prompt policies, reporting path, rate limits, CAPTCHA, accessibility, logging redaction, and analytics.
- Private pilot with friend pairs and several remote-team pairs. Measure the full funnel and interview both completers and abandoners.

### Phase 4 — Commercial Team Session

- Organizer account, one event link, participant lobby, pairing, status-only dashboard, reshuffle, and team-safe policy controls.
- Only after repeated team use: billing, reusable event templates, company SSO, meeting-platform integrations, and administration.

## 18. Key product decisions still to validate

| Decision | Recommended starting point |
|---|---|
| Deck size | Start at exactly 12. Test 16 only if setup is fast and rounds feel too short. |
| Wrong guess | Start with a wrong guess ending the round. It creates a real decision and simpler completion logic. |
| Names on cards | Show first names or nicknames during play. Learning names is part of the desired outcome. |
| Relationship labels | Collect optionally but reveal after the round so they do not collapse deduction too early. |
| "Tell me why" | Keep optional and off-platform. Measure use through a tap, but never record the spoken story. |
| Saved decks | Keep outside the first anonymous loop unless repeated setup blocks replay. |
| Spicy mode | Test only with consenting adult friend pairs; do not make it part of the initial workplace pilot. |
| Team pairing | Begin with organizer-triggered random pairs. Do not add algorithmic matching until there is evidence it improves outcomes. |

## 19. Risks and mitigations

| Risk | Failure mode | Mitigation |
|---|---|---|
| Upload friction | Twelve photos may still feel like work. | Support multi-select, phone-first crop, clear progress, and optional saved decks after validation. |
| Third-party privacy | People shown may not have chosen to participate. | Explicit permission confirmation, adults-only MVP, private rooms, short retention, no public graph, immediate deletion. |
| Workplace harm | Sensitive prompts can expose or embarrass people. | Team-safe default, custom questions off by default, Skip without penalty, organizer cannot inspect content. |
| Game becomes superficial | Players rely only on visible photo questions. | Prompt progression favors relationship and story questions after early turns; reveal asks what should be known about the person. |
| Cheating / leakage | A secret reaches the opponent's client or logs. | Separate secret table, server-side guess validation, RLS tests, payload audits, redacted observability. |
| Realtime divergence | Players see different turns or results. | Persist canonical state, idempotent mutations, version checks, reconnect snapshot, server-resolved completion. |
| Trademark resemblance | Brand or UI is confused with an existing game. | Original name, copy, visual system, prompt mechanics, and focused legal review before launch. |
| Too many surfaces | Zoom, extensions, native apps, and calling dilute the first build. | One responsive link-first web app until usage proves a specific integration is worth the cost. |

## 20. Technical implementation references

The architecture recommendations above were checked against the current official documentation. These links are implementation references, not user-facing dependencies.

- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Supabase Realtime overview](https://supabase.com/docs/guides/realtime)
- [Supabase Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast)
- [Supabase Realtime Presence](https://supabase.com/docs/guides/realtime/presence)
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase signed Storage URLs](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl)

## Appendix A — Suggested route map

| Route | Purpose |
|---|---|
| `/` | Landing page and create-room action |
| `/r/[inviteToken]` | Invite landing and token exchange; do not retain token in analytics |
| `/room/[roomId]/setup` | Display name, mode summary, and deck setup |
| `/room/[roomId]/lobby` | Share, presence, readiness, and wait state |
| `/room/[roomId]/choose` | Private secret selection |
| `/room/[roomId]/play` | Live game board |
| `/room/[roomId]/result` | Reveal, outcome check, replay, save/delete |
| `/events/new` | Team organizer creates an event (v1.1) |
| `/events/[eventId]` | Participant/organizer event lobby (v1.1) |
| `/account/decks` | Saved deck management (later or v1.1) |
| `/privacy` | Plain-language privacy and retention explanation |

## Appendix B — Required test cases

### Authorization

- Non-member cannot read room, decks, cards, questions, answers, eliminations, or realtime channel.
- Player A cannot read Player B's secret or eliminations through direct queries, route responses, subscriptions, cache, or error output.
- Organizer cannot inspect team participant decks or gameplay content.

### State integrity

- Out-of-turn question, duplicate answer, stale turn version, second open question, and post-completion mutation are rejected.
- Two simultaneous guesses produce one deterministic completion.
- Refresh and reconnect restore the same turn, history, and actor-private eliminations.

### Uploads and deletion

- Invalid type, oversized file, failed crop, interrupted upload, and duplicate retry leave no orphaned or public object.
- Immediate deletion revokes room access; expiry job removes database rows and storage objects idempotently.
- Signed or authenticated image access cannot be extended by changing a path or card ID.

### Responsive and accessible use

- Complete a round on narrow mobile, ordinary phone, tablet, and laptop widths.
- Complete every action with keyboard only and with screen-reader labels.
- Reduced motion, high zoom, long names, slow connection, and dropped realtime channel remain usable.

## Appendix C — Reference images

Visual references collected during product definition, stored in [`docs/reference/`](reference/):

| File | What it shows |
|---|---|
| `inspiration-calm-card-ui.jpg` | Tone/visual inspiration: a soft, warm, single-card interface that stays calm beside a call |
| `guess-who-board-1.jpg` | Physical Guess Who? board — the flip-to-eliminate mechanic the game reinterprets |
| `guess-who-board-2.jpg` | Physical board detail — card frames and a single standing face card |
| `guess-who-tray-cards.jpg` | Card tray and loose people cards — deck setup as a physical analogue |
| `mobile-web-link-first.png` | Mobile web reference: a link-first responsive site working in an ordinary browser tab |
