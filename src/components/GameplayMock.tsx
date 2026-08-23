import React from "react";

// the four rope colours of the mark, cycling across the mock board
const FACES: Array<[string, string, string]> = [
  ["Maya", "#F6EDDC", "#EE7A18"], ["Sam", "#F2E9D6", "#DB3A3E"], ["Priya", "#F6EDDC", "#3F8A24"],
  ["Jack", "#F2E9D6", "#F0A800"], ["Nadia", "#F6EDDC", "#EE7A18"], ["Omar", "#F2E9D6", "#DB3A3E"],
  ["Elif", "#F6EDDC", "#3F8A24"], ["Theo", "#F2E9D6", "#F0A800"], ["June", "#F6EDDC", "#EE7A18"],
  ["Ravi", "#F2E9D6", "#DB3A3E"], ["Kate", "#F6EDDC", "#3F8A24"], ["Milo", "#F2E9D6", "#F0A800"],
  ["Ana", "#F6EDDC", "#EE7A18"], ["Ben", "#F2E9D6", "#DB3A3E"], ["Cleo", "#F6EDDC", "#3F8A24"],
];
const DOWN = new Set([1, 4, 9, 12]);

export function Face({ bg, fg }: { bg: string; fg: string }) {
  return (
    <svg viewBox="0 0 60 80" preserveAspectRatio="xMidYMid slice" style={{ display: "block", width: "100%", height: "100%" }}>
      <rect width="60" height="80" fill={bg} />
      <circle cx="30" cy="30" r="13" fill={fg} />
      <path d="M8 80 C8 58 22 50 30 50 C38 50 52 58 52 80 Z" fill={fg} />
    </svg>
  );
}

export function GameplayMock({ width }: { width?: number }) {
  return (
    <div className="phone-mock" style={width ? { width } : undefined} aria-label="What a game looks like: a board of faces, some swiped away, and the person you picked in the corner">
      <div className="pm-board">
        {FACES.map(([name, bg, fg], i) => (
          <div key={name} className={`pm-card ${DOWN.has(i) ? "down" : ""}`}>
            <div className="pm-face">{DOWN.has(i) ? <span className="pm-not">not them</span> : <Face bg={bg} fg={fg} />}</div>
            <span className="pm-name">{name}</span>
          </div>
        ))}
      </div>
      <div className="pm-foot">
        <span className="pm-q">?</span>
        <span className="pm-count">11 still standing</span>
        <div className="pm-secret">
          <div className="pm-face"><Face bg="#F6EDDC" fg="#EE7A18" /></div>
          <span>you picked</span>
          <strong>Priya</strong>
        </div>
      </div>
    </div>
  );
}

