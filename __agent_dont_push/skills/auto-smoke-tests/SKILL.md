---
name: auto-smoke-tests
description: Use when the user wants automated web-game quality checks in databases, including smoke tests and on-demand advanced gameplay/UI/visual checks. Especially use this after edits in _g*/_gs_*/game_* files to run relevant tests quickly.
---

# Auto Smoke Tests

Use this skill for a lightweight "first play" gate plus optional advanced checks.

## Goal
- Keep tests simple.
- Verify that game folders are reachable and minimally healthy.
- Avoid over-testing in early phases.

## Workflow (Stage 1: Smoke)
1. Prepare folder structure and local tests:
- `node databases/_testing/scripts/bootstrap-testing-folders.mjs`

2. Run all smoke tests (global + local):
- `node databases/_testing/scripts/run-smoke-tests.mjs`

3. Report only high-signal results:
- Number of discovered `__02_doing_*` folders.
- Number of discovered `__03_testing_*` folders.
- Pass/fail with first blocking error.

## Workflow (Stage 2: Advanced on demand)
Use this after edits in `_g*`, `_gs_*`, or `game_*` files.

1. Run advanced coverage (gameplay behavior, scoring-data presence, UI interaction errors, visual frame sanity):
- `node databases/_testing/scripts/run-advanced-web-tests.mjs`

2. Run only relevant tests for current `_g*` changes:
- `node databases/_testing/scripts/run-relevant-tests-on-g-change.mjs`

## Test Scope
- Global tests:
- every `__02_doing_*` folder contains at least one `game_*.{html,js,json}` file
- each `game_*.html` only references local relative assets

- Local tests (inside each `__03_testing_*`):
- sibling `__02_doing_*` exists
- sibling has at least one `game_*.{html,js,json}` file

## Guardrails
- Do not add fragile UI pixel assertions in this mode.
- Do not block delivery for non-critical style issues.
- For `_g*` file changes, run relevant smoke + advanced checks before finishing.
