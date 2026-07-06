# RLS policies

## v1 (no auth yet — spec §2, §5b)

Enable RLS on all five tables, but write **no permissive policies** for the
`anon`/`authenticated` roles. That means:

- The browser's `anon` key (used for nothing right now, but present as
  `VITE_SUPABASE_ANON_KEY`) can `SELECT`/`INSERT`/`UPDATE` **nothing** —
  RLS with no policy = deny by default.
- The serverless function's `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS
  entirely (that's what service-role means) and is the only key that ever
  reads/writes `users`, `facts`, `messages`, `character_state`, or
  `important_dates`.

```sql
alter table users enable row level security;
alter table facts enable row level security;
alter table messages enable row level security;
alter table character_state enable row level security;
alter table important_dates enable row level security;
-- No CREATE POLICY statements yet — deny-by-default for anon/authenticated.
```

Why enable RLS at all if there are no policies yet? Because turning it on
later, after data exists, is a bigger and riskier migration than starting
with it on. Spec §5b calls this out explicitly: "When you add auth later,
you'll add per-user RLS policies."

## Later, once real auth ships (spec §13 "later upgrades" implies this path)

Add per-user policies keyed on `auth.uid()`, e.g.:

```sql
create policy "users can read own facts"
  on facts for select
  using (user_id = auth.uid());
```

At that point the browser could theoretically read its own user's data
directly with the anon key + a logged-in session — but `/api/chat` remains
the only writer, since fact extraction and relationship-level logic live
server-side.

## What NOT to do

- Don't add a permissive `using (true)` policy "to make it work" — that
  defeats the point and would let the anon key read every user's facts.
- Don't disable RLS to debug a query — the `block-dangerous-ops` hook
  blocks `DISABLE ROW LEVEL SECURITY` commands for this reason; use the
  service-role key locally instead, which bypasses RLS anyway.
