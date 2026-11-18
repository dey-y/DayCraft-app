# DayCraft AI — E2E Test Infrastructure (`TEST_INFRA.md`)

> **Track**: E2E Testing Track (Requirement-Driven, Opaque-Box)
> **Scope**: All **18 features** in `PROJECT.md § Feature Inventory` across Tiers 1–4
> **Authoritative Specs**: `ORIGINAL_REQUEST.md`, `PROJECT.md`, `README.md`, `DEVELOPMENT.md`, `AUDITORIA_V9.md`, `constants/themes.ts`, `docs/mockups/palette-dark-japandi.html`

---

## 1. Philosophy & Opaque-Box Boundaries

1. **Requirement-Driven Opaque Box**: Every test in `tests/e2e/` is derived from `PROJECT.md` locked contracts and product/UX specifications—never from internal implementation shortcuts.
2. **Expected Output Derivation**: Every assertion traces to an authoritative source:
   - Domain & API contracts in `PROJECT.md § Interface Contracts`
   - UX & anti-redundancy rules in `AUDITORIA_V9.md` and `README.md`
   - Technical & behavioral specifications in `DEVELOPMENT.md`
   - Kuro-Zen color tokens & WCAG AA/AAA math in `constants/themes.ts` and `docs/mockups/palette-dark-japandi.html`
3. **Zero Facade Tests**: Tests exercise real persistence repositories, stores, AI parsers, rollover evaluators, sync queues, MCP tool/resource handlers, theme stores, contrast ratios, and UI contract invariants.
4. **No Mocking of System Under Test**: Only external boundaries (`globalThis.fetch` for Gemini HTTP API, `localStorage` polyfill in Node, `react-native` minimal runtime shim for Node Vitest execution, fake timers for multi-day rollover) are adapted in test setup. DayCraft services, stores, and parsers run live.
5. **Write Ownership**: The E2E Testing Track writes ONLY `TEST_INFRA.md`, `TEST_READY.md` (published by orchestrator), and `tests/e2e/**`.

---

## 2. Feature Inventory & Traceability Matrix (N = 18)

| ID | Feature | Milestone | Authoritative Spec | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|----|---------|-----------|--------------------|--------|--------|--------|--------|
| **F01** | Universal Smart Intake Bar | M3, M2 | `README.md`, `AUDITORIA_V9.md` | T1-F01-01..05 | T2-F01-01..05 | T3-01, T3-02, T3-03, T3-05, T3-16, T3-19 | S1, S7 |
| **F02** | Real Voice Dictation (`es-ES`) | M3 | `DEVELOPMENT.md` §12.3 | T1-F02-01..05 | T2-F02-01..05 | T3-03 | S1 |
| **F03** | Dual Gemini + Local NLP Parser | M2 | `ORIGINAL_REQUEST.md`, `DEVELOPMENT.md` | T1-F03-01..05 | T2-F03-01..05 | T3-01, T3-02, T3-04, T3-18 | S1, S7 |
| **F04** | AI Settings Modal (`gemini_config_v9`) | M4 | `DEVELOPMENT.md` §12.3 | T1-F04-01..05 | T2-F04-01..05 | T3-04 | S7 |
| **F05** | 24h Vertical Timeline Rail (`Rail24h`) | M4 | `AUDITORIA_V9.md`, `DEVELOPMENT.md` | T1-F05-01..05 | T2-F05-01..05 | T3-11, T3-12 | S2, S9 |
| **F06** | Interactive 15m Tap & Drag Time-Blocking | M4 | `ORIGINAL_REQUEST.md`, `DEVELOPMENT.md` | T1-F06-01..05 | T2-F06-01..05 | T3-11 | S2, S10 |
| **F07** | Full Block Editing & Deletion (`slot-picker` + `EventCard`) | M4 | `ORIGINAL_REQUEST.md`, `DEVELOPMENT.md` | T1-F07-01..05 | T2-F07-01..05 | T3-06, T3-08, T3-09, T3-11, T3-16 | S2, S4, S9 |
| **F08** | Dynamic ISO Day Strip & Infinite Scroll (`DayStrip`) | M4 | `DEVELOPMENT.md`, `constants/theme.ts` | T1-F08-01..05 | T2-F08-01..05 | T3-11, T3-12, T3-13, T3-20 | S9 |
| **F09** | Empathetic Empty-Day Messages | M4 | `README.md`, `DEVELOPMENT.md` | T1-F09-01..05 | T2-F09-01..05 | T3-13 | S3, S9 |
| **F10** | Unscheduled Pending Tasks & Smart Slot Picker | M3, M4 | `ORIGINAL_REQUEST.md`, `AUDITORIA_V9.md` | T1-F10-01..05 | T2-F10-01..05 | T3-06 | S2, S3 |
| **F11** | Anti-Stress Daily Rollover & 3-Day Rule | M1, M2 | `README.md`, `DEVELOPMENT.md` | T1-F11-01..05 | T2-F11-01..05 | T3-07, T3-08, T3-20 | S3 |
| **F12** | Non-Intrusive Notification Bell (`BellDropdown`) | M3 | `README.md`, `DEVELOPMENT.md` | T1-F12-01..05 | T2-F12-01..05 | T3-07, T3-08 | S3 |
| **F13** | Auto-Grouped Ideas Drawer & `.md` Notes Editor | M4 | `ORIGINAL_REQUEST.md`, `DEVELOPMENT.md` | T1-F13-01..05 | T2-F13-01..05 | T3-05, T3-09, T3-10, T3-18 | S4 |
| **F14** | Responsive 4-Tab Mobile + 3-Panel Desktop Cockpit | M3 | `ORIGINAL_REQUEST.md`, `AUDITORIA_V9.md` | T1-F14-01..05 | T2-F14-01..05 | T3-19 | S10 |
| **F15** | Global Floating Toast | M3 | `AUDITORIA_V9.md`, `constants/theme.ts` | T1-F15-01..05 | T2-F15-01..05 | T3-01, T3-02, T3-10 | S1, S2 |
| **F16** | Kuro-Zen 6-Theme Engine & `ThemePicker` | M1, M3 | `ORIGINAL_REQUEST.md`, `constants/themes.ts` | T1-F16-01..06 | T2-F16-01..05 | T3-14, T3-15 | S8, S10 |
| **F17** | Zen Typography & "Ma" Visual Calm | M3, M4 | `ORIGINAL_REQUEST.md`, `DEVELOPMENT.md` | T1-F17-01..05 | T2-F17-01..05 | T3-15 | S10 |
| **F18** | SQLite Schema/Migrations, Sync Engine & MCP Server | M1, M2 | `ORIGINAL_REQUEST.md`, `README.md`, `PROJECT.md` | T1-F18-01..06 | T2-F18-01..06 | T3-14, T3-16, T3-17, T3-18, T3-20 | S5, S6, S8 |

