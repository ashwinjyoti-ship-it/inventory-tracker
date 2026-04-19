-- NCPA Sound Inventory Tracker — D1 schema
-- Idempotent: safe to re-run.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  is_outdoor INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crew (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member',     -- 'member' | 'head'
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS equipment_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id INTEGER NOT NULL REFERENCES equipment_models(id) ON DELETE CASCADE,
  serial_no INTEGER NOT NULL,
  label TEXT NOT NULL,
  home_venue_id INTEGER NOT NULL REFERENCES venues(id),
  current_venue_id INTEGER REFERENCES venues(id),
  current_crew_id INTEGER REFERENCES crew(id),
  destination_venue_id INTEGER REFERENCES venues(id),
  last_movement_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(model_id, serial_no)
);

CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),
  action TEXT NOT NULL,                                -- 'checkout' | 'return'
  from_venue_id INTEGER REFERENCES venues(id),
  to_venue_id INTEGER REFERENCES venues(id),
  crew_id INTEGER NOT NULL REFERENCES crew(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_current_venue ON items(current_venue_id);
CREATE INDEX IF NOT EXISTS idx_items_current_crew ON items(current_crew_id);
CREATE INDEX IF NOT EXISTS idx_items_model ON items(model_id);
CREATE INDEX IF NOT EXISTS idx_movements_item ON movements(item_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_crew ON movements(crew_id);

-- Key/value settings (e.g. admin_password_hash, token_signing_key)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
