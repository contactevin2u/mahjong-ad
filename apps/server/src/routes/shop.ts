import { Router, raw } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { env, isBillplzConfigured } from "../env.js";
import { requireAuth, AuthedRequest } from "../middleware/auth.js";
import { COIN_PACKAGES, findPackage, applyCoinDelta } from "../coins.js";
import {
  createBill,
  verifyCallbackSignature,
  verifyRedirectSignature,
} from "../payments/billplz.js";

export const shopRouter = Router();

/** Public: list purchasable coin packages (prices are server-authoritative). */
shopRouter.get("/packages", (_req, res) => {
  res.json({ packages: COIN_PACKAGES, currency: "MYR" });
});

const checkoutSchema = z.object({ packageId: z.string() });

/**
 * Authenticated: start a top-up. Creates a PENDING PaymentOrder and a Billplz
 * bill, returning the hosted payment URL for the client to redirect to.
 */
shopRouter.post("/checkout", requireAuth, async (req: AuthedRequest, res) => {
  if (!isBillplzConfigured) {
    return res.status(503).json({ error: "Payments are not configured on the server" });
  }
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid packageId" });

  const pkg = findPackage(parsed.data.packageId);
  if (!pkg) return res.status(404).json({ error: "Unknown package" });

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const order = await prisma.paymentOrder.create({
    data: {
      userId: user.id,
      packageId: pkg.id,
      coins: pkg.coins,
      amountCents: pkg.amountCents,
      status: "PENDING",
    },
  });

  try {
    const bill = await createBill({
      amountCents: pkg.amountCents,
      name: user.displayName,
      email: user.email,
      description: `${pkg.coins} coins (${pkg.label})`,
      callbackUrl: `${env.SERVER_PUBLIC_URL}/shop/billplz/callback`,
      redirectUrl: `${env.CLIENT_ORIGIN}/shop/return`,
      reference1: order.id,
    });

    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { billId: bill.id },
    });

    res.json({ paymentUrl: bill.url, orderId: order.id });
  } catch (err) {
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: "FAILED" },
    });
    console.error("createBill error:", err);
    res.status(502).json({ error: "Could not create payment" });
  }
});

/**
 * Public: Billplz server-to-server CALLBACK. THIS is where coins are credited.
 * Uses express.raw so we verify the exact posted form. Credits are idempotent:
 * once an order is PAID we never credit again.
 */
shopRouter.post(
  "/billplz/callback",
  // Parse ANY content-type as a raw buffer so we see exactly what Billplz posts.
  raw({ type: () => true }),
  async (req, res) => {
    let params: Record<string, string> = {};
    if (Buffer.isBuffer(req.body)) {
      params = Object.fromEntries(
        new URLSearchParams(req.body.toString("utf8"))
      ) as Record<string, string>;
    } else if (req.body && typeof req.body === "object") {
      params = req.body as Record<string, string>;
    }

    const sigOk = verifyCallbackSignature(params);
    console.log(
      "[billplz callback] keys:",
      Object.keys(params).join(","),
      "| id:",
      params.id,
      "| paid:",
      params.paid,
      "| signature valid:",
      sigOk
    );

    if (!sigOk) {
      console.warn("[billplz callback] bad signature for bill", params.id);
      return res.status(400).send("bad signature");
    }

    const billId = params.id;
    const paid = params.paid === "true";
    if (!billId) return res.status(400).send("missing id");

    // Always ack quickly; do the work idempotently.
    if (!paid) return res.status(200).send("ok"); // unpaid/expired notifications

    try {
      await creditOrderForBill(billId);
    } catch (err) {
      console.error("credit error:", err);
      // 500 makes Billplz retry the callback later — safe because we're idempotent.
      return res.status(500).send("retry");
    }
    res.status(200).send("ok");
  }
);

/**
 * Credit the coins for a paid bill exactly once. The PAID status flip inside the
 * transaction is the idempotency guard.
 */
async function creditOrderForBill(billId: string) {
  const order = await prisma.paymentOrder.findUnique({ where: { billId } });
  if (!order) {
    console.warn(`[billplz callback] no order found for bill ${billId}`);
    return;
  }
  if (order.status === "PAID") {
    console.log(`[billplz callback] bill ${billId} already credited`);
    return;
  }

  // Flip to PAID atomically; only the first flip proceeds to credit.
  const flipped = await prisma.paymentOrder.updateMany({
    where: { id: order.id, status: "PENDING" },
    data: { status: "PAID", paidAt: new Date() },
  });
  if (flipped.count === 0) return; // someone else credited concurrently

  const wallet = await applyCoinDelta({
    userId: order.userId,
    delta: order.coins,
    type: "TOPUP",
    reference: billId,
    note: `Top-up ${order.packageId}`,
  });
  console.log(
    `[billplz callback] credited ${order.coins} coins to user ${order.userId}; new balance ${wallet.balance}`
  );
}

/**
 * Public: verify a browser redirect (used by the /shop/return page to show a
 * result). Does NOT credit — crediting only happens via the callback above.
 */
shopRouter.get("/billplz/verify-return", (req, res) => {
  const query = req.query as Record<string, any>;
  // Express parses billplz[...] into a nested object.
  const billplz = (query?.billplz ?? {}) as Record<string, string>;
  const ok = verifyRedirectSignature(query);
  res.json({
    valid: ok,
    paid: ok && billplz.paid === "true",
    billId: billplz.id ?? null,
  });
});
