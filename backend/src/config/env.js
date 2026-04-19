import dotenv from "dotenv";
dotenv.config();

/** L’en-tête `Origin` du navigateur n’a jamais de slash final ; normaliser évite les refus CORS silencieux. */
export function normalizeOrigin(url) {
  if (!url || typeof url !== "string") {
    return "";
  }
  return url.trim().replace(/\/+$/, "");
}

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
  const set = new Set();

  const add = (value) => {
    const n = normalizeOrigin(value);
    if (n) {
      set.add(n);
    }
  };

  add(env.clientUrl);

  try {
    const primary = normalizeOrigin(env.clientUrl);
    const u = new URL(primary);
    const port = u.port || (u.protocol === "https:" ? "443" : "80");

    if (u.hostname === "localhost") {
      add(`${u.protocol}//127.0.0.1:${port}`);
    } else if (u.hostname === "127.0.0.1") {
      add(`${u.protocol}//localhost:${port}`);
    }
  } catch {
    // clientUrl invalide : ignoré pour les variantes localhost
  }

  for (const origin of env.clientUrlExtra
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    add(origin);
  }

  return [...set];
}

/** Callback `cors` : reflète l’origine si elle est dans la liste (requis pour preflight + JWT). */
export function createCorsOriginCallback() {
  const allowed = new Set(allowedClientOrigins());

  return function corsOrigin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowed.has(normalizeOrigin(origin))) {
      callback(null, true);
      return;
    }
    console.warn("[cors] origine refusée:", origin, "| autorisees:", [...allowed]);
    callback(new Error("Not allowed by CORS"));
  };
}