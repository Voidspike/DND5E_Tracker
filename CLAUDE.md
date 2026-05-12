# CLAUDE.md — DND Campaign Visualizer

## Project Overview

A web-based real-time multiplayer D&D campaign visualizer. DM controls maps, tokens, combat, and game state. Players join via invite code and control their characters. Everything syncs via WebSocket.

**Grid scale**: 1 grid cell = 5 feet (standard D&D 5E scale).

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
npm run db:push -w server     # Sync Prisma schema → DB (non-interactive)
npm run db:seed -w server     # Seed test data
npm run dev                   # Start dev (frontend :5173, backend :3001)
```

Test accounts: `dm@example.com` / `player@example.com` (password: `password123`). Seed campaign invite code: `DND2024`.

> **Note**: `prisma migrate dev` is interactive and cannot run in non-TTY shells. Use `prisma db push` instead for schema changes.

## Architecture Pattern

Every feature follows this flow:

```
shared/types/index.ts  →  Prisma schema  →  API route  →  Socket event  →  Store  →  Component
```

**Code organization:**
- `shared/types/` — TypeScript interfaces shared between client and server (`@dnd/shared`)
- `server/src/routes/` — REST API (Express routers): `auth`, `campaign`, `map`, `token`, `character`, `upload`
- `server/src/socket/index.ts` — All Socket.IO event handlers in a single file
- `server/src/middleware/auth.ts` — JWT auth middleware for Express
- `client/src/services/api.ts` — Typed API client (imports from `@dnd/shared`)
- `client/src/services/socket.ts` — Socket.IO client singleton
- `client/src/stores/` — Zustand stores: `authStore`, `campaignStore`, `gameStore`
- `client/src/hooks/useSocket.ts` — Socket connection hook with event listeners
- `client/src/pages/` — Route pages: `Dashboard/`, `Campaign/`, `Auth/`
- `client/src/components/` — Feature components: `map/`, `token/`, `combat/`, `dice/`, `chat/`, `character/`

## Key Conventions

- **Prisma `Json` fields** (stats, statSaveProficiencies, skills, skillProficiencies, spells, spellSlots, weapons, armor, currency, equipment, inventory, statusEffects, fogData) need `JSON.stringify` on write and parse on read. The `character.ts` route has a `jsonFields` array to automate this.
- **Server socket handlers** check `socket.campaignId` for room-scoped operations. DM-only actions should additionally verify ownership but currently don't in all cases (known security gap).
- **The Vite dev server proxies** `/api`, `/uploads`, and `/socket.io` to `http://localhost:3001`.
- **Tailwind uses custom DND-themed colors**: `dnd-bg`, `dnd-surface`, `dnd-primary`, `dnd-accent`, `dnd-muted`, `dnd-text`, `dnd-success`, `dnd-danger`.
- **Server tsconfig** uses `rootDir: ".."` to allow importing `@dnd/shared` from outside `src/`.
- **Text inputs use local-state + blur sync** (`EditField` / `BlurInput` components in `CharacterSheet.tsx`) to avoid IME composition bugs. Never use raw `onCompositionStart`/`onCompositionEnd` — they break input entirely in some browser/IME configurations.
- **Zod schemas for IDs** should NOT use `.uuid()` — seed data uses human-readable IDs (e.g. `"seed-character-2"`) that fail UUID validation. Use `z.string()` instead.
- **Seed character IDs are non-UUID strings** (e.g. `"seed-character-1"`, `"seed-character-2"`). Any schema validation must accept these.
- **`syncToken` in campaignStore now upserts**: if the token ID doesn't exist in the local array, it's pushed (new token from another client); if it exists, it's merged. Same behavior for `syncCharacter`.
- **`gameStore.highlightedTokenId`** tracks the token clicked in the combat tracker sidebar (separate from `selectedTokenId`). MapView uses it to draw a cyan highlight ring and auto-pan.
- **Redis host port is 16379** (was 6379, blocked by Windows reserved port). Docker maps 16379→6379 internally.
- **When user says "推送更新" (push updates)**, also check and update relevant `.md` files (CLAUDE.md, DESIGN.md, etc.) to reflect new features, changed conventions, or updated status.
- **When user says "重启项目" (restart project)**, kill all node processes first (`taskkill //F //IM node.exe`), restart Docker containers, then `npm run dev`.

## Feature Status (as of 2026-05-12)

### Fully Working
- User auth (register/login/me) with JWT
- Campaign CRUD + invite system + player management (kick)
- Map upload (file via multer or URL), multi-map switching, map delete
- Map grid overlay: adjustable grid W/H (grid units), grid size (px), offset X/Y, **line color (color picker + text)**, **line width (slider 1-5px)**
- Fog of War: DM paint/erase, real-time sync; defaults to transparent (fully visible) for new maps
- Token CRUD + drag/drop + HP editing + **hide/show toggle** (enabled via selectedTokenId)
- Token creation toolbar (PC/NPC/Monster/Object with icons + color)
- **Vision/range overlay**: selected token shows darkvision circle (solid blue) and speed circle (dashed orange) — 1 grid = 5ft
- Combat tracker: start/end, add/remove participants (token dropdown), next/prev turn, **inline initiative editing**, active turn highlighting
- Dice roller: single + multi-dice combo, private rolls, saved presets (localStorage)
- Chat: public messages, whisper-to-DM, **system notifications** (join/leave/combat events)
- **Full DND 5E Character Sheet** with 6 tabs:
  1. **Info** — name, class/level, race/subrace, gender, age, height, weight, alignment, faith, XP, proficiency, languages, tool proficiencies
  2. **Stats** — 6 ability scores + modifiers + saving throw proficiencies (toggle) + saves + passive perception
  3. **Combat** — HP bar (current/max/temp), AC, initiative, speed, darkvision, hit dice, resistances, immunities
  4. **Skills** — 18 skills with proficiency toggle + total modifier (ability mod + proficiency bonus if proficient)
  5. **Spells** — **spellcasting auto-computed from class** (class→ability mapping, DC/atk auto-calc), spell slots (visual dot click to mark used), **spell search filtered by class**, learned vs prepared spell management (prep limit = spell mod + level for prepared casters), cantrips always prepared
  6. **Equip** — weapons (add/edit/remove with name/atk/dmg/type/properties), armor (AC/type/stealth/strReq), currency (CP/SP/EP/GP/PP), **equipment items with optional attached spells + charges**
