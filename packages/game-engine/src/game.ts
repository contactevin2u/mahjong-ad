// Authoritative turn/claim state machine for a single hand of Singaporean
// Mahjong. Pure functions over GameState — no I/O — so it can drive the server,
// AI bots, and unit tests identically. The server is the only place this runs;
// clients receive a redacted view (see redactFor).
import {
  Tile,
  Meld,
  Wind,
  WINDS,
  BonusTile,
  isBonus,
} from "./types.js";
import { tileId, sortTiles } from "./tiles.js";
import { deal, Seat } from "./wall.js";
import { Rng } from "./rng.js";
import { isWinningHand } from "./win.js";

export type Phase = "action" | "claims" | "ended";

export interface PlayerState {
  seat: Seat;
  seatWind: Wind; // East/South/West/North based on seat relative to dealer
  hand: Tile[]; // concealed tiles
  melds: Meld[]; // exposed (and concealed kong) melds
  bonus: BonusTile[]; // flowers/seasons/animals set aside
}

/** A claim a player can make on the most recent discard. */
export type ClaimType = "win" | "kong" | "pong" | "chow";

export interface ClaimOption {
  type: ClaimType;
  /** For chow: the two tiles from hand that complete the run. */
  useTiles?: Tile[];
}

export interface GameState {
  players: [PlayerState, PlayerState, PlayerState, PlayerState];
  wall: Tile[]; // live wall; draw tiles from the front, replacements from the back
  dealer: Seat;
  prevailingWind: Wind;
  currentTurn: Seat;
  phase: Phase;
  lastDiscard: { seat: Seat; tile: Tile } | null;
  discards: { seat: Seat; tile: Tile }[];
  // During "claims": which seats still need to respond, and the choices made.
  claimResponses: Record<number, ClaimOption | "pass" | undefined>;
  winner: Seat | null;
  winningTile: Tile | null;
  winBy: "self-draw" | "discard" | null;
  drawnThisTurn: boolean; // did the current player already draw?
}

// ---------- helpers ----------

function counts(tiles: Tile[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tiles) m.set(tileId(t), (m.get(tileId(t)) ?? 0) + 1);
  return m;
}

/** Remove one instance of each given tile id from a hand (mutates a copy). */
function removeTiles(hand: Tile[], remove: Tile[]): Tile[] {
  const out = [...hand];
  for (const r of remove) {
    const idx = out.findIndex((t) => tileId(t) === tileId(r));
    if (idx === -1) throw new Error(`tile ${tileId(r)} not in hand`);
    out.splice(idx, 1);
  }
  return out;
}

function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 4) as Seat;
}

/** Draw one tile from the front of the wall, auto-revealing bonus tiles by
 * replacing them from the back. Returns the drawn (non-bonus) tile, or null if
 * the wall is exhausted. Mutates state (wall + player bonus). */
function drawWithBonus(state: GameState, seat: Seat): Tile | null {
  const player = state.players[seat];
  for (;;) {
    if (state.wall.length === 0) return null;
    const t = state.wall.shift()!;
    if (isBonus(t)) {
      player.bonus.push(t);
      if (state.wall.length === 0) return null;
      // replacement comes from the back of the wall
      const repl = state.wall.pop()!;
      if (isBonus(repl)) {
        player.bonus.push(repl);
        continue; // keep drawing replacements
      }
      return repl;
    }
    return t;
  }
}

/** Total tiles a seat is "holding" toward the 13/14 count (hand + 3 per meld). */
function holdingCount(p: PlayerState): number {
  return p.hand.length + p.melds.length * 3;
}

// ---------- game setup ----------

export function createGame(rng: Rng, dealer: Seat = 0): GameState {
  const d = deal(rng);
  const players = [0, 1, 2, 3].map((seat) => {
    const s = seat as Seat;
    // seat wind: dealer = East, then South/West/North going around
    const windIdx = (s - dealer + 4) % 4;
    return {
      seat: s,
      seatWind: WINDS[windIdx],
      hand: d.players[s].hand,
      melds: [] as Meld[],
      bonus: d.players[s].bonus,
    } as PlayerState;
  }) as GameState["players"];

  return {
    players,
    wall: d.wall,
    dealer,
    prevailingWind: "east",
    currentTurn: dealer,
    phase: "action",
    lastDiscard: null,
    discards: [],
    claimResponses: {},
    winner: null,
    winningTile: null,
    winBy: null,
    drawnThisTurn: true, // dealer starts already holding 14 tiles
  };
}

// ---------- legal-move queries ----------

/** Tiles the current player is allowed to discard (any hand tile). */
export function legalDiscards(state: GameState): Tile[] {
  if (state.phase !== "action") return [];
  return sortTiles(state.players[state.currentTurn].hand);
}

