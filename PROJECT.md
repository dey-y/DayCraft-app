# Project: DayCraft AI — Production Readiness

## Architecture
DayCraft AI is a cross-platform (iOS, Android, Web) anti-stress daily planner built on Expo SDK 58, React 19.3, React Native 0.88, TypeScript (`strict: true`), NativeWind v4, Zustand v5, React Native Reanimated v4, React Native Gesture Handler, and SQLite (`expo-sqlite` / `wa-sqlite` + Web persistence parity).

### System Layers
1. **Pure Domain & Contracts Layer (`types/daycraft.ts`)**:
   - Runtime-agnostic TypeScript interfaces (zero `react-native` imports) shared across UI, Zustand stores, SQLite repository, Gemini AI parser, Sync engine, and Node.js MCP server.
2. **Persistence, Rollover & Sync Layer (`services/db/`, `services/rollover/`, `services/sync/`)**:
   - Versioned SQLite schema (`PRAGMA user_version` migrations) with relational tables (`events`, `pending_tasks`, `idea_groups`, `ideas`, `chat_messages`, `alerts`, `sync_outbox`, `app_meta`, `kv_store`), automatic v9 KV migration, `seed_initialized` guard, queued writes, and Web storage parity.
   - Anti-stress daily rollover & 10-day stale-idea evaluator.
   - Local-first `sync_outbox` queue with `SyncTransport` abstraction, conflict resolution, and reactive `SyncState`.
3. **Dual AI & MCP Layer (`services/ai/`, `services/mcp/`)**:
   - `geminiClient.ts`: Gemini 2.0 Flash Function Calling (`tools` / `functionDeclarations`) supporting multi-intent extraction, live schedule context, 8s timeout, and runtime validation, paired with a deterministic `0ms` offline NLP fallback.
   - `services/mcp/`: Headless Node.js Model Context Protocol tool & resource server operating over `DayCraftRepository` with zero React Native dependencies.
4. **State Layer (`store/`)**:
   - `useThemeStore.ts`: Persists 6 Kuro-Zen themes (`granate`, `murasaki`, `sumi`, `aizome`, `bosque`, `shiro`) cleanly without resetting `'murasaki'`.
   - `useDayCraftStore.ts`: Hydrates from `DayCraftRepository`, dispatches optimistic updates + persistence + sync outbox entries, and preserves UI action contracts.
5. **Presentation & Design System Layer (`constants/`, `app/`, `components/`)**:
   - Kuro-Zen 15-token semantic theme system (`Plus Jakarta Sans` + `JetBrains Mono`), "Ma" negative space, `>= 12px` typography, `>= 44x44px` touch targets, Reanimated v4 microinteractions, cross-platform Gesture Handler 24h rail, and rich Markdown (`.md`) editor with preview & disk export.

### Dual Track Execution
- **Implementation Track**: Milestones `M1` → (`M2` || `M3` || `M4`) → `M5` (Final Milestone: Tier 1–4 E2E Pass + Tier 5 Adversarial Coverage Hardening).
- **E2E Testing Track**: Runs in parallel to design opaque-box `TEST_INFRA.md` and Tiers 1–4 tests under `tests/e2e/`, publishing `TEST_READY.md` when ready.

---

