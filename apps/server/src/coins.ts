// Coin packages (server-defined — the client can NEVER set prices/coins) and
// atomic wallet mutation helpers backed by the immutable Transaction ledger.
import { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "./db.js";

/** Purchasable coin packages. amountCents is MYR (sen). */
export interface CoinPackage {
  id: string;
  label: string;
  coins: number;
  amountCents: number; // e.g. 500 = RM5.00
}

export const COIN_PACKAGES: CoinPackage[] = [
  { id: "starter", label: "Starter", coins: 500, amountCents: 500 },
  { id: "value", label: "Value (+10% bonus)", coins: 1100, amountCents: 1000 },
  { id: "pro", label: "Pro (+20% bonus)", coins: 2400, amountCents: 2000 },
];

export function findPackage(id: string): CoinPackage | undefined {
  return COIN_PACKAGES.find((p) => p.id === id);
}

/** Free coins granted once per account via the one-time free demo. */
export const FREE_DEMO_COINS = 100;

/** Ensure a wallet row exists for a user; returns the wallet. */
export async function ensureWallet(userId: string) {
  return prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 0 },
  });
}

/**
 * Apply a signed coin delta to a wallet inside a DB transaction and append a
 * ledger entry. Throws if the balance would go negative (insufficient coins).
 * Runs SERIALIZABLE to prevent double-spend under concurrency.
 */
export async function applyCoinDelta(params: {
  userId: string;
  delta: number;
  type: TransactionType;
  reference?: string;
  note?: string;
}) {
  const { userId, delta, type, reference, note } = params;
  return prisma.$transaction(
    async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId, balance: 0 },
      });
      const newBalance = wallet.balance + delta;
      if (newBalance < 0) {
        throw new InsufficientCoinsError(wallet.balance, -delta);
      }
      const updated = await tx.wallet.update({
        where: { userId },
        data: { balance: newBalance },
      });
      await tx.transaction.create({
        data: { userId, type, amount: delta, balance: newBalance, reference, note },
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export class InsufficientCoinsError extends Error {
  constructor(public balance: number, public required: number) {
    super(`Insufficient coins: have ${balance}, need ${required}`);
    this.name = "InsufficientCoinsError";
  }
}
