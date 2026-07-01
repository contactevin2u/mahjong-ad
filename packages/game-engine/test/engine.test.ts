import { describe, it, expect } from "vitest";
import {
  buildFullSet,
  FULL_SET_SIZE,
  tileId,
  mulberry32,
  deal,
  isWinningHand,
  Tile,
  Suit,
  Rank,
} from "../src/index.js";

// Helpers to build tiles concisely.
const s = (suit: Suit, rank: Rank): Tile => ({ kind: "suit", suit, rank });
const dragon = (d: "red" | "green" | "white"): Tile => ({ kind: "dragon", dragon: d });
const wind = (w: "east" | "south" | "west" | "north"): Tile => ({ kind: "wind", wind: w });

describe("tile set", () => {
  it("builds a full 148-tile Singaporean set", () => {
    const set = buildFullSet();
    expect(set).toHaveLength(FULL_SET_SIZE);
  });

  it("has exactly 4 copies of each suited tile and 1 of each bonus", () => {
    const counts = new Map<string, number>();
    for (const t of buildFullSet()) counts.set(tileId(t), (counts.get(tileId(t)) ?? 0) + 1);
    expect(counts.get("dots-5")).toBe(4);
    expect(counts.get("wind-east")).toBe(4);
    expect(counts.get("dragon-red")).toBe(4);
    expect(counts.get("flower-plum")).toBe(1);
    expect(counts.get("season-spring")).toBe(1);
    expect(counts.get("animal-cat")).toBe(1);
  });
});

describe("deal", () => {
  it("gives dealer 14 tiles and others 13, all bonus-free, and is deterministic per seed", () => {
    const d = deal(mulberry32(12345));
    expect(d.players[0].hand).toHaveLength(14);
    expect(d.players[1].hand).toHaveLength(13);
    expect(d.players[2].hand).toHaveLength(13);
    expect(d.players[3].hand).toHaveLength(13);
    for (const p of d.players) {
      for (const t of p.hand) {
        expect(["suit", "wind", "dragon"]).toContain(t.kind); // no bonus tiles remain in hand
      }
    }
    // same seed → same first tile of dealer's hand
    const d2 = deal(mulberry32(12345));
    expect(tileId(d.players[0].hand[0])).toBe(tileId(d2.players[0].hand[0]));
  });

  it("conserves tiles: hands + bonuses + wall == 148", () => {
    const d = deal(mulberry32(999));
    const inHands = d.players.reduce((n, p) => n + p.hand.length + p.bonus.length, 0);
    expect(inHands + d.wall.length).toBe(FULL_SET_SIZE);
  });
});

describe("win detection", () => {
  it("accepts a standard 4-sets + pair hand", () => {
    // 123 dots (chow) + 456 bamboo (chow) + 789 characters (chow)
    // + red dragon pong + east wind pair
    const hand: Tile[] = [
      s("dots", 1), s("dots", 2), s("dots", 3),
      s("bamboo", 4), s("bamboo", 5), s("bamboo", 6),
      s("characters", 7), s("characters", 8), s("characters", 9),
      dragon("red"), dragon("red"), dragon("red"),
      wind("east"), wind("east"),
    ];
    expect(isWinningHand(hand)).toBe(true);
  });

  it("accepts all-pongs plus a pair", () => {
    const hand: Tile[] = [
      s("dots", 1), s("dots", 1), s("dots", 1),
      s("bamboo", 2), s("bamboo", 2), s("bamboo", 2),
      s("characters", 3), s("characters", 3), s("characters", 3),
      dragon("green"), dragon("green"), dragon("green"),
      wind("west"), wind("west"),
    ];
    expect(isWinningHand(hand)).toBe(true);
  });

  it("rejects an incomplete hand", () => {
    const hand: Tile[] = [
      s("dots", 1), s("dots", 2), s("dots", 4), // gap, not a run
      s("bamboo", 4), s("bamboo", 5), s("bamboo", 6),
      s("characters", 7), s("characters", 8), s("characters", 9),
      dragon("red"), dragon("red"), dragon("red"),
      wind("east"), wind("east"),
    ];
    expect(isWinningHand(hand)).toBe(false);
  });

  it("rejects a hand of the wrong size", () => {
    const hand: Tile[] = [s("dots", 1), s("dots", 1)];
    expect(isWinningHand(hand)).toBe(false);
  });
});