- Character editor with inline editing for all fields (owner-only), **IME-safe inputs** (local-state + blur sync)
- **Quick dice roll**: d20 buttons on stats/saves/skills for instant rolls
- **Token status effects**: add/remove UI with real-time sync
- **Character-Token link**: associate map tokens with character sheets via dropdown; **auto-syncs name, HP, AC, portrait, darkvision, speed on link**; **two-way HP sync** (token HP ↔ character sheet HP)
- **Map zoom/pan**: zoom towards cursor, smooth CSS transitions, touchpad pinch
- **Mobile responsive**: touch drag/pan/pinch, icon-only tabs on small screens
- **Right-click context menu** on tokens (HP +/-5, hide/show, delete)
- **Map annotation drawing**: DM freehand draw layer with color picker + sync
- **Combat log**: records all combat events (start/end/turn/add/remove/initiative)
- **Chat quick replies**: 10 D&D-themed quick reply buttons
- **Chat message styling**: distinct visual styles for system/dice/whisper messages
- **Online player panel**: clickable online count shows players with character names
- **DM player-view preview**: toggle to see map as players do (with fog)
- **Campaign JSON export**: downloadable backup of campaign data
- **Session stats panel**: dice rolls, messages, maps, tokens counts
- **Design tokens unified**: all colors use dnd-* Tailwind tokens
- Online player tracking (via Socket.IO room membership)
- **Combat tracker token highlight**: active-turn token gets gold outline + auto-pan centering; clicking any participant in the list highlights that token cyan + pans map to it (without zoom change). Uses `highlightedTokenId` in gameStore.
- **Real-time sync audit + fixes**: all token mutations broadcast via socket; `syncToken` upserts (adds new, updates existing); `token:delete` and `token:create` socket events properly handled; `character:update` socket event for linked character HP sync across clients

### Seed Characters
- **Ragnar Stoneheart** — Dwarf Fighter Lv3 (player), darkvision 60ft, speed 25ft
- **Vaelira** — Drow Elf Sorcerer Lv6 (DM), darkvision 120ft, speed 30ft, full spell slots + prepared spells

### Known Gaps
- **No testing** (zero test files)
- **No CI/CD** (no GitHub Actions)
- **Redis configured but unused** in application code
- **No rate limiting** on API endpoints
- **No global Express error handler** middleware
- **Token REST create schema** validates `mapId` with `.uuid()`, but socket create handler does not — seed data maps with non-UUID IDs can only create tokens via socket, not REST

## Server Socket Event Map

All handlers in `server/src/socket/index.ts`:

| Event | Action |
|---|---|
| `room:join` / `room:leave` | Room membership + system messages |
| `token:create` / `token:drag` / `token:move` / `token:update` / `token:delete` / `token:select` | Token CRUD + real-time sync (includes darkvision/speed/characterId) |
| `map:fog:update` / `map:grid:update` / `map:annotation:update` / `map:annotation:clear` | Map settings + annotation sync |
| `combat:start` / `combat:end` / `combat:next_turn` / `combat:prev_turn` / `combat:add` / `combat:remove` / `combat:initiative:update` | Combat lifecycle |
| `combat:log` | Combat log entry broadcast |
| `character:update` | Character update (e.g. HP sync from linked token) |
| `dice:roll` | Dice rolling with private option |
| `chat:message` / `chat:whisper` | Chat with DM-only whisper |

## Client Socket Listeners

In `client/src/hooks/useSocket.ts`: `room:players`, `chat:message`, `chat:whisper`, `dice:roll`, `dice:roll_private`, `map:fog:update`, `map:annotation:update`, `map:annotation:clear`, `combat:start`, `combat:next_turn`, `combat:prev_turn`, `combat:end`, `combat:add`, `combat:remove`, `combat:initiative:update`, `combat:log`, `token:update`, `token:move`, `token:create`, `token:delete`, `token:select`, `character:update`

Additional listeners in `MapView.tsx`: `map:fog:update`, `map:annotation:update`, `map:annotation:clear`

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
| Vite config (proxy) | `client/vite.config.ts` |
| Seed data | `server/prisma/seed.ts` |
| Campaign page (main) | `client/src/pages/Campaign/CampaignPage.tsx` |
| Map component | `client/src/components/map/MapView.tsx` |
| Combat tracker | `client/src/components/combat/CombatTracker.tsx` |
| Dice roller | `client/src/components/dice/DiceRoller.tsx` |
| Chat panel | `client/src/components/chat/ChatPanel.tsx` |
| Character sheet | `client/src/components/character/CharacterSheet.tsx` |
| Character list | `client/src/components/character/CharacterList.tsx` |
