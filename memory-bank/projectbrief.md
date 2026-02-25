# Poker Blinds Tool — Project Brief

## Purpose
Web-based tool for designing poker tournament structures: starting stacks (chip denominations/quantities), blind schedules, and predicting game duration.

## Core Requirements
1. **Chip Inventory Management** — Track owned chip sets and quantities, see total available chips by denomination
2. **Starting Stack Designer** — Design per-player chip distributions, see max players supported by inventory
3. **Blind Schedule Builder** — Create blind level progressions with BB counts, chip-up detection, duration tracking
4. **Tournament Planner** — Combine stacks + schedules, predict duration, verify chip sufficiency

## Chip Sets Owned (Initial)
| Set | Qty | Contents |
|-----|-----|----------|
| SLOWPLAY Core Set (500 PCS) | 3 | $5×200, $25×150, $100×100, $500×50 |
| SLOWPLAY Full Set (500 PCS) | 1 | $1×100, $5×150, $25×100, $100×100, $500×25, $1000×25 |

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS (single-page app)
- **Backend:** Node.js + Express
- **Database:** SQLite via better-sqlite3
- **Port:** 3000

## Running
```bash
cd /Users/nick/PokerBlindsTool && node server.js
# Visit http://localhost:3000
```
