# 🀄 Singaporean Mahjong (multiplayer, virtual-coin top-up)

A real-time, 4-player **Singaporean Mahjong** web game.

- **Frontend:** Next.js (React + TypeScript + Tailwind) → deploy to **Vercel**
- **Backend:** Node.js + Express + Socket.IO (TypeScript) → deploy to **Render**
- **Database:** PostgreSQL via Prisma
- **Payments:** **Billplz** (Malaysia) — top up real money for **virtual coins**

> ⚠️ **Money model:** Coins are **virtual currency only**. Players buy coins with real money to play;
> coins have **no cash value** and **cannot be withdrawn or exchanged for money**. There is **no
> real-money gambling or cash-out**. This keeps the product outside gambling-licensing regimes.

## Repository layout

```
mahjong/
  apps/
    web/          # Next.js frontend  -> Vercel
    server/       # Express + Socket.IO -> Render
  packages/
    game-engine/  # Pure TypeScript Singaporean Mahjong rules (unit-tested, no I/O)
```

## Getting started (local)

```bash
# 1. Install all workspace deps from the repo root
npm install

# 2. Configure env
#    - copy .env.example -> apps/server/.env  and fill in values
#    - copy .env.example -> apps/web/.env.local and set NEXT_PUBLIC_API_URL

# 3. Set up the database (from apps/server)
npm run prisma:generate --workspace apps/server
npm run prisma:migrate  --workspace apps/server

# 4. Run the two apps in separate terminals
npm run dev:server   # http://localhost:4000
npm run dev:web      # http://localhost:3000

# 5. Run engine tests
npm test
```

## Deployment

### Backend → Render
- Create a **Web Service** from this repo, root directory `apps/server`.
- Build command: `npm install && npm run build --workspace apps/server`
- Start command: `npm run start --workspace apps/server`
- Add a **Render PostgreSQL** instance and set `DATABASE_URL`.
- Set all env vars from `.env.example` (server section). Set `CLIENT_ORIGIN` to your Vercel URL.
- A `render.yaml` blueprint is included at `apps/server/render.yaml`.

### Frontend → Vercel
- Import the repo, set **Root Directory** to `apps/web`.
- Set `NEXT_PUBLIC_API_URL` to your Render service URL (e.g. `https://mahjong-server.onrender.com`).
- A `vercel.json` is included at `apps/web/vercel.json`.

## Payment testing (Billplz sandbox)
Use `https://www.billplz-sandbox.com` credentials. Expose your local callback with a tunnel
(e.g. `ngrok http 4000`) and set `CLIENT_ORIGIN` / callback base accordingly. Coins are credited
**only** on the X-Signature-verified server callback, **idempotently** (never on the browser redirect).

## Status
See `.claude/plans/abstract-brewing-pizza.md` for the full phased plan. Currently: **Phase 0 + 1**
(scaffold, accounts, wallet) and **Phase 2** (Billplz top-up).