/** Can the current player declare a self-drawn win right now? */
export function canDeclareSelfWin(state: GameState): boolean {
  if (state.phase !== "action") return false;
  const p = state.players[state.currentTurn];
  return isWinningHand(p.hand, p.melds);
}

/** Concealed kongs (4 of a kind in hand) the current player may declare. */
export function legalConcealedKongs(state: GameState): Tile[][] {
  if (state.phase !== "action") return [];
  const p = state.players[state.currentTurn];
  const out: Tile[][] = [];
  for (const [id, c] of counts(p.hand)) {
    if (c === 4) out.push(p.hand.filter((t) => tileId(t) === id).slice(0, 4));
  }
  return out;
}

/** What claims `seat` may make on the current discard. */
export function claimOptionsFor(state: GameState, seat: Seat): ClaimOption[] {
  if (state.phase !== "claims" || !state.lastDiscard) return [];
  if (seat === state.lastDiscard.seat) return []; // can't claim your own discard
  const p = state.players[seat];
  const tile = state.lastDiscard.tile;
  const id = tileId(tile);
  const c = counts(p.hand);
  const options: ClaimOption[] = [];

  // Win on discard
  if (isWinningHand([...p.hand, tile], p.melds)) options.push({ type: "win" });

  // Kong (3 in hand) / Pong (2 in hand)
  if ((c.get(id) ?? 0) >= 3) options.push({ type: "kong" });
  if ((c.get(id) ?? 0) >= 2) options.push({ type: "pong" });

  // Chow — only the seat immediately after the discarder, suited tiles only
  if (seat === nextSeat(state.lastDiscard.seat) && tile.kind === "suit") {
    const { suit, rank } = tile;
    const has = (r: number) =>
      p.hand.find((t) => t.kind === "suit" && t.suit === suit && t.rank === r);
    const combos: [number, number][] = [
      [rank - 2, rank - 1],
      [rank - 1, rank + 1],
      [rank + 1, rank + 2],
    ];
    for (const [a, b] of combos) {
      const ta = has(a);
      const tb = has(b);
      if (ta && tb) options.push({ type: "chow", useTiles: [ta, tb] });
    }
  }
  return options;
}

// ---------- actions ----------

const CLAIM_PRIORITY: Record<ClaimType, number> = { win: 3, kong: 2, pong: 2, chow: 1 };

/** Current player discards a tile; opens the claim window. */
export function discard(state: GameState, seat: Seat, tile: Tile): GameState {
  assert(state.phase === "action", "not in action phase");
  assert(seat === state.currentTurn, "not your turn");
  const p = state.players[seat];
  p.hand = removeTiles(p.hand, [tile]);
  state.lastDiscard = { seat, tile };
  state.discards.push({ seat, tile });

  // Open claim window for the other seats that actually have options.
  state.phase = "claims";
  state.claimResponses = {};
  let anyClaimable = false;
  for (let s = 0 as Seat; s < 4; s = (s + 1) as Seat) {
    if (s === seat) continue;
    if (claimOptionsFor(state, s).length > 0) anyClaimable = true;
    else state.claimResponses[s] = "pass"; // no options → auto-pass
  }
  if (!anyClaimable) advanceToNextTurn(state);
  return state;
}

/** A seat responds to the open discard with a claim or a pass. Resolves the
 * claim window once everyone has responded. */
export function respondToDiscard(
  state: GameState,
  seat: Seat,
  response: ClaimOption | "pass"
): GameState {
  assert(state.phase === "claims", "no discard to respond to");
  assert(seat !== state.lastDiscard!.seat, "cannot claim own discard");
  state.claimResponses[seat] = response;

  // Wait until every other seat has responded.
  for (let s = 0 as Seat; s < 4; s = (s + 1) as Seat) {
    if (s === state.lastDiscard!.seat) continue;
    if (state.claimResponses[s] === undefined) return state; // still waiting
  }
  resolveClaims(state);
  return state;
}

