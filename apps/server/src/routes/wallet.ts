import { Router } from "express";
import { prisma } from "../db.js";
import { ensureWallet } from "../coins.js";
import { requireAuth, AuthedRequest } from "../middleware/auth.js";

export const walletRouter = Router();

walletRouter.use(requireAuth);

/** Current coin balance. */
walletRouter.get("/", async (req: AuthedRequest, res) => {
  const wallet = await ensureWallet(req.userId!);
  res.json({ balance: wallet.balance });
});

/** Recent ledger entries. */
walletRouter.get("/transactions", async (req: AuthedRequest, res) => {
  const txns = await prisma.transaction.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ transactions: txns });
});
