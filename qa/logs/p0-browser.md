# P0 browser smoke log

Date: 2026-09-20

Environment: Codex in-app browser, `http://127.0.0.1:4173/`, Vite dev server.

- PASS: Today page renders real DOM headings, priority task, task rows, progress card and a labeled `Northstar Core` region.
- PASS: `开始专注` updates the task through the local domain store.
- PASS: `记录进度` opens a modal with result, actual minutes and factual note; saving returns to Today.
- PASS: `演示数据` restores the fictional demo snapshot.
- PASS: theme control renders a distinct light surface and dark surface; Core fallback asset path remains theme-specific.
- PASS: navigation reaches `战略与计划`; capacity control and automatic-adjust authorization are visible.
- PASS: the Core accessibility label changes between `实时程序化核心` and `静态核心显示` according to the renderer path.

Viewport smoke was observed in the embedded browser. Native Windows DPI and Tauri runtime remain unverified; see `KNOWN_LIMITATIONS.md`.
