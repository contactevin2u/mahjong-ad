import { describe, it, expect } from "vitest";
import {
  createGame,
  mulberry32,
  botTurnAction,
  botClaimResponse,
  advanceUntilHuman,
  discard,
  declareSelfWin,
  respondToDiscard,
  claimOptionsFor,
  GameState,
  Seat,
} from "../src/index.js";

/** Play a full hand with every seat controlled by the bot heuristic. */
function playAllBots(seed: number): GameState {
  const g = createGame(mulberry32(seed));
  let guard = 0;
  while (g.phase !== "ended" && guard++ < 3000) {
    if (g.phase === "action") {
      const a = botTurnAction(g, g.currentTurn);
      if (a.kind === "win") declareSelfWin(g, g.currentTurn);
      else discard(g, g.currentTurn, a.tile);
    } else {
      const discarder = g.lastDiscard!.seat;
      for (let s = 0 as Seat; s < 4; s = (s + 1) as Seat) {
        if (s === discarder) continue;
        if (g.claimResponses[s] === undefined) {
          respondToDiscard(g, s, botClaimResponse(g, s));
          if (g.phase !== "claims") break;
        }
      }
    }
  }
  return g;
}

describe("bot self-play", () => {
  it("always reaches a terminal state (win or exhausted wall) across many seeds", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const g = playAllBots(seed);
      expect(g.phase).toBe("ended");
      // If someone won, they must be a valid seat; otherwise it's an exhaustive draw.
      if (g.winner !== null) {
        expect(g.winner).toBeGreaterThanOrEqual(0);
        expect(g.winner).toBeLessThan(4);
        expect(g.winBy === "self-draw" || g.winBy === "discard").toBe(true);
      }
    }
  });
});

describe("advanceUntilHuman", () => {
  it("returns control to the human at their action turn or a claimable discard", () => {
    const humanSeat: Seat = 1;
    const g = createGame(mulberry32(3));
    advanceUntilHuman(g, humanSeat);

    if (g.phase === "action") {
      expect(g.currentTurn).toBe(humanSeat); // stopped on the human's move
    } else if (g.phase === "claims") {
      expect(claimOptionsFor(g, humanSeat).length).toBeGreaterThan(0);
    } else {
      expect(g.phase).toBe("ended");
    }
  });

  it("progresses after the human discards and eventually ends", () => {
    const humanSeat: Seat = 0; // dealer
    const g = createGame(mulberry32(5));
    let guard = 0;
    while (g.phase !== "ended" && guard++ < 3000) {
      advanceUntilHuman(g, humanSeat);
      if (g.phase === "ended") break;
      if (g.phase === "action" && g.currentTurn === humanSeat) {
        // human plays like a bot for the test
        const a = botTurnAction(g, humanSeat);
        if (a.kind === "win") declareSelfWin(g, humanSeat);
        else discard(g, humanSeat, a.tile);
      } else if (g.phase === "claims") {
        // human declines any claim
        respondToDiscard(g, humanSeat, "pass");
      }
    }
    expect(g.phase).toBe("ended");
  });
});