## Feature Inventory
Every feature discovered in Phase 0 Survey is assigned to a milestone below (no unassigned features):

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Universal Smart Intake Bar | Single text + voice intake bar across Mobile & Desktop with non-blocking loading feedback | M3, M2 | `README.md`, `AUDITORIA_V9.md` |
| 2 | Real Voice Dictation | Web Speech API (`es-ES`, interim results) + clean native/fallback feedback without crash | M3 | `DEVELOPMENT.md` §12.3 |
| 3 | Dual Gemini + Local NLP Parser | Gemini Function Calling multi-intent JSON + fixed deterministic 0ms offline parser | M2 | `ORIGINAL_REQUEST.md`, `DEVELOPMENT.md` |
| 4 | AI Settings Modal | Config modal in Assistant tab (`gemini_config_v9`, Cloud vs Local NLP toggle) | M4 | `DEVELOPMENT.md` §12.3 |
| 5 | 24h Vertical Timeline Rail (`Rail24h`) | Clean resting hours, collapsible `00:00–06:00` quiet band, `NowMarker` today-only, `LAYOUT` alignment | M4 | `AUDITORIA_V9.md`, `DEVELOPMENT.md` |
| 6 | Interactive 15m Tap & Drag Time-Blocking | Cross-platform Gesture Handler + Reanimated + Haptics long-press 15m drag-stretch & overlap columns | M4 | `ORIGINAL_REQUEST.md`, `DEVELOPMENT.md` |
| 7 | Full Block Editing & Deletion (`slot-picker` + `EventCard`) | Top-aligned translucent cards, Reanimated elastic checkbox, dynamic free-slot suggestions, edit/delete+undo | M4 | `ORIGINAL_REQUEST.md`, `DEVELOPMENT.md` |
| 8 | Dynamic ISO Day Strip & Infinite Scroll (`DayStrip`) | Infinite `YYYY-MM-DD` strip, `+60d` auto-extend, Web wheel/drag, `>=44px` hit targets | M4 | `DEVELOPMENT.md`, `constants/theme.ts` |
| 9 | Empathetic Empty-Day Messages | Calm Today/Future/Past empty-day messages | M4 | `README.md`, `DEVELOPMENT.md` |
| 10 | Unscheduled Pending Tasks & Smart Slot Picker | Pending list, Reanimated checkbox, `>=44px` `Fijar hora`, dynamic slot suggestions | M3, M4 | `ORIGINAL_REQUEST.md`, `AUDITORIA_V9.md` |
| 11 | Anti-Stress Daily Rollover & 3-Day Rule | Multi-day elapsed rollover, `[ De ayer ]` pill, 3-day alert + 10-day stale idea alerts | M1, M2 | `README.md`, `DEVELOPMENT.md` |
| 12 | Non-Intrusive Notification Bell | Header bell popover with outside-click backdrop & `>=44px` rescue actions | M3 | `README.md`, `DEVELOPMENT.md` |
| 13 | Auto-Grouped Ideas Drawer & `.md` Notes Editor | Group management, rich rendered Markdown preview (incl. interactive checklists), cross-platform `.md` disk export | M4 | `ORIGINAL_REQUEST.md`, `DEVELOPMENT.md` |
| 14 | Responsive 4-Tab Mobile + 3-Panel Desktop Cockpit | Custom Flexbox bottom nav (`allowFontScaling={false}`), `Ctrl+B` collapsible sidebar, dynamic desktop focus capsule | M3 | `ORIGINAL_REQUEST.md`, `AUDITORIA_V9.md` |
| 15 | Global Floating Toast | Ephemeral `4.2s` Reanimated toast with safe-area mobile offset & `[Fijar hora]`/`[Deshacer]` | M3 | `AUDITORIA_V9.md`, `constants/theme.ts` |
| 16 | Kuro-Zen 6-Theme Engine & `ThemePicker` | Fix `'murasaki'` reset bug, sync `global.css` & `app.json`, remove `bg-black/65`, WCAG AA/AAA compliance | M1, M3 | `ORIGINAL_REQUEST.md`, `constants/themes.ts` |
| 17 | Zen Typography & "Ma" Visual Calm | `Plus Jakarta Sans` + `JetBrains Mono`, `>=12px` text, `>=44px` touch targets, Reanimated transitions, dead-code cleanup | M3, M4 | `ORIGINAL_REQUEST.md`, `DEVELOPMENT.md` |
| 18 | SQLite Schema/Migrations, Sync Engine & MCP Server | Versioned SQLite relational schema, `SyncEngine` outbox/conflict resolution, headless Node MCP tool/resource server | M1, M2 | `ORIGINAL_REQUEST.md`, `README.md` |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Domain Contracts, Persistence Migrations, Rollover, Theme Store & Test Tooling | Extract `types/daycraft.ts`; build `services/db/sqlite.ts` + `migrations.ts` (`PRAGMA user_version` v1, relational tables + KV migration + Web/Memory parity); fix `rolloverEngine.ts`; fix `useThemeStore.ts` `'murasaki'` bug; install dependencies (`vitest`, `expo-haptics`, `expo-file-system`, `expo-sharing`) & configure `npm test` / `npm run test:e2e`. | none | IN_PROGRESS |
| M2 | Dual Gemini AI Parser, Sync Engine, MCP Server & Store Integration | Upgrade `services/ai/geminiClient.ts` (Function Calling multi-intent + fixed 0ms local fallback); build `services/sync/syncEngine.ts`; build `services/mcp/` (headless Node MCP tools/resources); integrate into `store/useDayCraftStore.ts` with backward-compatible UI contracts. | M1 | PLANNED |
| M3 | Kuro-Zen Design System, Layout Shell, Navigation, Smart Intake & Global UI | Fix `global.css`, `app.json`, `constants/theme.ts`, `ThemePicker.tsx`; upgrade `app/_layout.tsx`, `app/(tabs)/_layout.tsx` (mobile nav `allowFontScaling={false}`, dynamic afternoon capsule, `Ctrl+B` sidebar), `SmartIntakeBar.tsx`, `PendingItem.tsx`, `BellDropdown.tsx`, `FloatingToast.tsx` with Reanimated v4, `>=12px` fonts, `>=44px` hit areas; remove unused `Badge.tsx`/`Button.tsx`. | M1 | PLANNED |
| M4 | 24h Timeline Rail, Slot Picker, Ideas `.md` Editor & All 4 Tab Screens | Cross-platform Gesture Handler + Reanimated + Haptics 15m long-press drag in `Rail24h.tsx`, overlap columns, collapsible `00:00–06:00` band; Reanimated `EventCard.tsx`; `DayStrip.tsx` ergonomics; dynamic free slots in `slot-picker.tsx`; `IdeaNoteModal.tsx` rich Markdown preview + cross-platform `.md` disk export + Reanimated; polish `index.tsx`, `pending.tsx`, `chat.tsx`, `ideas.tsx`; remove dead `TimeSlot.tsx`. | M1 | PLANNED |
| E2E | E2E Testing Track (Parallel) | Author `TEST_INFRA.md` and opaque-box Tiers 1–4 suite in `tests/e2e/` covering all 18 features, publishing `TEST_READY.md`. | none (runs parallel; uses `M1` test runner) | IN_PROGRESS |
| M5 | Final Milestone: E2E Pass (Tiers 1–4) & Adversarial Hardening (Tier 5) | Phase 1: Pass 100% of Tiers 1–4 E2E suite + `npm run typecheck` + `npm test`. Phase 2: Dedicated Tier 5 Challenger-initiated white-box adversarial coverage hardening. | M2, M3, M4, E2E (`TEST_READY.md`) | PLANNED |

