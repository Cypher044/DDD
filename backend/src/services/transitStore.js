import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { query } from "../db/client.js";

function mapBusRow(row) {
  return {
    id: row.id,
    label: row.label,
    lineId: row.line_id,
    status: row.status,
    driverId: row.driver_id,
    position:
      row.last_lat === null || row.last_lng === null
        ? null
        : {
            busId: row.id,
            lineId: row.line_id,
            lat: Number(row.last_lat),
            lng: Number(row.last_lng),
            speed: Number(row.last_speed ?? 0),
            heading: Number(row.last_heading ?? 0),
            recordedAt: row.last_recorded_at?.toISOString() || null
          }
  };
}

export async function listLines() {
  const result = await query(
    `SELECT id, code, name, color
     FROM lines
     ORDER BY code`
  );

  return result.rows;
}

export async function listBuses() {
  const result = await query(
    `SELECT id, label, line_id, status, driver_id, last_lat, last_lng,
            last_speed, last_heading, last_recorded_at
     FROM buses
     ORDER BY updated_at DESC, id ASC`
  );

  return result.rows.map(mapBusRow);
}

export async function listDriverBuses(driverId) {
  const result = await query(
    `SELECT id, label, line_id, status, driver_id, last_lat, last_lng,
            last_speed, last_heading, last_recorded_at
     FROM buses
     WHERE driver_id = $1
     ORDER BY updated_at DESC, id ASC`,
    [driverId]
  );

  return result.rows.map(mapBusRow);
}

export async function getDashboardSummary() {
  const [linesResult, busesResult, activeBusesResult, offlineResult, historyResult] =
    await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM lines"),
      query("SELECT COUNT(*)::int AS count FROM buses"),
      query("SELECT COUNT(*)::int AS count FROM buses WHERE status = 'active'"),
      query("SELECT COUNT(*)::int AS count FROM offline_positions"),
      query("SELECT COUNT(*)::int AS count FROM bus_position_history")
    ]);

  return {
    totalLines: linesResult.rows[0].count,
    totalBuses: busesResult.rows[0].count,
    activeBuses: activeBusesResult.rows[0].count,
    pendingOfflineBuffers: offlineResult.rows[0].count,
    totalPositionSamples: historyResult.rows[0].count
  };
}

export async function authenticate({ phone, password, role }) {
  const result = await query(
    `SELECT id, full_name, role, phone, password
     FROM users
     WHERE phone = $1
       AND ($2::text IS NULL OR role = $2::text)
     LIMIT 1`,
    [phone, role || null]
  );

  const user = result.rows[0];

  if (!user) {
    return null;
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return null;
  }

  const token = jwt.sign(
    {
      sub: user.id,
      role: user.role,
      phone: user.phone,
      fullName: user.full_name
    },
    env.jwtSecret,
    { expiresIn: "7d" }
  );

  return {
    id: user.id,
    fullName: user.full_name,
    role: user.role,
    phone: user.phone,
    token
  };
}

export async function updateBusPosition(payload) {
  const nextPosition = {
    busId: payload.busId,
    lineId: payload.lineId,
    lat: Number(payload.lat),
    lng: Number(payload.lng),
    speed: Number(payload.speed ?? 0),
    heading: Number(payload.heading ?? 0),
    recordedAt: payload.recordedAt || new Date().toISOString()
  };

  await query(
    `INSERT INTO buses (
        id, label, line_id, status, driver_id, last_lat, last_lng,
        last_speed, last_heading, last_recorded_at, updated_at
      )
      VALUES (
        $1, $2, $3, 'active', $4, $5, $6, $7, $8, $9::timestamptz, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        line_id = COALESCE(EXCLUDED.line_id, buses.line_id),
        driver_id = COALESCE(EXCLUDED.driver_id, buses.driver_id),
        status = 'active',
        last_lat = EXCLUDED.last_lat,
        last_lng = EXCLUDED.last_lng,
        last_speed = EXCLUDED.last_speed,
        last_heading = EXCLUDED.last_heading,
        last_recorded_at = EXCLUDED.last_recorded_at,
        updated_at = NOW()`,
    [
      nextPosition.busId,
      payload.label || payload.busId.toUpperCase(),
      nextPosition.lineId,
      payload.driverId || null,
      nextPosition.lat,
      nextPosition.lng,
      nextPosition.speed,
      nextPosition.heading,
      nextPosition.recordedAt
    ]
  );

  await query(
    `INSERT INTO bus_position_history (
        bus_id, line_id, lat, lng, speed, heading, recorded_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)`,
    [
      nextPosition.busId,
      nextPosition.lineId,
      nextPosition.lat,
      nextPosition.lng,
      nextPosition.speed,
      nextPosition.heading,
      nextPosition.recordedAt
    ]
  );

  return nextPosition;
}

