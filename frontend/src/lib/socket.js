import { io } from "socket.io-client";
import { API_URL } from "./api";

export const socket = io(API_URL, {
  autoConnect: true,
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

