import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import {
  allowedClientOrigins,
  createCorsOriginCallback,
  env
} from "./config/env.js";
import { initializeDatabase } from "./db/client.js";

const clientOrigins = allowedClientOrigins();
console.log("[cors] origines autorisees:", clientOrigins.join(", ") || "(aucune)");
const corsOrigin = createCorsOriginCallback();
const app = createApp(null, corsOrigin);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: clientOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});
app.set("io", io);

io.on("connection", (socket) => {
  socket.emit("server:ready", {
    message: "Connexion temps reel etablie."
  });
});

try {
  await initializeDatabase();
} catch (error) {
  console.error("Impossible d'initialiser PostgreSQL.");
  console.error(
    "Verifie DATABASE_URL et assure-toi que PostgreSQL tourne avant de lancer le backend."
  );
  throw error;
}

httpServer.listen(env.port, () => {
  console.log(`Sunu Bus backend running on http://localhost:${env.port}`);
});