export async function queueOfflinePosition(busId, payload) {
  await query(
    `INSERT INTO buses (id, label, line_id, status, driver_id, updated_at)
     VALUES ($1, $2, $3, 'active', $4, NOW())
     ON CONFLICT (id) DO UPDATE SET
       line_id = COALESCE(EXCLUDED.line_id, buses.line_id),
       driver_id = COALESCE(EXCLUDED.driver_id, buses.driver_id),
       updated_at = NOW()`,
    [
      busId,
      payload.label || busId.toUpperCase(),
      payload.lineId || null,
      payload.driverId || null
    ]
  );

  const result = await query(
    `INSERT INTO offline_positions (
        bus_id, line_id, lat, lng, speed, heading, recorded_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)
      RETURNING id`,
    [
      busId,
      payload.lineId || null,
      Number(payload.lat),
      Number(payload.lng),
      Number(payload.speed ?? 0),
      Number(payload.heading ?? 0),
      payload.recordedAt || new Date().toISOString()
    ]
  );

  return {
    busId,
    queued: result.rowCount
  };
}

export async function flushOfflinePositions(busId) {
  const pendingResult = await query(
    `SELECT bus_id, line_id, lat, lng, speed, heading, recorded_at
     FROM offline_positions
     WHERE bus_id = $1
     ORDER BY recorded_at ASC`,
    [busId]
  );

  for (const row of pendingResult.rows) {
    await updateBusPosition({
      busId: row.bus_id,
      lineId: row.line_id,
      lat: row.lat,
      lng: row.lng,
      speed: row.speed,
      heading: row.heading,
      recordedAt: row.recorded_at.toISOString()
    });
  }

  await query("DELETE FROM offline_positions WHERE bus_id = $1", [busId]);

  return {
    busId,
    flushed: pendingResult.rowCount
  };
}

export async function listAdminUsers() {
  const result = await query(
    `SELECT id, full_name, role, phone
     FROM users
     ORDER BY role ASC, full_name ASC, id ASC`
  );

  return result.rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    phone: row.phone
  }));
}

export async function createLine(payload) {
  const id = payload.id?.trim() || `line-${crypto.randomUUID().slice(0, 8)}`;
  const code = payload.code?.trim();
  const name = payload.name?.trim();
  const color = payload.color?.trim() || "#0b6e4f";

  if (!code || !name) {
    throw new Error("code et name sont requis pour une ligne.");
  }

  try {
    const result = await query(
      `INSERT INTO lines (id, code, name, color)
       VALUES ($1, $2, $3, $4)
       RETURNING id, code, name, color`,
      [id, code, name, color]
    );

    return result.rows[0];
  } catch (error) {
    if (error?.code === "23505") {
      throw new Error("Cette ligne existe deja: id ou code deja utilise.");
    }

    throw error;
  }
}

export async function createBus(payload) {
  const id = payload.id?.trim();
  const label = payload.label?.trim();
  const lineId = payload.lineId?.trim() || null;
  const driverId = payload.driverId?.trim() || null;
  const status = payload.status?.trim() || "active";

  if (!id || !label) {
    throw new Error("id et label sont requis pour un bus.");
  }

  let result;
  try {
    result = await query(
      `INSERT INTO buses (id, label, line_id, status, driver_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, label, line_id, status, driver_id`,
      [id, label, lineId, status, driverId]
    );
  } catch (error) {
    if (error?.code === "23505") {
      throw new Error("Ce bus existe deja.");
    }

    if (error?.code === "23503") {
      throw new Error("La ligne ou le chauffeur associe n'existe pas.");
    }

    throw error;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    label: row.label,
    lineId: row.line_id,
    status: row.status,
    driverId: row.driver_id,
    position: null
  };
}

export async function createUser(payload) {
  const id = payload.id?.trim() || `${payload.role}-${crypto.randomUUID().slice(0, 8)}`;
  const fullName = payload.fullName?.trim();
  const role = payload.role?.trim();
  const phone = payload.phone?.trim();
  const password = payload.password?.trim();

  if (!fullName || !role || !phone || !password) {
    throw new Error("fullName, role, phone et password sont requis.");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  let result;
  try {
    result = await query(
      `INSERT INTO users (id, full_name, role, phone, password)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, role, phone`,
      [id, fullName, role, phone, hashedPassword]
    );
  } catch (error) {
    if (error?.code === "23505") {
      throw new Error("Ce chauffeur existe deja: id ou telephone deja utilise.");
    }

    throw error;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    phone: row.phone
  };
}
