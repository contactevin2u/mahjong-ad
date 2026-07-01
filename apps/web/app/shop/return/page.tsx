"use client";
// Billplz redirects the browser back here after payment. We verify the redirect
// signature (display only) and poll the wallet — the ACTUAL coin credit happens
// server-side via the Billplz callback, so we just wait for the balance to update.
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { API_URL, api } from "../../../lib/api";

function ReturnInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState<"checking" | "paid" | "pending" | "invalid">(
    "checking"
  );
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const qs = params.toString();
    // Ask the server to validate the redirect signature (informational).
    fetch(`${API_URL}/shop/billplz/verify-return?${qs}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((r) => {
        if (!r.valid) return setStatus("invalid");
        setStatus(r.paid ? "paid" : "pending");
      })
      .catch(() => setStatus("invalid"));
  }, [params]);

  useEffect(() => {
    if (status !== "paid") return;
    // Poll the wallet a few times while the callback credits the coins.
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      try {
        const { balance } = await api<{ balance: number }>("/wallet");
        setBalance(balance);
      } catch {
        /* ignore */
      }
      if (tries >= 5) clearInterval(t);
    }, 1500);
    return () => clearInterval(t);
  }, [status]);

  return (
    <div className="mx-auto max-w-md text-center">
      {status === "checking" && <p>Checking your payment…</p>}
      {status === "invalid" && (
        <p className="text-red-300">
          We couldn&apos;t verify this payment result.
        </p>
      )}
      {status === "pending" && (
        <p className="text-yellow-200">
          Payment not completed. If you paid, your balance will update shortly.
        </p>
      )}
      {status === "paid" && (
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">✅ Payment received</h1>
          <p className="text-white/70">
            Coins are being added to your wallet…
            {balance !== null && (
              <>
                {" "}
                Balance: <strong>{balance}</strong> coins.
              </>
            )}
          </p>
        </div>
      )}
      <Link href="/" className="mt-6 inline-block text-gold">
        ← Back to lobby
      </Link>
    </div>
  );
}

export default function ShopReturnPage() {
  return (
    <Suspense fallback={<p className="text-center">Loading…</p>}>
      <ReturnInner />
    </Suspense>
  );
}
