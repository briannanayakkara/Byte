---
description: Plan the next unbuilt step from the spec's build order (section 9)
argument-hint: [step number, optional — defaults to the next unbuilt step]
---

Determine the next unbuilt step from `docs/specs/Byte-app-spec.md` §9 (check
git history / current code to see what's already done — don't just trust the
last conversation). If `$ARGUMENTS` names a specific step number, plan that
one instead.

Dispatch to the `planner` subagent (`.claude/agents/planner.md`) to produce
the plan. Do not start implementing — this command only plans. Remind the
user of the project's rule: **one step at a time, stop and verify before
continuing.**
