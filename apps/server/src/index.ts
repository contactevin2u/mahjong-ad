// Server entrypoint: Express REST + Socket.IO on one HTTP server.
import http from "node:http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server as IOServer } from "socket.io";

import { env } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { walletRouter } from "./routes/wallet.js";
import { shopRouter } from "./routes/shop.js";
import { playRouter } from "./routes/play.js";
import { registerSockets } from "./sockets.js";

const app = express();

app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(cookieParser());

// Global JSON parsing. This only acts on `application/json` bodies, so the
// Billplz callback (which posts `application/x-www-form-urlencoded`) is left
// untouched and its route-level express.raw() reads the intact raw body — which
// is required to verify the X-Signature over the exact submitted form.
app.use(express.json());

app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "mahjong-server", build: "billplz-sig-fix-2" })
);

app.use("/auth", authRouter);
app.use("/wallet", walletRouter);
app.use("/shop", shopRouter);
app.use("/play", playRouter);

const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: env.CLIENT_ORIGIN, credentials: true },
});
registerSockets(io);

server.listen(env.PORT, () => {
  console.log(`🀄 mahjong-server listening on :${env.PORT} (${env.NODE_ENV})`);
  console.log(`   CORS origin: ${env.CLIENT_ORIGIN}`);
});
