// Billplz (Malaysia) integration: create hosted bills and verify the X-Signature
// on callbacks/redirects. Coins are credited ONLY after a verified callback.
// Docs: https://www.billplz.com/api
import crypto from "node:crypto";
import { env } from "../env.js";

export interface CreateBillParams {
  amountCents: number; // MYR in sen
  name: string;
  email: string;
  description: string;
  callbackUrl: string; // server-to-server, verified
  redirectUrl: string; // browser return
  reference1?: string; // we stash our PaymentOrder id here
}

export interface BillplzBill {
  id: string;
  url: string;
  paid: boolean;
  state: string;
}

function authHeader(): string {
  // Billplz uses HTTP Basic auth: API secret key as username, blank password.
  const token = Buffer.from(`${env.BILLPLZ_API_KEY}:`).toString("base64");
  return `Basic ${token}`;
}

/** Create a hosted bill; returns its id and payment URL. */
export async function createBill(p: CreateBillParams): Promise<BillplzBill> {
  const body = new URLSearchParams({
    collection_id: env.BILLPLZ_COLLECTION_ID,
    email: p.email,
    name: p.name,
    amount: String(p.amountCents),
    callback_url: p.callbackUrl,
    redirect_url: p.redirectUrl,
    description: p.description,
  });
  if (p.reference1) body.set("reference_1", p.reference1);

  const res = await fetch(`${env.BILLPLZ_BASE_URL}/v3/bills`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Billplz createBill failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as any;
  return { id: json.id, url: json.url, paid: json.paid === true, state: json.state };
}

/**
 * Compute the Billplz X-Signature. Per Billplz: build a `keyvalue` string for
 * each pair, SORT THE RESULTING STRINGS ascending, join with `|`, then
 * HMAC-SHA256 with the X-Signature key. (Sorting the concatenated strings — not
 * the keys — matters for prefix keys like paid / paid_amount / paid_at.)
 */
function computeSignature(pairs: Record<string, string>): string {
  const source = Object.keys(pairs)
    .map((k) => `${k}${pairs[k]}`)
    .sort()
    .join("|");
  return crypto
    .createHmac("sha256", env.BILLPLZ_XSIGNATURE_KEY)
    .update(source)
    .digest("hex");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Verify a server-to-server CALLBACK body. Billplz posts flat form keys
 * (id, collection_id, paid, state, amount, ...) plus x_signature.
 */
export function verifyCallbackSignature(body: Record<string, string>): boolean {
  const { x_signature, ...rest } = body;
  if (!x_signature) return false;
  const expected = computeSignature(rest);
  return timingSafeEqualHex(expected, x_signature);
}

/**
 * Verify a browser REDIRECT (return_url) query. Billplz sends keys as
 * `billplz[id]`, `billplz[paid]`, `billplz[paid_at]`, `billplz[x_signature]`.
 * The signature source uses the keys prefixed with `billplz` (e.g. `billplzid`).
 *
 * Express (qs) parses `billplz[id]=..` into a NESTED object
 * `query.billplz = { id, paid, paid_at, x_signature }`, so read that; fall back
 * to flat `billplz[...]` keys just in case.
 */
export function verifyRedirectSignature(query: Record<string, any>): boolean {
  const pairs: Record<string, string> = {};
  let signature = "";

  const nested = query?.billplz;
  if (nested && typeof nested === "object") {
    for (const [inner, value] of Object.entries(nested)) {
      if (inner === "x_signature") signature = String(value);
      else pairs[`billplz${inner}`] = String(value);
    }
  } else {
    for (const [rawKey, value] of Object.entries(query ?? {})) {
      const m = rawKey.match(/^billplz\[(.+)\]$/);
      if (!m) continue;
      const inner = m[1];
      if (inner === "x_signature") signature = String(value);
      else pairs[`billplz${inner}`] = String(value);
    }
  }

  if (!signature) return false;
  const expected = computeSignature(pairs);
  return timingSafeEqualHex(expected, signature);
}
