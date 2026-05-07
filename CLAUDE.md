# CLAUDE.md — DND Campaign Visualizer

## Project Overview

A web-based real-time multiplayer D&D campaign visualizer. DM controls maps, tokens, combat, and game state. Players join via invite code and control their characters. Everything syncs via WebSocket.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| State | Zustand |
| Realtime | Socket.IO |
| Backend | Node.js + Express |
| DB | PostgreSQL (Prisma ORM) |
| Auth | JWT (7-day expiry) |

## Quick Start

```bash
docker compose up -d          # Start PostgreSQL + Redis
npm install                   # Install deps
npm run db:migrate -w server  # Run migrations
npm run db:seed -w server     # Seed test data
npm run dev                   # Start dev (frontend :5173, backend :3001)
```

Test accounts: `dm@example.com` / `player@example.com` (password: `password123`). Seed campaign invite code: `DND2024`.

## Architecture Pattern

Every feature follows this flow:

```
shared/types/index.ts  →  Prisma schema  →  API route  →  Socket event  →  Store  →  Component
```

**Code organization:**
- `shared/types/` — TypeScript interfaces shared between client and server (`@dnd/shared`)
- `server/src/routes/` — REST API (Express routers)
- `server/src/socket/index.ts` — All Socket.IO event handlers in a single file
- `server/src/middleware/auth.ts` — JWT auth middleware for Express
- `client/src/services/api.ts` — Typed API client (imports from `@dnd/shared`)
- `client/src/services/socket.ts` — Socket.IO client singleton
- `client/src/stores/` — Zustand stores: `authStore`, `campaignStore`, `gameStore`
- `client/src/hooks/useSocket.ts` — Socket connection hook with event listeners
- `client/src/pages/` — Route pages: `Dashboard/`, `Campaign/`, `Auth/`
- `client/src/components/` — Feature components: `map/`, `token/`, `combat/`, `dice/`, `chat/`, `character/`

## Key Conventions

- **All `any` types should eventually be replaced** with shared types from `@dnd/shared`. The API service and stores are now typed; components still use some `any`.
- **Socket events are typed** in `shared/types/index.ts` under `ServerToClientEvents` and `ClientToServerEvents`.
- **Prisma `Json` fields** (settings, stats, statusEffects, spells, inventory, skills, fogData) need `JSON.stringify` on write and parse on read. When in doubt, cast `as any` in Prisma calls.
- **Server socket handlers** check `socket.campaignId` for room-scoped operations. DM-only actions should additionally verify ownership but currently don't in all cases (known security gap).
- **The client API base URL** is configured via `VITE_API_URL` env var, defaulting to `/api` (proxied in dev).
- **Tailwind uses custom DND-themed colors**: `dnd-bg`, `dnd-surface`, `dnd-primary`, `dnd-accent`, `dnd-muted`, `dnd-text`, `dnd-success`, `dnd-danger`.

## Feature Status (as of 2026-05-07)

### Fully Working
- User auth (register/login/me) with JWT
- Campaign CRUD + invite system
- Map upload (file or URL), multi-map switching
- Map grid overlay with adjustable size/offset
- Fog of War (DM paint/erase, real-time sync)
- Token CRUD + drag/drop + HP editing + hide/show toggle
- Token creation toolbar (PC/NPC/Monster/Object with icons)
- Combat tracker: start/end, add/remove participants, next/prev turn, inline initiative editing, active turn highlighting
- Dice roller: single + multi-dice combo, private rolls, saved presets (localStorage)
- Chat: public messages, whisper-to-DM, system notifications (join/leave/combat)
- Character sheet: viewer + edit mode (stats, HP, AC, notes)
- Online player list (via Socket.IO room tracking)

### Known Gaps
- **Server rootDir issue**: `server/tsconfig.json` sets `rootDir: ".."` to allow importing `@dnd/shared` (workaround for monorepo)
- **Map fog/grid updates use `updateMany`** instead of targeting a specific map (uses `campaignId` in where clause since map ID isn't passed in socket events)
- **Token status effects**: displayed read-only, no add/remove UI
- **No testing** (zero test files)
- **No CI/CD** (no GitHub Actions)
- **Redis configured but unused** in application code
- **No rate limiting** on API endpoints
- **No global Express error handler** middleware
- **Combat `combat:start`** creates an empty tracker (participants added separately)
- **Fog canvas** is hardcoded to 1920×1080, not scaled to map dimensions
- **Token delete** in socket handler doesn't verify the token belongs to the campaign before deleting

## Server Socket Event Map

All handlers in `server/src/socket/index.ts`:

| Event | Action |
|---|---|
| `room:join` / `room:leave` | Room membership + system messages |
| `token:create` / `token:drag` / `token:move` / `token:update` / `token:delete` / `token:select` | Token CRUD + real-time sync |
| `map:fog:update` / `map:grid:update` | Map settings sync |
| `combat:start` / `combat:end` / `combat:next_turn` / `combat:prev_turn` / `combat:add` / `combat:remove` / `combat:initiative:update` | Combat lifecycle |
| `dice:roll` | Dice rolling with private option |
| `chat:message` / `chat:whisper` | Chat with DM-only whisper |

## Client Socket Listeners

In `client/src/hooks/useSocket.ts`: `room:players`, `chat:message`, `dice:roll`, `dice:roll_private`, `map:fog:update`, `combat:start`, `combat:next_turn`, `combat:prev_turn`, `combat:end`, `combat:add`, `combat:remove`, `combat:initiative:update`

## Key Files Reference

| Purpose | Path |
|---|---|
| Shared types | `shared/types/index.ts` |
| Prisma schema | `server/prisma/schema.prisma` |
| Server entry | `server/src/index.ts` |
| All socket handlers | `server/src/socket/index.ts` |
| Auth middleware | `server/src/middleware/auth.ts` |
| API client | `client/src/services/api.ts` |
| Socket client | `client/src/services/socket.ts` |
| Auth store | `client/src/stores/authStore.ts` |
| Campaign store | `client/src/stores/campaignStore.ts` |
| Game/realtime store | `client/src/stores/gameStore.ts` |
| Socket hook | `client/src/hooks/useSocket.ts` |
| Campaign page (main) | `client/src/pages/Campaign/CampaignPage.tsx` |
| Map component | `client/src/components/map/MapView.tsx` |
| Combat tracker | `client/src/components/combat/CombatTracker.tsx` |
| Dice roller | `client/src/components/dice/DiceRoller.tsx` |
| Chat panel | `client/src/components/chat/ChatPanel.tsx` |
| Character sheet | `client/src/components/character/CharacterSheet.tsx` |
