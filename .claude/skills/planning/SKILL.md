---
name: planning
description: How to plan work on Byte -- the numbered build order in docs/specs/Byte-app-spec.md section 9 IS the master plan. Use before starting any step, or when the user asks what's next.
---

This project already has a plan: spec §9's 14-step build order. Don't
re-plan the whole project — plan **one step at a time**, in order, and stop
for verification after each (this is an explicit user requirement, not a
suggestion).

When planning a specific step:

1. Re-read that step's line in spec §9 plus whatever section it references
   (e.g. step 7 references §5b's "memory read" flow).
2. Use `references/plan-template.md` for the shape of the plan.
3. Name the step's own "verify" criterion explicitly — every step in §9 has
   one, and it's the actual definition of done.
4. Surface ambiguity or anything requiring an install not already in the
   spec's tech stack table (§3) rather than deciding silently.

Don't skip ahead — e.g. don't wire Supabase (step 6) while doing text chat
(step 4) just because it'd be "more efficient." The user explicitly wants
each step independently verifiable before the next begins.
