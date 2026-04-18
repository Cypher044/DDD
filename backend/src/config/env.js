import dotenv from "dotenv";
dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),

  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  clientUrlExtra: process.env.CLIENT_URL_EXTRA || "",

  jwtSecret: process.env.JWT_SECRET || "change-me",

  gpsBroadcastIntervalMs: Number(
    process.env.GPS_BROADCAST_INTERVAL_MS || 5000
  ),

  databaseUrl: process.env.DATABASE_URL,

  databaseSsl: process.env.DATABASE_SSL === "true"
};

export function allowedClientOrigins() {
  const primary = env.clientUrl;
  const set = new Set([primary]);

  try {
    const u = new URL(primary);
    const port = u.port || (u.protocol === "https:" ? "443" : "80");

    if (u.hostname === "localhost") {
      set.add(`${u.protocol}//127.0.0.1:${port}`);
    } else if (u.hostname === "127.0.0.1") {
      set.add(`${u.protocol}//localhost:${port}`);
    }
  } catch {}

  for (const origin of env.clientUrlExtra
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    set.add(origin);
  }

  return [...set];
}