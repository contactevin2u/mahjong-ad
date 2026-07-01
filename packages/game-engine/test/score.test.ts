import { describe, it, expect } from "vitest";
import { scoreWin, GameState, Tile, Suit, Rank, WINDS, Seat } from "../src/index.js";

const s = (suit: Suit, rank: Rank): Tile => ({ kind: "suit", suit, rank });
const dragon = (d: "red" | "green" | "white"): Tile => ({ kind: "dragon", dragon: d });
const wind = (w: "east" | "south" | "west" | "north"): Tile => ({ kind: "wind", wind: w });

function makeWinState(
  hand: Tile[],
  opts: { winBy?: "self-draw" | "discard"; bonus?: Tile[]; seat?: Seat } = {}
): GameState {
  const seat = opts.seat ?? 0;
  const players = [0, 1, 2, 3].map((i) => ({
    seat: i as Seat,
    seatWind: WINDS[i],
    hand: i === seat ? [...hand] : [],
    melds: [],
    bonus: i === seat ? opts.bonus ?? [] : [],
  })) as GameState["players"];
  return {
    players,
    wall: [],
    dealer: 0,
    prevailingWind: "east",
    currentTurn: seat,
    phase: "ended",
    lastDiscard: null,
    discards: [],
    claimResponses: {},
    winner: seat,
    winningTile: hand[hand.length - 1],
    winBy: opts.winBy ?? "discard",
    drawnThisTurn: true,
  };
}

describe("scoreWin", () => {
  it("scores a dragon pong + self-draw", () => {
    const hand: Tile[] = [
      s("dots", 1), s("dots", 2), s("dots", 3),
      s("bamboo", 4), s("bamboo", 5), s("bamboo", 6),
      s("characters", 7), s("characters", 8), s("characters", 9),
      dragon("red"), dragon("red"), dragon("red"),
      wind("east"), wind("east"),
    ];
    const score = scoreWin(makeWinState(hand, { winBy: "self-draw" }), 0);
    const names = score.parts.map((p) => p.name);
    expect(names).toContain("Dragon pong");
    expect(names).toContain("Self-draw");
    expect(score.tai).toBe(2);
  });

  it("scores a full flush", () => {
    const hand: Tile[] = [
      s("dots", 1), s("dots", 1), s("dots", 1),
      s("dots", 2), s("dots", 3), s("dots", 4),
      s("dots", 5), s("dots", 6), s("dots", 7),
      s("dots", 8), s("dots", 8), s("dots", 8),
      s("dots", 9), s("dots", 9),
    ];
    const score = scoreWin(makeWinState(hand, { winBy: "discard" }), 0);
    expect(score.parts.map((p) => p.name)).toContain("Full flush");
    expect(score.tai).toBe(4);
  });

  it("gives East seat a double for the East wind pong in the East round", () => {
    const hand: Tile[] = [
      s("dots", 1), s("dots", 2), s("dots", 3),
      s("bamboo", 4), s("bamboo", 5), s("bamboo", 6),
      wind("east"), wind("east"), wind("east"),
      dragon("green"), dragon("green"), dragon("green"),
      s("characters", 5), s("characters", 5),
    ];
    const score = scoreWin(makeWinState(hand, { winBy: "discard", seat: 0 }), 0);
    const names = score.parts.map((p) => p.name);
    expect(names).toContain("Seat wind pong");
    expect(names).toContain("Prevailing wind pong");
    expect(names).toContain("Dragon pong");
    // East seat wind + East prevailing + green dragon = 3 tai
    expect(score.tai).toBe(3);
  });
});
