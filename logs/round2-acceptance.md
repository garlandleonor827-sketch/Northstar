# Round 2 acceptance report

Date: 2026-09-20
Scope: P0 visual/Core refactor on the existing Northstar local development build. This report follows `ACCEPTANCE.md`; it does not treat reference-rule tests as full application acceptance.

## Stage result

- **P0: PASS** — Today dark/light hierarchy, no-Key local demo, responsive usable page, procedural Core, static fallback, and browser interaction checks completed.
- **P1–P3: PARTIAL / BLOCKED** — Existing domain and contract tests pass, but full end-to-end UI persistence, SQLite restart, memory, export/import, and provider error paths were not re-run in this visual round.
- **P4: BLOCKED** — Full Windows native launch, DPI matrix, and the complete acceptance viewport set were not exercised in this pass.

## Acceptance matrix

| ID | Status | Evidence / boundary |
|---|---|---|
| A01 | BLOCKED | Full initialize → execute → review → restart path not re-run. |
| A02 | PASS | Contract suite covers capacity hard bound and preservation rules; 45/45 pass. |
| A03 | BLOCKED | Full recovery conflict UI path not re-run. |
| A04 | BLOCKED | Full mainline replacement UI path not re-run. |
| A05 | PASS | Backend contract tests reject protected goal/financial/history/permission edits. |
| A06 | PASS | Idempotency, same-ID content mismatch, and stale version tests pass. |
| A07 | PASS | Batch rollback, crash-safe semantics, and undo conflict tests pass. |
| A08 | BLOCKED | Full 14-day idea cooling workflow not re-run. |
| A09 | PASS | Unknown/coverage/recovery semantics tests pass. |
| A10 | BLOCKED | Full memory confirmation/deletion/backup exclusion path not re-run. |
| A11 | PASS | Reward de-duplication, caps, correction, and recovery XP tests pass. |
| A12 | BLOCKED | Mock provider matrix not exercised in this round. |
| A13 | BLOCKED | Real provider error matrix requires a configured endpoint/key. |
| A14 | PASS | API-root, loopback consent, remote-host, and credential-in-URL contract tests pass. |
| A15 | BLOCKED | Windows Credential Manager and full persistence scan not exercised here. |
| A16 | BLOCKED | Export/import round-trip not re-run. |
| A17 | BLOCKED | Dark/light passed in preview; 1600×1000, 1280×800, 1024×720 plus 125%/150% DPI were not captured in this pass. |
| A18 | PASS | Live WebGL canvas detected; frame pixels changed between captures; reduced-motion/static fallback verified; browser logs clean. |
| A19 | BLOCKED | Full keyboard/focus/contrast/error-state matrix not re-run. |
| A20 | BLOCKED | Timezone/cross-midnight/restart timer path not re-run. |
| A21 | BLOCKED | Financial snapshot path not re-run. |
| A22 | BLOCKED | Full disconnected application path not re-run. |
| A23 | BLOCKED | Native Windows/Tauri startup and credential/SQLite migration acceptance not exercised in this UI round. |
| A24 | BLOCKED | No real API key/authorized endpoint was available; mock evidence is not counted as real pass. |

## Verification logs

- `logs/round2-test-log.txt` — typecheck, production build, unit tests, contract tests, bundle integrity.
- `logs/round2-visual-qa.md` — local preview interaction and Core visual evidence.
- `logs/round2-assets-review.md` — reference pack inventory and hash.
