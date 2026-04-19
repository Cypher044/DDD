import cors from "cors";
import express from "express";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import { createTransitRouter } from "./routes/transitRoutes.js";

export function createApp(io, corsOrigin) {
  const app = express();

  app.use(
    cors({
      origin: corsOrigin,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      optionsSuccessStatus: 204
    })
  );
  app.use(express.json());

  app.use("/health", healthRoutes);
  app.use("/auth", authRoutes);
  app.use("/api", createTransitRouter(app));
  app.use("/admin", adminRoutes);

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({
      message: error?.message || "Erreur interne du serveur."
    });
  });

  return app;
}
