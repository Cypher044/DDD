CREATE TABLE IF NOT EXISTS lines (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('driver', 'admin')),
  phone TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS buses (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  line_id TEXT REFERENCES lines(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  driver_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  last_lat DOUBLE PRECISION,
  last_lng DOUBLE PRECISION,
  last_speed DOUBLE PRECISION DEFAULT 0,
  last_heading DOUBLE PRECISION DEFAULT 0,
  last_recorded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '';
ALTER TABLE buses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE buses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS offline_positions (
  id BIGSERIAL PRIMARY KEY,
  bus_id TEXT NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  line_id TEXT REFERENCES lines(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION NOT NULL DEFAULT 0,
  heading DOUBLE PRECISION NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO lines (id, code, name, color)
VALUES
  ('line-1', 'L1', 'Petersen - Guediawaye', '#0b6e4f'),
  ('line-2', 'L2', 'Keur Massar - Plateau', '#ff7b00'),
  ('line-3', 'L3', 'Parcelles - Sandaga', '#1d4ed8')
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  color = EXCLUDED.color;

-- Journal append-only de chaque position (tests temps reel, audit, replay SQL)
CREATE TABLE IF NOT EXISTS bus_position_history (
  id BIGSERIAL PRIMARY KEY,
  bus_id TEXT NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  line_id TEXT REFERENCES lines(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION NOT NULL DEFAULT 0,
  heading DOUBLE PRECISION NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bus_position_history_bus_recorded
  ON bus_position_history (bus_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_bus_position_history_recorded
  ON bus_position_history (recorded_at DESC);
