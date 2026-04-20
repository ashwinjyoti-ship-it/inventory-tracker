-- Sound Inventory Tracker Database Schema
-- Cloudflare D1 (SQLite)

-- Venues/Locations
CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Equipment Types (from Excel)
CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Individual Items (each piece of equipment)
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL,
  item_number TEXT NOT NULL,
  home_venue_id INTEGER NOT NULL,
  current_venue_id INTEGER NOT NULL,
  status TEXT DEFAULT 'available',
  condition TEXT DEFAULT 'good',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(equipment_id) REFERENCES equipment(id),
  FOREIGN KEY(home_venue_id) REFERENCES venues(id),
  FOREIGN KEY(current_venue_id) REFERENCES venues(id),
  UNIQUE(equipment_id, item_number)
);

-- Crew Members
CREATE TABLE IF NOT EXISTS crew_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'crew',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Movement History (all checkouts and returns)
-- returned_to_base_at: set when the item completes a trip back to its home venue.
-- Records with this field set are deleted after 30 days by the daily cleanup cron.
CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  crew_member_id INTEGER NOT NULL,
  from_venue_id INTEGER NOT NULL,
  to_venue_id INTEGER NOT NULL,
  movement_type TEXT NOT NULL,
  logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  returned_to_base_at DATETIME DEFAULT NULL,
  FOREIGN KEY(item_id) REFERENCES items(id),
  FOREIGN KEY(crew_member_id) REFERENCES crew_members(id),
  FOREIGN KEY(from_venue_id) REFERENCES venues(id),
  FOREIGN KEY(to_venue_id) REFERENCES venues(id)
);

-- Application Configuration
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_items_equipment_id ON items(equipment_id);
CREATE INDEX IF NOT EXISTS idx_items_current_venue_id ON items(current_venue_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_movements_item_id ON movements(item_id);
CREATE INDEX IF NOT EXISTS idx_movements_crew_member_id ON movements(crew_member_id);
CREATE INDEX IF NOT EXISTS idx_movements_logged_at ON movements(logged_at);
CREATE INDEX IF NOT EXISTS idx_movements_movement_type ON movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_returned_to_base_at ON movements(returned_to_base_at);
CREATE INDEX IF NOT EXISTS idx_crew_members_is_active ON crew_members(is_active);
CREATE INDEX IF NOT EXISTS idx_items_is_active ON items(is_active);

-- Initial Configuration
INSERT OR IGNORE INTO config (key, value, description) VALUES
  ('unreturned_alert_days', '5', 'Days before unreturned item alert'),
  ('admin_password', 'ls1234', 'Admin panel password — change via admin panel'),
  ('notification_type', 'app-wide', 'Type of unreturned alerts: app-wide, email, or both'),
  ('history_retention_days', '30', 'Days to retain movement history after item returned to base');
