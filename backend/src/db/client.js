import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function poolOptions() {
  const base = { connectionString: env.databaseUrl };
  if (env.databaseSsl) {
    return {
      ...base,
      ssl: { rejectUnauthorized: false }
    };
  }
  return base;
}

export const pool = new Pool(poolOptions());

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function initializeDatabase() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = await fs.readFile(schemaPath, "utf8");
  await pool.query(schema);
  await seedDefaults();
  await seedRealtimeTestFixtures();
}

async function seedDefaults() {
  const passwordSeeds = [
    {
      id: "driver-001",
      fullName: "Chauffeur Demo",
      role: "driver",
      phone: "+221700000001",
      password: "demo-driver"
    },
    {
      id: "admin-001",
      fullName: "Admin Demo",
      role: "admin",
      phone: "+221700000999",
      password: "demo-admin"
    },
    {
      id: "driver-002",
      fullName: "Chauffeur Demo 2",
      role: "driver",
      phone: "+221700000002",
      password: "demo-driver-2"
    }
  ];

  for (const user of passwordSeeds) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await query(
      `INSERT INTO users (id, full_name, role, phone, password)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         phone = EXCLUDED.phone,
         password = EXCLUDED.password`,
      [user.id, user.fullName, user.role, user.phone, hashedPassword]
    );
  }
}

/** Bus et positions initiales Dakar pour tester la carte / le flux sans attendre le premier GPS. */
async function seedRealtimeTestFixtures() {
  const buses = [
    {
      id: "bus-seed-l1",
      label: "Bus test L1",
      lineId: "line-1",
      driverId: "driver-001",
      lastLat: 14.7167,
      lastLng: -17.4677
    },
    {
      id: "bus-seed-l2",
      label: "Bus test L2",
      lineId: "line-2",
      driverId: "driver-002",
      lastLat: 14.692,
      lastLng: -17.446
    }
  ];

  for (const b of buses) {
    await query(
      `INSERT INTO buses (
          id, label, line_id, status, driver_id,
          last_lat, last_lng, last_speed, last_heading, last_recorded_at, updated_at
        )
        VALUES ($1, $2, $3, 'active', $4, $5, $6, 0, 0, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          label = EXCLUDED.label,
          line_id = EXCLUDED.line_id,
          driver_id = EXCLUDED.driver_id,
          last_lat = EXCLUDED.last_lat,
          last_lng = EXCLUDED.last_lng,
          last_recorded_at = NOW(),
          updated_at = NOW()`,
      [b.id, b.label, b.lineId, b.driverId, b.lastLat, b.lastLng]
    );
  }
}

export async function closeDatabase() {
  await pool.end();
}
