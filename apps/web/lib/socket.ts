// Socket.IO client factory. Used by the lobby now and the game table later.
"use client";
import { io, Socket } from "socket.io-client";
import { API_URL, getToken } from "./api";

let socket: Socket | null = null;

/** Get (or lazily create) the authenticated socket connection. */
export function getSocket(): Socket {
  if (socket) {
    // Keep the auth token fresh in case it changed since creation.
    socket.auth = { token: getToken() };
    return socket;
  }
  socket = io(API_URL, {
    autoConnect: true,
    // No withCredentials: the socket authenticates via the handshake token,
    // not cookies. Credentialed CORS on the polling XHR can fail in-browser.
    auth: { token: getToken() },
    // Start with polling and upgrade to WebSocket. This is the most compatible
    // path across proxies/hosts (WebSocket-only can fail to establish).
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    // Free-tier servers sleep and can take ~50s to wake; give the first
    // connection room to survive a cold start instead of erroring out.
    timeout: 60000,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
