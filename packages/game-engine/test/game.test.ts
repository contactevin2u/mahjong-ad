import { describe, it, expect } from "vitest";
import {
  createGame,
  mulberry32,
  legalDiscards,
  discard,
  respondToDiscard,
  claimOptionsFor,
  canDeclareSelfWin,
  declareSelfWin,
  redactFor,
  GameState,
  PlayerState,
  Tile,
  Suit,
  Rank,
  Wind,
  WINDS,
  Seat,
} from "../src/index.js";

const s = (suit: Suit, rank: Rank): Tile => ({ kind: "suit", suit, rank });
const dragon = (d: "red" | "green" | "white"): Tile => ({ kind: "dragon", dragon: d });
const wind = (w: Wind): Tile => ({ kind: "wind", wind: w });

// Build a controlled game state for targeted tests.
function makeState(
  hands: Tile[][],
  opts: { currentTurn?: Seat; wall?: Tile[] } = {}
): GameState {
  const players = hands.map((hand, seat) => ({
    seat: seat as Seat,
    seatWind: WINDS[seat],
    hand: [...hand],
    melds: [],
    bonus: [],
  })) as GameState["players"];
  return {
    players,
    wall: opts.wall ?? [],
    dealer: 0,
    prevailingWind: "east",
    currentTurn: opts.currentTurn ?? 0,
    phase: "action",
    lastDiscard: null,
    discards: [],
    claimResponses: {},
    winner: null,
    winningTile: null,
    winBy: null,
    drawnThisTurn: true,
  };
}

function passAllClaims(g: GameState) {
  if (g.phase !== "claims" || !g.lastDiscard) return;
  for (let s2 = 0 as Seat; s2 < 4; s2 = (s2 + 1) as Seat) {
    if (s2 === g.lastDiscard.seat) continue;
    if (g.claimResponses[s2] === undefined) respondToDiscard(g, s2, "pass");
  }
}

const holding = (p: PlayerState) => p.hand.length + p.melds.length * 3;

describe("createGame", () => {
  it("deals 14 to dealer, 13 to others, dealer to act", () => {
    const g = createGame(mulberry32(7));
    expect(g.players[0].hand.length).toBe(14);
    expect(g.players[1].hand.length).toBe(13);
    expect(g.currentTurn).toBe(0);
    expect(g.phase).toBe("action");
    expect(legalDiscards(g).length).toBe(14);
  });
});

describe("turn flow", () => {
  it("passes to the next seat (who draws) when nobody claims", () => {
    const g = createGame(mulberry32(7));
    const tile = legalDiscards(g)[0];
    discard(g, 0, tile);
    passAllClaims(g);
    expect(g.phase).toBe("action");
    expect(g.currentTurn).toBe(1);
    expect(holding(g.players[1])).toBe(14); // seat 1 drew a tile
  });
});

describe("pong claim", () => {
  it("lets a player pong a discard and take the turn", () => {
    const g = makeState([
      [dragon("red"), s("dots", 9)], // seat 0 will discard red dragon
      [dragon("red"), dragon("red"), s("bamboo", 5)], // seat 1 can pong
      [s("characters", 1)],
      [s("characters", 2)],
    ]);
    discard(g, 0, dragon("red"));
    expect(g.phase).toBe("claims");
    expect(claimOptionsFor(g, 1).some((o) => o.type === "pong")).toBe(true);

    respondToDiscard(g, 1, { type: "pong" });
    expect(g.currentTurn).toBe(1);
    expect(g.phase).toBe("action");
    const meld = g.players[1].melds[0];
    expect(meld.type).toBe("pong");
    expect(meld.tiles.length).toBe(3);
  });
});

describe("chow claim", () => {
  it("lets the next seat chow a suited discard", () => {
    const g = makeState([
      [s("dots", 3), s("bamboo", 9)], // seat 0 discards dots-3
      [s("dots", 1), s("dots", 2), s("dots", 8)], // seat 1 (next) can chow 1-2-3
      [s("characters", 1)],
      [s("characters", 2)],
    ]);
    discard(g, 0, s("dots", 3));
    expect(claimOptionsFor(g, 1).some((o) => o.type === "chow")).toBe(true);
    const chow = claimOptionsFor(g, 1).find((o) => o.type === "chow")!;
    respondToDiscard(g, 1, chow);
    expect(g.currentTurn).toBe(1);
    expect(g.players[1].melds[0].type).toBe("chow");
  });
});

describe("winning", () => {
  const winHand: Tile[] = [
    s("dots", 1), s("dots", 2), s("dots", 3),
    s("bamboo", 4), s("bamboo", 5), s("bamboo", 6),
    s("characters", 7), s("characters", 8), s("characters", 9),
    dragon("red"), dragon("red"), dragon("red"),
    wind("east"), wind("east"),
  ];

  it("accepts a self-drawn win", () => {
    const g = makeState([winHand, [], [], []]);
    expect(canDeclareSelfWin(g)).toBe(true);
    declareSelfWin(g, 0);
    expect(g.phase).toBe("ended");
    expect(g.winner).toBe(0);
    expect(g.winBy).toBe("self-draw");
  });

  it("accepts a win on another player's discard", () => {
    const thirteen = winHand.filter((_, i) => i !== 13); // remove one east
    const g = makeState([
      [wind("east"), s("bamboo", 9)], // seat 0 discards the winning east
      thirteen, // seat 1 waiting on east
      [s("characters", 1)],
      [s("characters", 2)],
    ]);
    discard(g, 0, wind("east"));
    expect(claimOptionsFor(g, 1).some((o) => o.type === "win")).toBe(true);
    respondToDiscard(g, 1, { type: "win" });
    expect(g.phase).toBe("ended");
    expect(g.winner).toBe(1);
    expect(g.winBy).toBe("discard");
  });
});

describe("redactFor", () => {
  it("hides other players' hands and the wall", () => {
    const g = createGame(mulberry32(7));
    const view = redactFor(g, 0);
    expect(view.you.hand.length).toBe(14);
    expect(view.players[1]).not.toHaveProperty("hand");
    expect(view.players[1].handCount).toBe(13);
    expect(view).not.toHaveProperty("wall");
    expect(view.wallRemaining).toBeGreaterThan(0);
  });
});
