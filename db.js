const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'poker.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS chip_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    quantity_owned INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS chip_set_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chip_set_id INTEGER NOT NULL,
    denomination REAL NOT NULL,
    count_per_set INTEGER NOT NULL,
    color TEXT DEFAULT '',
    FOREIGN KEY (chip_set_id) REFERENCES chip_sets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS stack_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stack_config_chips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stack_config_id INTEGER NOT NULL,
    denomination REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    stack_type TEXT NOT NULL DEFAULT 'starting',
    FOREIGN KEY (stack_config_id) REFERENCES stack_configs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS blind_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS blind_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL,
    level_number INTEGER NOT NULL,
    small_blind REAL NOT NULL,
    big_blind REAL NOT NULL,
    ante REAL NOT NULL DEFAULT 0,
    duration_minutes INTEGER NOT NULL DEFAULT 20,
    is_break INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (schedule_id) REFERENCES blind_schedules(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    stack_config_id INTEGER,
    blind_schedule_id INTEGER,
    num_players INTEGER NOT NULL DEFAULT 9,
    rebuy_allowed INTEGER NOT NULL DEFAULT 0,
    rebuy_stack_config_id INTEGER,
    rebuy_max INTEGER NOT NULL DEFAULT 1,
    rebuy_through_level INTEGER NOT NULL DEFAULT 0,
    rebuy_cost REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (stack_config_id) REFERENCES stack_configs(id) ON DELETE SET NULL,
    FOREIGN KEY (blind_schedule_id) REFERENCES blind_schedules(id) ON DELETE SET NULL,
    FOREIGN KEY (rebuy_stack_config_id) REFERENCES stack_configs(id) ON DELETE SET NULL
  );
`);

// Migrations for existing databases
try {
  db.exec(`ALTER TABLE blind_levels ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
} catch(e) {}
try {
  db.exec(`ALTER TABLE stack_config_chips ADD COLUMN stack_type TEXT NOT NULL DEFAULT 'starting'`);
} catch(e) {}
try {
  db.exec(`ALTER TABLE tournaments ADD COLUMN rebuy_allowed INTEGER NOT NULL DEFAULT 0`);
} catch(e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE tournaments ADD COLUMN rebuy_stack_config_id INTEGER`);
} catch(e) {}
try {
  db.exec(`ALTER TABLE tournaments ADD COLUMN rebuy_max INTEGER NOT NULL DEFAULT 1`);
} catch(e) {}
try {
  db.exec(`ALTER TABLE tournaments ADD COLUMN rebuy_through_level INTEGER NOT NULL DEFAULT 0`);
} catch(e) {}
try {
  db.exec(`ALTER TABLE tournaments ADD COLUMN rebuy_cost REAL NOT NULL DEFAULT 0`);
} catch(e) {}
try {
  db.exec(`ALTER TABLE blind_levels ADD COLUMN after_round INTEGER NOT NULL DEFAULT 0`);
} catch(e) {}
try {
  db.exec(`ALTER TABLE blind_schedules ADD COLUMN rebuy_through_level INTEGER NOT NULL DEFAULT 0`);
} catch(e) {}

// Chip color map based on SLOWPLAY sets
const CHIP_COLORS = {
  1: '#e8e8e8',     // White/Light Gray
  5: '#d4a843',     // Yellow/Gold
  25: '#e8a0b4',    // Pink
  100: '#4a7fbf',   // Blue
  500: '#8b5fbf',   // Purple
  1000: '#2a8a7a'   // Teal/Dark Green
};

// Seed chip sets if none exist
const count = db.prepare('SELECT COUNT(*) as cnt FROM chip_sets').get();
if (count.cnt === 0) {
  console.log('Seeding chip sets...');
  
  const insertSet = db.prepare('INSERT INTO chip_sets (name, quantity_owned) VALUES (?, ?)');
  const insertDetail = db.prepare('INSERT INTO chip_set_details (chip_set_id, denomination, count_per_set, color) VALUES (?, ?, ?, ?)');
  
  // Core Set (500 PCS): $5, $25, $100, $500
  const coreSetId = insertSet.run('SLOWPLAY Core Set (500 PCS)', 3).lastInsertRowid;
  insertDetail.run(coreSetId, 5, 200, CHIP_COLORS[5]);
  insertDetail.run(coreSetId, 25, 150, CHIP_COLORS[25]);
  insertDetail.run(coreSetId, 100, 100, CHIP_COLORS[100]);
  insertDetail.run(coreSetId, 500, 50, CHIP_COLORS[500]);
  
  // Full Set (500 PCS): $1, $5, $25, $100, $500, $1000
  const fullSetId = insertSet.run('SLOWPLAY Full Set (500 PCS)', 1).lastInsertRowid;
  insertDetail.run(fullSetId, 1, 100, CHIP_COLORS[1]);
  insertDetail.run(fullSetId, 5, 150, CHIP_COLORS[5]);
  insertDetail.run(fullSetId, 25, 100, CHIP_COLORS[25]);
  insertDetail.run(fullSetId, 100, 100, CHIP_COLORS[100]);
  insertDetail.run(fullSetId, 500, 25, CHIP_COLORS[500]);
  insertDetail.run(fullSetId, 1000, 25, CHIP_COLORS[1000]);
} else {
  // Update existing records with colors if they're empty
  const updateColor = db.prepare('UPDATE chip_set_details SET color = ? WHERE denomination = ? AND (color = \'\' OR color IS NULL)');
  for (const [denom, color] of Object.entries(CHIP_COLORS)) {
    updateColor.run(color, parseFloat(denom));
  }
}

module.exports = db;
module.exports.CHIP_COLORS = CHIP_COLORS;
