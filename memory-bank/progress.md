# Progress — Poker Blinds Tool

## What Works ✅
- [x] Project setup (Node.js + Express + SQLite)
- [x] Database schema with all 7 tables
- [x] Chip set seed data (3× Core Set, 1× Full Set)
- [x] Chip Inventory page — view sets, adjust quantities, see totals
- [x] Stack Designer — pick chips per denomination, see value/max players, save/edit/delete
- [x] Blind Schedule Builder — add/remove levels & breaks, auto-double blinds, BB count, chip-up detection, duration summary
- [x] Tournament Planner — combine stack + schedule, see timeline with BB counts, chip sufficiency check
- [x] Full CRUD for stacks, schedules, and tournaments
- [x] Dark poker-themed UI

## What's Left to Build
### High Priority
- [ ] Drag-to-reorder blind levels
- [ ] Auto-suggest blind schedule from target duration + starting stack

### Medium Priority
- [ ] Chip color assignment per denomination
- [ ] Export/print tournament sheet
- [ ] M-ratio display alongside BB count

### Low Priority
- [ ] Multiple table support (splitting chips across tables)
- [ ] Tournament timer/clock mode
- [ ] Payout structure calculator

## Known Issues
- None currently identified

## API Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/chip-sets | All chip sets with details |
| PATCH | /api/chip-sets/:id | Update quantity owned |
| GET | /api/chip-inventory | Aggregated inventory |
| GET/POST | /api/stack-configs | List/create stacks |
| PUT/DELETE | /api/stack-configs/:id | Update/delete stack |
| GET/POST | /api/blind-schedules | List/create schedules |
| PUT/DELETE | /api/blind-schedules/:id | Update/delete schedule |
| GET/POST | /api/tournaments | List/create tournaments |
| PUT/DELETE | /api/tournaments/:id | Update/delete tournament |
| GET | /api/tournaments/:id/details | Full tournament with stack, schedule, inventory |
