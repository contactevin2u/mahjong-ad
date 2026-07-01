import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../auth/jwt.js";
import { ensureWallet } from "../coins.js";
import { env } from "../env.js";
import { requireAuth, AuthedRequest } from "../middleware/auth.js";

export const authRouter = Router();

const REFRESH_COOKIE = "mj_refresh";
const refreshCookieOptions = {
  httpOnly: true as const,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/auth",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(32),
  password: z.string().min(8).max(128),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  }
  const { email, displayName, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const user = await prisma.user.create({
    data: { email, displayName, passwordHash: await hashPassword(password) },
  });
  await ensureWallet(user.id);

  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  res.cookie(REFRESH_COOKIE, signRefreshToken(user.id), refreshCookieOptions);
  res.status(201).json({
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      freeDemoUsed: user.freeDemoUsed,
    },
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid credentials" });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  await ensureWallet(user.id);

  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  res.cookie(REFRESH_COOKIE, signRefreshToken(user.id), refreshCookieOptions);
  res.json({
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      freeDemoUsed: user.freeDemoUsed,
    },
  });
});

authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return res.status(401).json({ error: "No refresh token" });
  try {
    const { sub } = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user) return res.status(401).json({ error: "User not found" });
    const accessToken = signAccessToken({ sub: user.id, email: user.email });
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      createdAt: true,
      freeDemoUsed: true,
    },
  });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ user });
});
