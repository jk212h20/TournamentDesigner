const express = require('express');
const path = require('path');
const db = require('./db');
const { CHIP_COLORS } = require('./db');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============ CHIP SETS API ============

// Get all chip sets with details
app.get('/api/chip-sets', (req, res) => {
  const sets = db.prepare('SELECT * FROM chip_sets ORDER BY id').all();
  for (const s of sets) {
    s.details = db.prepare('SELECT * FROM chip_set_details WHERE chip_set_id = ? ORDER BY denomination').all(s.id);
  }
  res.json(sets);
});

// Update quantity owned for a chip set
app.patch('/api/chip-sets/:id', (req, res) => {
  const { quantity_owned } = req.body;
  db.prepare('UPDATE chip_sets SET quantity_owned = ? WHERE id = ?').run(quantity_owned, req.params.id);
  res.json({ ok: true });
});

// Get total chip inventory (aggregated across all sets)
app.get('/api/chip-inventory', (req, res) => {
  const rows = db.prepare(`
    SELECT d.denomination, d.color, SUM(d.count_per_set * s.quantity_owned) as total_count
    FROM chip_set_details d
    JOIN chip_sets s ON s.id = d.chip_set_id
    GROUP BY d.denomination
    ORDER BY d.denomination
  `).all();
  res.json(rows);
});

// Get chip colors
app.get('/api/chip-colors', (req, res) => {
  res.json(CHIP_COLORS);
});

// ============ STACK CONFIGS API ============

// Get all stack configs
app.get('/api/stack-configs', (req, res) => {
  const configs = db.prepare('SELECT * FROM stack_configs ORDER BY created_at DESC').all();
  for (const c of configs) {
    const allChips = db.prepare('SELECT * FROM stack_config_chips WHERE stack_config_id = ? ORDER BY denomination').all(c.id);
    c.chips = allChips.filter(ch => ch.stack_type === 'starting');
    c.rebuy1_chips = allChips.filter(ch => ch.stack_type === 'rebuy1');
    c.rebuy2_chips = allChips.filter(ch => ch.stack_type === 'rebuy2');
  }
  res.json(configs);
});

// Create a stack config
app.post('/api/stack-configs', (req, res) => {
  const { name, chips, rebuy1_chips, rebuy2_chips } = req.body;
  const result = db.prepare('INSERT INTO stack_configs (name) VALUES (?)').run(name);
  const id = result.lastInsertRowid;
  const insertChip = db.prepare('INSERT INTO stack_config_chips (stack_config_id, denomination, quantity, stack_type) VALUES (?, ?, ?, ?)');
  for (const chip of (chips || [])) {
    insertChip.run(id, chip.denomination, chip.quantity, 'starting');
  }
  for (const chip of (rebuy1_chips || [])) {
    insertChip.run(id, chip.denomination, chip.quantity, 'rebuy1');
  }
  for (const chip of (rebuy2_chips || [])) {
    insertChip.run(id, chip.denomination, chip.quantity, 'rebuy2');
  }
  res.json({ id });
});

// Update a stack config
app.put('/api/stack-configs/:id', (req, res) => {
  const { name, chips, rebuy1_chips, rebuy2_chips } = req.body;
  db.prepare('UPDATE stack_configs SET name = ? WHERE id = ?').run(name, req.params.id);
  db.prepare('DELETE FROM stack_config_chips WHERE stack_config_id = ?').run(req.params.id);
  const insertChip = db.prepare('INSERT INTO stack_config_chips (stack_config_id, denomination, quantity, stack_type) VALUES (?, ?, ?, ?)');
  for (const chip of (chips || [])) {
    insertChip.run(req.params.id, chip.denomination, chip.quantity, 'starting');
  }
  for (const chip of (rebuy1_chips || [])) {
    insertChip.run(req.params.id, chip.denomination, chip.quantity, 'rebuy1');
  }
  for (const chip of (rebuy2_chips || [])) {
    insertChip.run(req.params.id, chip.denomination, chip.quantity, 'rebuy2');
  }
  res.json({ ok: true });
});