---

## Interface Contracts (Locked — Contract-First Governance)

### 1. `types/daycraft.ts` (Pure TypeScript — NO `react-native` imports)
Re-exported from `services/db/sqlite.ts` for backward compatibility.
- Preserves existing fields of `RecurrenceFrequency`, `EventRecurrenceRule`, `TimelineEvent`, `PendingTask`, `IdeaItemData`, `IdeaGroup`, `ChatMessage`, `AppAlert`, `DayInfo`, `IntakeIntentKind`, `ParsedIntakeAction`, `PersistedGeminiConfig`, `RolloverEvaluationResult`.
- Adds **optional** sync/lifecycle metadata to entity types (`TimelineEvent`, `PendingTask`, `IdeaItemData`, `IdeaGroup`, `ChatMessage`, `AppAlert`):
  - `updatedAt?: string;` (ISO-8601)
  - `deletedAt?: string | null;`
  - `syncStatus?: 'synced' | 'pending' | 'conflict';`
  - `version?: number;`
- `PendingTask` adds optional `archived?: boolean;`.
- `ParsedIntakeBatch`: `{ items: ParsedIntakeAction[]; aiReply: string; source: 'gemini' | 'local'; }`.
- `SyncStatusKind = 'offline' | 'syncing' | 'synced' | 'error'`.
- `SyncState`: `{ status: SyncStatusKind; pendingCount: number; lastSyncedAt: string | null; lastError: string | null; }`.
- `SyncOutboxEntry`: `{ id: string; entityType: 'event' | 'pending' | 'idea_group' | 'idea' | 'chat' | 'alert'; entityId: string; operation: 'upsert' | 'delete'; payload: string; createdAt: string; attempts: number; }`.
- `DayCraftSnapshot`: `{ events: TimelineEvent[]; pendingTasks: PendingTask[]; ideaGroups: IdeaGroup[]; chatMessages: ChatMessage[]; alerts: AppAlert[]; lastOpenedDate: string | null; geminiConfig: PersistedGeminiConfig; seedInitialized: boolean; }`.
- `DayCraftRepository` interface: async CRUD/snapshot/KV/outbox methods decoupled from `expo-sqlite` so Native (`expo-sqlite`), Web (`localStorage`/IndexedDB), In-Memory (tests), and Node (`mcp`) share one contract.

