# KNOWERS

A link-based two-player game where your people become the board and the questions reveal how you see them.

Each player uploads a small deck of the real people in their life, secretly chooses one, and sees the other player's deck as their game board. Players alternate yes/no questions — visible ("Is this person wearing a hat?") or revealing ("Is this the funniest person you know?") — privately eliminate cards, and guess the other player's chosen person. The point isn't guessing fastest; it's learning who matters to someone and hearing the stories behind their answers.

## Documentation

- **[Product Requirements Document](docs/PRD.md)** — build-ready draft (v0.9) covering game design, modes, functional requirements, architecture, data model, privacy, analytics, and build sequence.
- **[Reference images](docs/reference/)** — visual references collected during product definition.

## At a glance

- **Platform:** link-first responsive web app (Next.js + Supabase), designed to sit beside any phone or video call — no extension, meeting-platform integration, or native app in v1.
- **MVP mode:** Quick Room — create a private two-player room, share one link, play anonymously with one-time decks that expire automatically.
- **Commercial wedge:** Team Sessions for remote/hybrid teams (onboarding, offsites, team socials), added in v1.1 on the same two-player engine.
- **Non-negotiable:** privacy and consent are part of the core experience — private rooms, short retention, immediate deletion, no facial recognition, no public people graph.

See the [PRD](docs/PRD.md) for the full product definition and build sequence.
