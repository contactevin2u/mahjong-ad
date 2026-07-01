"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";

interface CoinPackage {
  id: string;
  label: string;
  coins: number;
  amountCents: number;
}

export default function ShopPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    api<{ packages: CoinPackage[] }>("/shop/packages")
      .then((r) => setPackages(r.packages))
      .catch(() => setError("Could not load packages"));
  }, []);

  async function buy(pkgId: string) {
    setBusyId(pkgId);
    setError(null);
    try {
      const { paymentUrl } = await api<{ paymentUrl: string }>("/shop/checkout", {
        method: "POST",
        body: JSON.stringify({ packageId: pkgId }),
      });
      // Redirect to Billplz hosted payment page.
      window.location.href = paymentUrl;
    } catch (err: any) {
      setError(err?.message ?? "Checkout failed");
      setBusyId(null);
    }
  }

  const rm = (cents: number) => `RM${(cents / 100).toFixed(2)}`;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Top up coins</h1>
      <p className="mb-6 text-sm text-white/60">
        Pay securely via Billplz (FPX online banking, cards, e-wallets).
      </p>

      {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        {packages.map((p) => (
          <div
            key={p.id}
            className="flex flex-col rounded-xl border border-white/10 bg-felt p-5"
          >
            <div className="text-lg font-semibold">{p.label}</div>
            <div className="mt-2 text-3xl font-bold text-gold">{p.coins}</div>
            <div className="text-sm text-white/60">coins</div>
            <button
              onClick={() => buy(p.id)}
              disabled={busyId !== null}
              className="mt-4 rounded bg-gold py-2 font-semibold text-felt-dark disabled:opacity-60"
            >
              {busyId === p.id ? "Redirecting…" : `Pay ${rm(p.amountCents)}`}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-4 text-xs text-yellow-100">
        ⚠️ Coins are virtual credits used only inside the game. They have{" "}
        <strong>no cash value</strong> and <strong>cannot be withdrawn</strong> or
        exchanged for money. Purchases are final. This is not gambling and there is
        no cash-out.
      </div>
    </div>
  );
}
