---
description: Systematically debug and fix a described issue
argument-hint: <description of what's broken>
---

Issue: $ARGUMENTS

Dispatch to the `debugger` subagent (`.claude/agents/debugger.md`) to find
the root cause — it knows this stack's common failure modes (R3F canvas
issues, Web Speech API quirks, `/api/chat` errors, Supabase/RLS query
issues). Do not patch symptoms; confirm the root cause before fixing.

After a fix, run the `test-runner` subagent (`.claude/agents/test-runner.md`)
to confirm `npm run build` and `npm run lint` still pass.
