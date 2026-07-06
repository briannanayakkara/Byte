---
name: supabase-patterns
description: Schema, RLS, and query patterns for the Byte project's Supabase memory layer (spec section 5b). Use when touching anything in /api related to users, facts, messages, character_state, or important_dates.
---

The full schema and memory-flow design is spec §5b — read it first if you
haven't. This skill holds the operational detail:

- `references/rls-policies.md` — how RLS is configured for v1 (service-role
  bypass, no browser-side Supabase client) and what changes when real auth
  is added later.
- `references/query-patterns.md` — the actual read/write query shapes
  `/api/chat` needs each turn (load memory block, append messages, upsert
  facts, update `character_state`).

Non-negotiable rules (spec §4, §5b):

1. The browser **never** talks to Supabase directly — only `/api/chat` does,
   using the service-role key.
2. Every query filters by `user_id`. No exceptions, even for the test user.
3. RLS is enabled on all five tables even though the service-role key
   bypasses it — it's the guardrail for when real auth ships later.
