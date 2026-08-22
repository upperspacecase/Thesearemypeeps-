// Curated prompt packs (FR-30..32). The composer surfaces lighter visual and
// relationship prompts first, then more revealing ones as turns progress
// (FR-31). Team-safe mode excludes sensitive families entirely and disables
// custom questions (PRD §13.3).

export interface Prompt {
  id: string;
  text: string;
  family: "visible" | "relationship" | "personality" | "superlative" | "experience";
  /** Minimum turn number before this prompt is suggested. */
  fromTurn: number;
  teamSafe: boolean;
}

export const PROMPTS: Prompt[] = [
  { id: "v1", text: "Are they wearing glasses?", family: "visible", fromTurn: 1, teamSafe: true },
  { id: "v2", text: "Are they wearing a hat?", family: "visible", fromTurn: 1, teamSafe: true },
  { id: "v3", text: "Is the photo taken outdoors?", family: "visible", fromTurn: 1, teamSafe: true },
  { id: "v4", text: "Are they smiling in the photo?", family: "visible", fromTurn: 1, teamSafe: true },
  { id: "r1", text: "Have you known them for more than ten years?", family: "relationship", fromTurn: 1, teamSafe: true },
  { id: "r2", text: "Have you known them since school?", family: "relationship", fromTurn: 2, teamSafe: true },
  { id: "r3", text: "Are they family?", family: "relationship", fromTurn: 2, teamSafe: true },
  { id: "r4", text: "Do you talk to them every week?", family: "relationship", fromTurn: 2, teamSafe: true },
  { id: "p1", text: "Is this person funny?", family: "personality", fromTurn: 2, teamSafe: true },
  { id: "p2", text: "Are they the quiet one in a group?", family: "personality", fromTurn: 3, teamSafe: true },
  { id: "p3", text: "Would they be late to their own party?", family: "personality", fromTurn: 3, teamSafe: true },
  { id: "s1", text: "Is this the funniest person you know?", family: "superlative", fromTurn: 3, teamSafe: true },
  { id: "s2", text: "Is this the person you'd call first with good news?", family: "superlative", fromTurn: 4, teamSafe: true },
  { id: "s3", text: "Is this the person you would call when everything went wrong?", family: "superlative", fromTurn: 4, teamSafe: true },
  { id: "s4", text: "Would you trust them to get you out of trouble?", family: "superlative", fromTurn: 3, teamSafe: true },
  { id: "e1", text: "Have you travelled with this person?", family: "experience", fromTurn: 2, teamSafe: true },
  { id: "e2", text: "Have you lived with them?", family: "experience", fromTurn: 3, teamSafe: true },
  { id: "e3", text: "Have they met your family?", family: "experience", fromTurn: 3, teamSafe: true },
];

export function suggestionsFor(turnNo: number, policy: "friends" | "team_safe", count = 6): Prompt[] {
  const pool = PROMPTS.filter((p) => (policy === "team_safe" ? p.teamSafe : true) && p.fromTurn <= turnNo);
  // Later turns favor the revealing families.
  const weight = (p: Prompt) =>
    (p.family === "superlative" || p.family === "experience" ? turnNo : 0) +
    (p.family === "visible" ? Math.max(0, 4 - turnNo) : 1);
  return [...pool].sort((a, b) => weight(b) - weight(a) + (a.id < b.id ? -0.1 : 0.1)).slice(0, count);
}

export function promptById(id: string): Prompt | undefined {
  return PROMPTS.find((p) => p.id === id);
}
