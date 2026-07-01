// Socket.IO wiring. Phase 0: authenticated connection + lobby presence + ping.
// Phase 3 will add table/room management and authoritative gameplay events.
import type { Server, Socket } from "socket.io";
import { verifyAccessToken } from "./auth/jwt.js";

interface AuthedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

export function registerSockets(io: Server) {
  // Authenticate every socket from the handshake auth token.
  io.use((socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = verifyAccessToken(token);
      socket.userId = payload.sub;
      socket.userEmail = payload.email;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket: AuthedSocket) => {
    socket.join("lobby");
    socket.emit("lobby:welcome", { userId: socket.userId });

    socket.on("lobby:ping", (_data, ack?: (r: unknown) => void) => {
      ack?.({ pong: true, at: Date.now() });
    });

    socket.on("disconnect", () => {
      // Phase 3: release any seat this user held.
    });
  });
}