// Delete a stack config
app.delete('/api/stack-configs/:id', (req, res) => {
  db.prepare('DELETE FROM stack_configs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ BLIND SCHEDULES API ============

// Get all blind schedules
app.get('/api/blind-schedules', (req, res) => {
  const schedules = db.prepare('SELECT * FROM blind_schedules ORDER BY created_at DESC').all();
  for (const s of schedules) {
    s.levels = db.prepare('SELECT * FROM blind_levels WHERE schedule_id = ? ORDER BY sort_order, id').all(s.id);
  }
  res.json(schedules);
});

// Create a blind schedule
app.post('/api/blind-schedules', (req, res) => {
  const { name, levels } = req.body;
  const result = db.prepare('INSERT INTO blind_schedules (name) VALUES (?)').run(name);
  const id = result.lastInsertRowid;
  const insertLevel = db.prepare('INSERT INTO blind_levels (schedule_id, level_number, small_blind, big_blind, ante, duration_minutes, is_break, sort_order, after_round) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  levels.forEach((lvl, idx) => {
    insertLevel.run(id, lvl.level_number, lvl.small_blind || 0, lvl.big_blind || 0, lvl.ante || 0, lvl.duration_minutes || 20, lvl.is_break ? 1 : 0, idx, lvl.after_round || 0);
  });
  res.json({ id });
});

// Update a blind schedule
app.put('/api/blind-schedules/:id', (req, res) => {
  const { name, levels } = req.body;
  db.prepare('UPDATE blind_schedules SET name = ? WHERE id = ?').run(name, req.params.id);
  db.prepare('DELETE FROM blind_levels WHERE schedule_id = ?').run(req.params.id);
  const insertLevel = db.prepare('INSERT INTO blind_levels (schedule_id, level_number, small_blind, big_blind, ante, duration_minutes, is_break, sort_order, after_round) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  levels.forEach((lvl, idx) => {
    insertLevel.run(req.params.id, lvl.level_number, lvl.small_blind || 0, lvl.big_blind || 0, lvl.ante || 0, lvl.duration_minutes || 20, lvl.is_break ? 1 : 0, idx, lvl.after_round || 0);
  });
  res.json({ ok: true });
});

// Delete a blind schedule
app.delete('/api/blind-schedules/:id', (req, res) => {
  db.prepare('DELETE FROM blind_schedules WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ TOURNAMENTS API ============

// Get all tournaments
app.get('/api/tournaments', (req, res) => {
  const tournaments = db.prepare(`
    SELECT t.*, sc.name as stack_name, bs.name as schedule_name,
           rsc.name as rebuy_stack_name
    FROM tournaments t
    LEFT JOIN stack_configs sc ON sc.id = t.stack_config_id
    LEFT JOIN blind_schedules bs ON bs.id = t.blind_schedule_id
    LEFT JOIN stack_configs rsc ON rsc.id = t.rebuy_stack_config_id
    ORDER BY t.created_at DESC
  `).all();
  res.json(tournaments);
});

// Create a tournament
app.post('/api/tournaments', (req, res) => {
  const { name, stack_config_id, blind_schedule_id, num_players,
          rebuy_allowed, rebuy_stack_config_id, rebuy_max, rebuy_through_level, rebuy_cost } = req.body;
  const result = db.prepare(`
    INSERT INTO tournaments (name, stack_config_id, blind_schedule_id, num_players,
      rebuy_allowed, rebuy_stack_config_id, rebuy_max, rebuy_through_level, rebuy_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, stack_config_id, blind_schedule_id, num_players,
    rebuy_allowed ? 1 : 0, rebuy_stack_config_id || null, rebuy_max || 1, rebuy_through_level || 0, rebuy_cost || 0);
  res.json({ id: result.lastInsertRowid });
});

// Update a tournament
app.put('/api/tournaments/:id', (req, res) => {
  const { name, stack_config_id, blind_schedule_id, num_players,
          rebuy_allowed, rebuy_stack_config_id, rebuy_max, rebuy_through_level, rebuy_cost } = req.body;
  db.prepare(`
    UPDATE tournaments SET name=?, stack_config_id=?, blind_schedule_id=?, num_players=?,
      rebuy_allowed=?, rebuy_stack_config_id=?, rebuy_max=?, rebuy_through_level=?, rebuy_cost=?
    WHERE id=?
  `).run(name, stack_config_id, blind_schedule_id, num_players,
    rebuy_allowed ? 1 : 0, rebuy_stack_config_id || null, rebuy_max || 1, rebuy_through_level || 0, rebuy_cost || 0,
    req.params.id);
  res.json({ ok: true });
});

// Delete a tournament
app.delete('/api/tournaments/:id', (req, res) => {
  db.prepare('DELETE FROM tournaments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Get full tournament details (for the predictor)
app.get('/api/tournaments/:id/details', (req, res) => {
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!tournament) return res.status(404).json({ error: 'Not found' });
  
  if (tournament.stack_config_id) {
    tournament.stack = db.prepare('SELECT * FROM stack_configs WHERE id = ?').get(tournament.stack_config_id);
    if (tournament.stack) {
      tournament.stack.chips = db.prepare('SELECT * FROM stack_config_chips WHERE stack_config_id = ? ORDER BY denomination').all(tournament.stack_config_id);
    }
  }
  
  if (tournament.rebuy_stack_config_id) {
    tournament.rebuy_stack = db.prepare('SELECT * FROM stack_configs WHERE id = ?').get(tournament.rebuy_stack_config_id);
    if (tournament.rebuy_stack) {
      tournament.rebuy_stack.chips = db.prepare('SELECT * FROM stack_config_chips WHERE stack_config_id = ? ORDER BY denomination').all(tournament.rebuy_stack_config_id);
    }
  }
  
  if (tournament.blind_schedule_id) {
    tournament.schedule = db.prepare('SELECT * FROM blind_schedules WHERE id = ?').get(tournament.blind_schedule_id);
    if (tournament.schedule) {
      tournament.schedule.levels = db.prepare('SELECT * FROM blind_levels WHERE schedule_id = ? ORDER BY sort_order, id').all(tournament.blind_schedule_id);
    }
  }
  
  // Get inventory for max player calculation
  const inventory = db.prepare(`
    SELECT d.denomination, d.color, SUM(d.count_per_set * s.quantity_owned) as total_count
    FROM chip_set_details d
    JOIN chip_sets s ON s.id = d.chip_set_id
    GROUP BY d.denomination
    ORDER BY d.denomination
  `).all();
  tournament.inventory = inventory;
  tournament.chipColors = CHIP_COLORS;
  
  res.json(tournament);
});

app.listen(PORT, () => {
  console.log(`Poker Blinds Tool running at http://localhost:${PORT}`);
});