### 2. `store/useThemeStore.ts`
- `ThemeName` & `THEME_ORDER`: exposes the 6 Kuro-Zen themes `['granate', 'murasaki', 'sumi', 'aizome', 'bosque', 'shiro']` (and supports `'akane'` in `THEMES` if looked up).
- `hydrateTheme()` MUST NOT overwrite `'murasaki'` to `'granate'`. Only fall back to `DEFAULT_THEME` (`'granate'`) when `!saved || !THEMES[saved]`.

### 3. `store/useDayCraftStore.ts`
- Preserves all existing state properties and actions consumed by `app/` and `components/`.
- Additive-only extensions allowed if non-breaking:
  - `syncState: SyncState` + `triggerSync: () => Promise<void>`
  - `activeIdeaGroupId: string | null` + `setActiveIdeaGroupId: (id: string | null) => void`
- `submitSmartIntake` supports multi-intent `ParsedIntakeBatch` (`items[]`) and assigns deterministic unique IDs (`${prefix}-${Date.now()}-${counter}`) so toast `"Fijar hora"` for ideas carries `itemId`.

### 4. `constants/theme.ts` & `constants/themes.ts` (Shared UI Layout Contract)
- `LAYOUT`:
  - `desktopBreakpoint: 900`
  - `hourHeightMobile: 64` (`16px` per 15m quarter)
  - `hourHeightDesktop: 72` (`18px` per 15m quarter)
  - `railPaddingHorizontal: 16`
- All UI components MUST use semantic Kuro-Zen tokens (`canvas`, `header`, `card`, `raised`, `line`, `line-subtle`, `ink`, `muted`, `accent`, `accent-soft`, `on-accent`, `ok`, `warm`, `info`, `now`) and NEVER raw hex/hardcoded Tailwind color classes (`bg-black`, `text-white`, `indigo-*`, etc.).
- Minimum text size: `>= 12px` across UI (`text-xs` or explicit `12px+`).
- Minimum touch target: `>= 44x44px` via layout size or `hitSlop`.

### 5. `services/mcp/` Contract
- Zero `react-native` / `expo-*` imports inside `services/mcp/`.
- Exposes MCP tools (`list_events`, `create_event`, `update_event`, `delete_event`, `list_pending`, `add_pending`, `complete_pending`, `list_ideas`, `create_idea`, `search_notes`, `smart_intake`, `get_daily_briefing`) and resources (`daycraft://timeline/today`, `daycraft://pending`, `daycraft://ideas/groups`) with JSON Schema inputs/outputs and a stdio/programmatic MCP server handler.

---

## Code Layout & Write Ownership

| Milestone | Exclusive Owned Paths (No Other Milestone May Write) |
|-----------|------------------------------------------------------|
| **M1** | `types/**`, `services/db/**`, `services/rollover/**`, `store/useThemeStore.ts`, `package.json`, `package-lock.json`, `vitest.config.ts`, `tests/unit/m1/**` |
| **M2** | `services/ai/**`, `services/sync/**`, `services/mcp/**`, `store/useDayCraftStore.ts`, `tests/unit/m2/**` |
| **M3** | `constants/**`, `global.css`, `app.json`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `components/ui/**`, `components/intake/**`, `components/pending/**`, `tests/unit/m3/**` |
| **M4** | `components/timeline/**`, `components/ideas/**`, `app/(tabs)/index.tsx`, `app/(tabs)/pending.tsx`, `app/(tabs)/chat.tsx`, `app/(tabs)/ideas.tsx`, `app/modal/slot-picker.tsx`, `tests/unit/m4/**` |
| **E2E** | `TEST_INFRA.md`, `TEST_READY.md`, `tests/e2e/**` |
