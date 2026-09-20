# Northstar Round 2 visual QA

Date: 2026-09-20
Preview: http://127.0.0.1:4173/

## Reference inputs

- `Northstar_UI_Core_Assets_Pack.zip` SHA-256: `E05D62D2C322C9CE0589AD1F59A0E611B3CF69A4B65C8EC07944F3FCA204125F`
- Reviewed `ui_refs/01_today_dark_main.png`, `02_weekly_review_dark.png`, `03_ai_strategy_session_dark.png`, `05_today_light.png`, `06_core_evolution_system.png`.
- Reviewed `specs/MOTION_SPEC.md`, `specs/EVOLUTION_AND_STATE_RULES.md`, and `specs/CODEX_PROMPT.txt`.

## Verified in the Windows local Vite preview

- Today opens with one dominant priority, clear progress, and a restrained Core side rail.
- Weekly Review exposes fact, KEEP, STOP, and CHANGE sections with a proposal action.
- AI Strategy Session exposes the local context boundary, Core session state, tabs, prompt input, and canned local response.
- AI input appends a local user message and Core response; no network/API call is required.
- Dark/light theme toggle keeps the same hierarchy.
- Reduced-motion toggle changes Core to static fallback mode and shows the reduced-motion status.
- Normal mode renders a live WebGL canvas with `aria-label="实时程序化核心"`; two screenshots 260 ms apart differed in 21 byte positions and browser logs reported no errors or warnings.
- Browser AX inspection confirmed Focused/Flow state labels and Stage I–V evolution rail.

## Limits

- This round verified the responsive local preview at the available in-app browser viewport. Full 1600x1000, 1280x800, and 1024x720 desktop acceptance screenshots were not captured in this pass.
- Windows native Tauri launcher and real external model credentials were not exercised in this UI pass; they remain unverified.
