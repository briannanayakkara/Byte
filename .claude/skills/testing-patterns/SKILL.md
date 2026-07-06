---
name: testing-patterns
description: Testing approach for the Byte project — no framework chosen yet at step 1, this documents the plan and a scaffold script. Use once tests are actually being added (likely around step 5, when /api/chat has real logic worth unit-testing).
---

No test framework is installed yet (step 1 only sets up the app shell). Plan:

- **Unit tests: Vitest.** Pairs naturally with Vite, near-zero config. Good
  fit for pure logic that's easy to isolate: `relationshipLevel()`,
  `computeStreak()`, the JSON-parse-with-fallback logic in `/api/chat`
  (spec §5), fact dedup logic (spec §5b).
- **Don't unit test the R3F/Three.js rendering itself** — blend shape
  weights and camera framing are much better verified visually (the spec's
  own "verify" checkpoints per step, §9) than asserted against in a DOM-less
  test environment.
- **E2E (later, optional):** Playwright, if the text-chat + voice flows need
  regression coverage once the personality/memory logic stabilizes. Not
  needed for v1.

`scripts/gen-test.py` scaffolds a Vitest test file for a given module path —
run it once Vitest is actually installed (it doesn't install anything
itself, just writes the boilerplate file).
