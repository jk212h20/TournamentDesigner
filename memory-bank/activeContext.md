# Active Context — Poker Blinds Tool

## IMPORTANT WORKFLOW NOTE
**Do NOT use browser_action to test.** It's slow, uses lots of tokens, and the user checks manually anyway. Just make changes and let the user verify.

## Current State (Feb 24, 2026)
- **Status:** MVP complete and functional
- **All 4 pages working:** Chip Inventory, Stack Designer, Blind Schedules, Tournament Planner
- **Database seeded** with 2 chip set types (3× Core, 1× Full)

## Architecture
```
server.js          — Express server, all API routes
db.js              — SQLite setup, schema creation, seed data
public/index.html  — SPA shell with 4 pages
public/style.css   — Dark theme with green/gold accents
public/app.js      — All frontend logic (navigation, CRUD, calculations)
poker.db           — SQLite database (auto-created on first run)
```

## Key Features Working
- Chip set quantity adjustment (+/- buttons) with colored chip circle icons
- Aggregated total inventory view
- Stack designer with two-column layout: Starting Stack (left) + Rebuy Stack (right)
- Number of Entrants field — live computes remaining inventory
- Rebuys field — total rebuys, shows "Max Rebuys Supported" based on remaining inventory
- Remaining inventory breakdown showing chips used (start + rebuy) and what's left
- Side-by-side stack visual (starting + rebuy) with chip tower imagery
- Blind schedule builder with auto-doubling, BB count display, chip-up detection
- Reference stack dropdown to see BB counts per level
- Break insertion in schedules
- Tournament creation combining stack + schedule + rebuy settings
- Tournament detail view with timeline, duration prediction, chip sufficiency check

## What's NOT Built Yet
- Drag-to-reorder blind levels (currently add/remove only)
- Auto-suggest schedule based on target duration
- Export/print tournament sheet
- M-ratio calculations (beyond BB count)

## Database
- SQLite at `poker.db` in project root
- Tables: `chip_sets`, `chip_set_details`, `stack_configs`, `stack_config_chips`, `blind_schedules`, `blind_levels`, `tournaments`
- Seed data runs only if `chip_sets` table is empty
