# In Good Company

Meet the people behind the person.

In Good Company is a two-player guessing game made from the real people in your lives. Each player brings 12 people, chooses one in secret, and sees the other player's deck as their board. You alternate yes-or-no questions — "Are they wearing a hat?" one minute, "Is this the person you would call when everything went wrong?" a few minutes later — privately eliminate faces, and guess who the other player chose. You're trying to find one person; along the way, you discover an entire world.

## What's here

- **[`index.html`](index.html)** — the landing page: hero, "Before you play" spec sheet, and the five-step "How to play" walkthrough.
- **[Product Requirements Document](docs/PRD.md)** — build-ready draft (v0.9) covering game design, modes, functional requirements, architecture, data model, privacy, analytics, and build sequence.
- **[Reference images](docs/reference/)** — visual references collected during product definition, including the warm frosted-card style direction the landing page follows.

## At a glance

- **Platform:** link-first responsive web app (Next.js + server-side Postgres + WebSockets + private S3-compatible storage), designed to sit beside any phone or video call — no extension, meeting-platform integration, or native app in v1.
- **MVP mode:** Quick Room — create a private two-player room, share one link, play anonymously with one-time decks that expire automatically.
- **Commercial wedge:** Team Sessions for remote/hybrid teams (onboarding, offsites, team socials), added in v1.1 on the same two-player engine.
- **Non-negotiable:** privacy and consent are part of the core experience — private rooms, short retention, immediate deletion, no facial recognition, no public people graph.

See the [PRD](docs/PRD.md) for the full product definition and build sequence.
