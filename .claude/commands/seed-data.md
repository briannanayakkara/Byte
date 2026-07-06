---
description: Seed the Supabase users table with the real user + test user (spec section 9, step 6)
---

Per spec §9 step 6 and §5b: insert exactly two rows into `users` —

1. The real person (`is_test = false`) — ask for name/nicknames/birthday if
   not already known; this row's `id` becomes `ACTIVE_USER_ID` in `.env`.
2. A test user (`is_test = true`) — safe to experiment on freely; can be
   selected during development via a `?user=` override (spec §5b) without
   touching the real person's memory.

Use `skills/supabase-patterns/references/query-patterns.md` for the actual
insert pattern and `references/rls-policies.md` to confirm RLS is enabled
before seeding. Do not seed `facts`, `messages`, or `character_state` rows —
those are created naturally by `/api/chat` on first use (spec §5b "How
memory flows each turn").

After seeding, print the two `id` values and remind the user to set
`ACTIVE_USER_ID` in `.env` to the real person's id.
