// Single-player (vs 3 AI bots) game endpoints. The game is server-authoritative
// and held in memory. Coins are staked on entry and paid out on a win.
//
// MVP limitation: in-memory games are lost if the server restarts (free tier
// sleeps when idle) — a mid-game abandonment forfeits the stake. Persisting
// active games is a later hardening step.
import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import {
  createGame,
  mulberry32,
  advanceUntilHuman,
  discard,
  declareSelfWin,
  declareConcealedKong,
  respondToDiscard,
  legalDiscards,
  canDeclareSelfWin,
  legalConcealedKongs,
  claimOptionsFor,
  redactFor,
  GameState,
  Seat,
  Tile,
} from "@mahjong/game-engine";
import { requireAuth, AuthedRequest } from "../middleware/auth.js";
import { applyCoinDelta, ensureWallet, InsufficientCoinsError } from "../coins.js";

export const gameRouter = Router();
gameRouter.use(requireAuth);

const ALLOWED_STAKES = [100, 500, 1000];
const HUMAN_SEAT: Seat = 0; // the human is always the dealer (East)

interface GameEntry {
  id: string;
  userId: string;
  humanSeat: Seat;
  stake: number;
  state: GameState;
  settled: boolean;
}

const games = new Map<string, GameEntry>();

const newId = () => crypto.randomBytes(9).toString("hex");

function humanOptions(state: GameState, seat: Seat) {
  if (state.phase === "action" && state.currentTurn === seat) {
    return {
      kind: "action" as const,
      discards: legalDiscards(state),
      canSelfWin: canDeclareSelfWin(state),
      concealedKongs: legalConcealedKongs(state),
    };
  }
  if (state.phase === "claims") {
    const claims = claimOptionsFor(state, seat);
    if (claims.length > 0) return { kind: "claims" as const, claims };
  }
  return { kind: "wait" as const };
}

function resultOf(entry: GameEntry, settle: { payout: number; balance: number | null } | null) {
  if (entry.state.phase !== "ended") return null;
  return {
    ended: true,
    winner: entry.state.winner,
    winBy: entry.state.winBy,
    youWon: entry.state.winner === entry.humanSeat,
    payout: settle?.payout ?? 0,
    balance: settle?.balance ?? null,
  };
}

function viewFor(entry: GameEntry, settle: { payout: number; balance: number | null } | null = null) {
  return {
    gameId: entry.id,
    stake: entry.stake,
    view: redactFor(entry.state, entry.humanSeat),
    options: humanOptions(entry.state, entry.humanSeat),
    result: resultOf(entry, settle),
  };
}

/** Pay out a finished game exactly once. */
async function settleIfEnded(
  entry: GameEntry
): Promise<{ payout: number; balance: number | null } | null> {
  if (entry.state.phase !== "ended" || entry.settled) return null;
  entry.settled = true;

  const won = entry.state.winner === entry.humanSeat;
  const draw = entry.state.winner === null;
  const payout = won ? entry.stake * 4 : draw ? entry.stake : 0;

  if (payout > 0) {
    const wallet = await applyCoinDelta({
      userId: entry.userId,
      delta: payout,
      type: won ? "WIN" : "BONUS",
      reference: entry.id,
      note: won ? "Single-player win" : "Draw refund",
    });
    return { payout, balance: wallet.balance };
  }
  const w = await ensureWallet(entry.userId);
  return { payout, balance: w.balance };
}

const startSchema = z.object({ stake: z.number().int() });

gameRouter.post("/single/start", async (req: AuthedRequest, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid stake" });
  const { stake } = parsed.data;
  if (!ALLOWED_STAKES.includes(stake)) {
    return res.status(400).json({ error: "Stake not allowed", allowed: ALLOWED_STAKES });
  }

  // Clean up any earlier games for this user (single active game at a time).
  for (const [id, e] of games) if (e.userId === req.userId) games.delete(id);

  // Escrow the stake.
  try {
    await applyCoinDelta({
      userId: req.userId!,
      delta: -stake,
      type: "SPEND",
      note: "Single-player entry",
    });
  } catch (e) {
    if (e instanceof InsufficientCoinsError) {
      return res.status(402).json({ error: "Not enough coins", need: stake });
    }
    throw e;
  }

  const state = createGame(mulberry32(crypto.randomInt(2 ** 31)), HUMAN_SEAT);
  advanceUntilHuman(state, HUMAN_SEAT);

  const entry: GameEntry = {
    id: newId(),
    userId: req.userId!,
    humanSeat: HUMAN_SEAT,
    stake,
    state,
    settled: false,
  };
  games.set(entry.id, entry);

  const settle = await settleIfEnded(entry);
  res.json(viewFor(entry, settle));
});

gameRouter.get("/single/:id", (req: AuthedRequest, res) => {
  const entry = games.get(req.params.id);
  if (!entry || entry.userId !== req.userId) {
    return res.status(404).json({ error: "Game not found" });
  }
  res.json(viewFor(entry));
});

const actionSchema = z.object({
  type: z.enum(["discard", "selfWin", "concealedKong", "claim"]),
  tile: z.any().optional(),
  claim: z.any().optional(),
});

gameRouter.post("/single/:id/action", async (req: AuthedRequest, res) => {
  const entry = games.get(req.params.id);
  if (!entry || entry.userId !== req.userId) {
    return res.status(404).json({ error: "Game not found" });
  }
  if (entry.state.phase === "ended") {
    return res.status(409).json({ error: "Game already ended" });
  }
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid action" });
  const { type, tile, claim } = parsed.data;

  try {
    if (type === "discard") discard(entry.state, entry.humanSeat, tile as Tile);
    else if (type === "selfWin") declareSelfWin(entry.state, entry.humanSeat);
    else if (type === "concealedKong")
      declareConcealedKong(entry.state, entry.humanSeat, tile as Tile);
    else if (type === "claim")
      respondToDiscard(entry.state, entry.humanSeat, (claim ?? "pass") as any);

    advanceUntilHuman(entry.state, entry.humanSeat);
  } catch (e: any) {
    return res.status(400).json({ error: e?.message ?? "Illegal move" });
  }

  const settle = await settleIfEnded(entry);
  res.json(viewFor(entry, settle));
});