---

## 3. Test Architecture (`tests/e2e/`)

```
tests/e2e/
├── helpers/
│   ├── contracts.ts         # Locked PROJECT.md contract types & layout invariants
│   ├── contractLoader.ts    # Dynamic module loader (graceful missing-milestone errors)
│   └── runtimeEnv.ts        # Node/Vitest shims (localStorage, RN Platform, fetch mock, WCAG math, source scanner)
├── tier1_features.e2e.test.ts    # 92 happy-path & contract tests (>= 5 per feature)
├── tier2_boundaries.e2e.test.ts  # 91 boundary, edge & error-handling tests (>= 5 per feature)
├── tier3_pairwise.e2e.test.ts    # 20 cross-feature pairwise integration tests (>= 18)
└── tier4_scenarios.e2e.test.ts   # 10 full end-to-end real-world user scenarios (>= 9)
```

### Coverage Thresholds
For `N = 18` features:
- **Tier 1 (Feature Coverage)**: `>= 5 * N = 90` tests → **92 tests implemented**
- **Tier 2 (Boundary & Corner Cases)**: `>= 5 * N = 90` tests → **91 tests implemented**
- **Tier 3 (Cross-Feature Pairwise)**: `>= N = 18` tests → **20 tests implemented**
- **Tier 4 (Real-World Scenarios)**: `>= max(5, N/2) = 9` scenarios → **10 scenarios implemented**
- **Total Target**: `~11 * N + max(5, N/2) = 207` → **213 tests implemented**

---

## 4. Execution Commands & Pass/Fail Semantics

```bash
# Run full E2E suite (Tiers 1-4)
npm run test:e2e

# Run directly via Vitest
npx vitest run tests/e2e

# Run individual tier
npx vitest run tests/e2e/tier1_features.e2e.test.ts
npx vitest run tests/e2e/tier2_boundaries.e2e.test.ts
npx vitest run tests/e2e/tier3_pairwise.e2e.test.ts
npx vitest run tests/e2e/tier4_scenarios.e2e.test.ts

# Static TypeScript verification (must remain 0 errors)
npm run typecheck
```

### Pass/Fail Semantics
- **Pass**: `vitest run tests/e2e` exits `0` with 100% of executed tests passing and `npm run typecheck` exits `0`.
- **Fail During Parallel Implementation (M1–M4)**: Any test targeting an unimplemented M1–M4 deliverable (e.g., `services/sync/syncEngine.ts`, `services/mcp/`, `'murasaki'` hydration fix, `bg-black/65` removal, `>=12px` font audit) fails explicitly with a clear contract or assertion failure—never skipped or stubbed to pass.
- **M5 Gate**: All 213 Tiers 1–4 tests + Tier 5 adversarial tests MUST pass at 100% before production sign-off.

---

## 5. Known Variances (Non-Deterministic Fields)

- **Generated Entity IDs**: Store/repository IDs (`ev-*`, `pending-*`, `idea-*`, `msg-*`, `alert-*`, `grp-*`) incorporate timestamps/counters. Tests assert prefix/uniqueness/non-empty string shape rather than exact literal timestamps.
- **Wall-Clock Dates**: Tests requiring multi-day elapsed transitions or deterministic relative day math (`"hoy"`, `"mañana"`, `nowMinutes`) use `vi.useFakeTimers()` / `vi.setSystemTime(...)` or compare against `getTodayKey()` / `getDateKeyWithOffset(...)`.
- **UI Rendering in Node**: Since Vitest executes in Node without a native iOS/Android device or browser DOM, UI-layer contracts (Kuro-Zen semantic token discipline, zero hardcoded colors, `>= 12px` fonts, `>= 44px` touch targets, `allowFontScaling={false}`, `Ctrl+B`, Reanimated/Gesture Handler/Haptics integration, Markdown preview & disk export) are verified via static AST/regex inspection of `app/**/*.tsx` and `components/**/*.tsx` combined with live store/theme/contrast execution.