function resolveClaims(state: GameState): GameState {
  const discard = state.lastDiscard!;
  // Pick the highest-priority claim; ties broken by seat order after discarder.
  let best: { seat: Seat; opt: ClaimOption } | null = null;
  for (let i = 1; i <= 3; i++) {
    const s = (((discard.seat + i) % 4) as Seat);
    const r = state.claimResponses[s];
    if (r && r !== "pass") {
      if (!best || CLAIM_PRIORITY[r.type] > CLAIM_PRIORITY[best.opt.type]) {
        best = { seat: s, opt: r };
      }
    }
  }

  if (!best) {
    advanceToNextTurn(state);
    return state;
  }

  const claimer = state.players[best.seat];
  const tile = discard.tile;
  // Remove the discard from the pile (it's being claimed).
  state.discards.pop();
  state.lastDiscard = null;

  if (best.opt.type === "win") {
    endWithWin(state, best.seat, tile, "discard");
    return state;
  }
  if (best.opt.type === "pong") {
    const same = claimer.hand.filter((t) => tileId(t) === tileId(tile)).slice(0, 2);
    claimer.hand = removeTiles(claimer.hand, same);
    claimer.melds.push({ type: "pong", tiles: [tile, ...same], exposed: true });
    startActionTurn(state, best.seat, false); // must discard, no draw
    return state;
  }
  if (best.opt.type === "kong") {
    const same = claimer.hand.filter((t) => tileId(t) === tileId(tile)).slice(0, 3);
    claimer.hand = removeTiles(claimer.hand, same);
    claimer.melds.push({ type: "kong", tiles: [tile, ...same], exposed: true });
    // Kong draws a replacement tile, then discards.
    const repl = drawWithBonus(state, best.seat);
    if (repl) claimer.hand.push(repl);
    startActionTurn(state, best.seat, true);
    return state;
  }
  // chow
  const use = best.opt.useTiles!;
  claimer.hand = removeTiles(claimer.hand, use);
  claimer.melds.push({ type: "chow", tiles: sortTiles([tile, ...use]), exposed: true });
  startActionTurn(state, best.seat, false);
  return state;
}

/** Current player declares a concealed kong, draws a replacement, keeps acting. */
export function declareConcealedKong(state: GameState, seat: Seat, tile: Tile): GameState {
  assert(state.phase === "action" && seat === state.currentTurn, "cannot kong now");
  const p = state.players[seat];
  const four = p.hand.filter((t) => tileId(t) === tileId(tile)).slice(0, 4);
  assert(four.length === 4, "need four of a kind");
  p.hand = removeTiles(p.hand, four);
  p.melds.push({ type: "kong", tiles: four, exposed: false });
  const repl = drawWithBonus(state, seat);
  if (repl) p.hand.push(repl);
  else endAsDraw(state);
  return state;
}

/** Current player declares a self-drawn win. */
export function declareSelfWin(state: GameState, seat: Seat): GameState {
  assert(canDeclareSelfWin(state) && seat === state.currentTurn, "not a winning hand");
  const p = state.players[seat];
  // The winning tile is the one most recently drawn; report the whole hand.
  endWithWin(state, seat, p.hand[p.hand.length - 1], "self-draw");
  return state;
}

// ---------- turn flow ----------

function advanceToNextTurn(state: GameState): GameState {
  const from = state.lastDiscard ? state.lastDiscard.seat : state.currentTurn;
  const next = nextSeat(from);
  startActionTurn(state, next, true);
  return state;
}

/** Make `seat` the active player. If `draw`, draw a tile first (normal turn);
 * if not, the player already holds a claimed tile and must discard. */
function startActionTurn(state: GameState, seat: Seat, draw: boolean): GameState {
  state.currentTurn = seat;
  state.phase = "action";
  state.lastDiscard = null;
  state.claimResponses = {};
  if (draw) {
    const t = drawWithBonus(state, seat);
    if (t === null) {
      endAsDraw(state);
      return state;
    }
    state.players[seat].hand.push(t);
    state.drawnThisTurn = true;
  } else {
    state.drawnThisTurn = false;
  }
  return state;
}

function endWithWin(state: GameState, seat: Seat, tile: Tile, by: "self-draw" | "discard") {
  state.phase = "ended";
  state.winner = seat;
  state.winningTile = tile;
  state.winBy = by;
}

function endAsDraw(state: GameState) {
  state.phase = "ended";
  state.winner = null;
  state.winningTile = null;
  state.winBy = null;
}

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// ---------- views ----------

/** A view of the game safe to send to `viewer`: other hands are hidden (counts
 * only), the wall is hidden. Melds, discards, bonus tiles are public. */
export function redactFor(state: GameState, viewer: Seat) {
  return {
    phase: state.phase,
    dealer: state.dealer,
    prevailingWind: state.prevailingWind,
    currentTurn: state.currentTurn,
    lastDiscard: state.lastDiscard,
    discards: state.discards,
    wallRemaining: state.wall.length,
    winner: state.winner,
    winningTile: state.winningTile,
    winBy: state.winBy,
    you: {
      seat: viewer,
      hand: sortTiles(state.players[viewer].hand),
      melds: state.players[viewer].melds,
      bonus: state.players[viewer].bonus,
    },
    players: state.players.map((p) => ({
      seat: p.seat,
      seatWind: p.seatWind,
      handCount: p.hand.length,
      melds: p.melds,
      bonus: p.bonus,
    })),
  };
}
