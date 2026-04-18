import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { allowedClientOrigins, env } from "./config/env.js";
import { initializeDatabase } from "./db/client.js";

const clientOrigins = allowedClientOrigins();
const app = createApp(null, clientOrigins);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: clientOrigins,
    methods: ["GET", "POST"]
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
