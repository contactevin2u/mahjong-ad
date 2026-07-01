// Simple heuristic AI for single-player games, plus an orchestrator that drives
// bot seats until the human must act. Pure over GameState — testable, and reused
// by the server for single-player-vs-bots.
import { Tile } from "./types.js";
import { tileId } from "./tiles.js";
import { Seat } from "./wall.js";
import { isWinningHand } from "./win.js";
import {
  GameState,
  ClaimOption,
  claimOptionsFor,
  discard,
  declareSelfWin,
  respondToDiscard,
} from "./game.js";

function counts(tiles: Tile[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tiles) m.set(tileId(t), (m.get(tileId(t)) ?? 0) + 1);
  return m;
}

/** How useful a tile is to keep (higher = keep). Isolated tiles score ~0. */
function usefulness(hand: Tile[], t: Tile): number {
  const c = counts(hand);
  if (t.kind === "suit") {
    const at = (r: number) =>
      r >= 1 && r <= 9 ? c.get(`${t.suit}-${r}`) ?? 0 : 0;
    const same = (c.get(tileId(t)) ?? 0) - 1; // exclude self
    return (
      same * 3 + at(t.rank - 1) * 2 + at(t.rank + 1) * 2 + at(t.rank - 2) + at(t.rank + 2)
    );
  }
  // honors: only useful in pairs or more
  return ((c.get(tileId(t)) ?? 0) - 1) * 3;
}

/** The bot's discard: the least useful tile in hand. */
export function botDiscardChoice(hand: Tile[]): Tile {
  let worst = hand[0];
  let worstScore = Infinity;
  for (const t of hand) {
    const sc = usefulness(hand, t);
    if (sc < worstScore) {
      worstScore = sc;
      worst = t;
    }
  }
  return worst;
}

export type BotTurnAction = { kind: "win" } | { kind: "discard"; tile: Tile };

/** What a bot does on its own action turn: win if possible, else discard. */
export function botTurnAction(state: GameState, seat: Seat): BotTurnAction {
  const p = state.players[seat];
  if (isWinningHand(p.hand, p.melds)) return { kind: "win" };
  return { kind: "discard", tile: botDiscardChoice(p.hand) };
}

/** How a bot responds to a discard: take a winning tile, otherwise pass.
 * (Bots intentionally don't pong/chow in v1 — keeps games flowing and friendly.) */
export function botClaimResponse(state: GameState, seat: Seat): ClaimOption | "pass" {
  const win = claimOptionsFor(state, seat).find((o) => o.type === "win");
  return win ?? "pass";
}

/**
 * Drive all bot seats forward until the human must make a decision (their action
 * turn, or a discard they can claim) or the hand ends. Mutates and returns state.
 * `humanSeat` is the only seat left for a caller to control.
 */
export function advanceUntilHuman(state: GameState, humanSeat: Seat): GameState {
  let guard = 0;
  while (state.phase !== "ended" && guard++ < 2000) {
    if (state.phase === "action") {
      if (state.currentTurn === humanSeat) return state; // human's move
      const a = botTurnAction(state, state.currentTurn);
      if (a.kind === "win") declareSelfWin(state, state.currentTurn);
      else discard(state, state.currentTurn, a.tile);
      continue;
    }

    // claims phase: figure out who still needs to respond
    const discarder = state.lastDiscard!.seat;
    const pending: Seat[] = [];
    for (let s = 0 as Seat; s < 4; s = (s + 1) as Seat) {
      if (s === discarder) continue;
      if (state.claimResponses[s] === undefined) pending.push(s);
    }

    // If the human has a real claim option, stop and let them decide.
    if (
      pending.includes(humanSeat) &&
      claimOptionsFor(state, humanSeat).length > 0
    ) {
      return state;
    }

    // Otherwise respond for every pending seat as a bot (human with no option
    // was already auto-passed by the engine).
    let acted = false;
    for (const s of pending) {
      if (state.claimResponses[s] !== undefined) continue;
      respondToDiscard(state, s, s === humanSeat ? "pass" : botClaimResponse(state, s));
      acted = true;
      if (state.phase !== "claims") break; // resolved → re-evaluate
    }
    if (!acted) break; // safety net
  }
  return state;
}
