# Query patterns for /api/chat

All queries below use the Supabase JS client initialized with
`SUPABASE_SERVICE_ROLE_KEY` (server-side only, spec §11). `userId` is
resolved once per request from `ACTIVE_USER_ID` or a dev-only `?user=`
override (spec §5b).

## 1. Load memory block (spec §5b step 1)

```ts
const [{ data: user }, { data: facts }, { data: messages }, { data: state }, { data: dates }] =
  await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('facts').select('*').eq('user_id', userId)
      .order('last_referenced_at', { ascending: false }).limit(20),
    supabase.from('messages').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(15),
    supabase.from('character_state').select('*').eq('user_id', userId).single(),
    supabase.from('important_dates').select('*').eq('user_id', userId),
  ])
```

Reverse `messages` before injecting into the prompt (query comes back
newest-first for the `limit` to work, but the prompt wants chronological
order).

## 2. Append messages after the LLM reply (spec §5b step 3)

```ts
await supabase.from('messages').insert([
  { user_id: userId, role: 'user', content: userMessage },
  { user_id: userId, role: 'assistant', content: reply, mood },
])
```

## 3. Update character_state (spec §5b step 3, §9 step 9)

```ts
await supabase.from('character_state')
  .update({
    mood,
    interaction_count: state.interaction_count + 1,
    last_seen_at: new Date().toISOString(),
    relationship_level: nextRelationshipLevel(state), // pure function, see below
    streak_days: computeStreak(state.last_seen_at, state.streak_days),
  })
  .eq('user_id', userId)
```

`character_state` has a unique `user_id` (spec §5b) — one row per user,
created when the user is seeded (see `commands/seed-data.md`), never
inserted by `/api/chat` itself.

## 4. Upsert new facts (spec §5b step 3, "fact extraction")

```ts
for (const content of newFacts) {
  const { data: existing } = await supabase.from('facts')
    .select('id').eq('user_id', userId).ilike('content', content).maybeSingle()
  if (existing) {
    await supabase.from('facts').update({ last_referenced_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    await supabase.from('facts').insert({ user_id: userId, content, category: 'other' })
  }
}
```

Keep this conservative (spec §5b: "only real, lasting facts, deduped
against existing ones") — the LLM call itself is responsible for not
inventing facts; this code is just responsible for not duplicating them.

## Relationship level mapping (spec §5b "Relationship levels")

Keep this as a small pure function so it's independently testable:

```ts
function relationshipLevel(interactionCount: number): 1 | 2 | 3 | 4 {
  if (interactionCount < 5) return 1   // New
  if (interactionCount < 20) return 2  // Warming up
  if (interactionCount < 60) return 3  // Close
  return 4                             // Best friend / partner
}
```

Tune the thresholds during step 9 (spec §9) once real usage data exists —
these are starting guesses, not settled numbers.
