import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, AuthedRequest } from "../middleware/auth.js";
import { FREE_DEMO_COINS, applyCoinDelta, ensureWallet } from "../coins.js";

export const playRouter = Router();

playRouter.use(requireAuth);

/** Whether the player still has their one-time free demo available. */
playRouter.get("/free-demo/status", async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { freeDemoUsed: true },
  });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ available: !user.freeDemoUsed, coins: FREE_DEMO_COINS });
});

/**
 * Claim the one-time free demo: grants FREE_DEMO_COINS once per account.
 * The freeDemoUsed=false -> true flip is the idempotency guard against
 * double-claims (concurrent or repeated requests).
 */
playRouter.post("/free-demo/claim", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  await ensureWallet(userId);

  // Atomically claim: only the first request (freeDemoUsed still false) wins.
  const claimed = await prisma.user.updateMany({
    where: { id: userId, freeDemoUsed: false },
    data: { freeDemoUsed: true },
  });
  if (claimed.count === 0) {
    return res.status(409).json({ error: "Free demo already claimed", alreadyUsed: true });
  }

  const wallet = await applyCoinDelta({
    userId,
    delta: FREE_DEMO_COINS,
    type: "BONUS",
    note: "One-time free demo",
  });

  res.json({ ok: true, granted: FREE_DEMO_COINS, balance: wallet.balance });
});
