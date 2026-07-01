// Socket.IO client factory. Used by the lobby now and the game table later.
"use client";
import { io, Socket } from "socket.io-client";
import { API_URL, getToken } from "./api";

let socket: Socket | null = null;

/** Get (or lazily create) the authenticated socket connection. */
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(API_URL, {
    autoConnect: true,
    auth: { token: getToken() },
    transports: ["websocket"],
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
