"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

export function Header() {
  const { user, logout } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setBalance(null);
      return;
    }
    api<{ balance: number }>("/wallet")
      .then((r) => setBalance(r.balance))
      .catch(() => setBalance(null));
  }, [user]);

  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-felt px-4 py-3">
      <Link href="/" className="text-xl font-bold tracking-wide">
        🀄 Mahjong SG
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        {user ? (
          <>
            <span className="rounded-full bg-black/30 px-3 py-1">
              💰 {balance ?? "…"} coins
            </span>
            <Link href="/shop" className="hover:text-gold">
              Top up
            </Link>
            <span className="text-white/70">{user.displayName}</span>
            <button onClick={logout} className="hover:text-gold">
              Log out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="hover:text-gold">
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded bg-gold px-3 py-1 font-semibold text-felt-dark"
            >
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
