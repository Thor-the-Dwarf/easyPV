---
name: auto-smoke-tests
description: Use when the user wants fast, low-risk automated tests for web games in databases. Creates and runs global plus local smoke checks that focus on reachability and basic file health, without deep or brittle assertions.
---

# Auto Smoke Tests

Use this skill for a lightweight "first play" quality gate.

## Goal
- Keep tests simple.
- Verify that game folders are reachable and minimally healthy.
- Avoid over-testing in early phases.

## Workflow
1. Prepare folder structure and local tests:
- `node databases/testing/scripts/bootstrap-testing-folders.mjs`

2. Run all smoke tests (global + local):
- `node databases/testing/scripts/run-smoke-tests.mjs`

3. Report only high-signal results:
- Number of discovered `__02_doing_*` folders.
- Number of discovered `__03_testing_*` folders.
- Pass/fail with first blocking error.

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
- If asked for deeper checks, propose a second stage (integration or Playwright interactions).
