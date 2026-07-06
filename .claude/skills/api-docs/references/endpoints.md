# POST /api/chat

The only endpoint the browser ever calls (spec §4). Holds `LLM_API_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` server-side; the browser never sees either.

## Request

```ts
type ChatRequest = {
  message: string
  // last ~6 messages of in-browser session history (spec §5) — separate
  // from the ~15-message Supabase history the server loads itself
  history: { role: 'user' | 'assistant'; content: string }[]
}
```

`userId` is **not** sent by the browser in v1 — the server resolves it from
`ACTIVE_USER_ID`, with an optional `?user=<id>` query param override for the
test user during development (spec §5b). This keeps the client from ever
needing to know or send a `user_id`.

## Response (success)

```ts
type ChatResponse = {
  reply: string
  mood: 'happy' | 'curious' | 'sleepy' | 'excited' | 'confused' | 'neutral' | 'lovestruck'
}
```

`new_facts` (spec §5b) is consumed and upserted into Supabase server-side —
it is **not** part of the response the browser receives; the client only
needs `reply` and `mood`.

## Response (LLM output failed to parse as JSON)

Per spec §5: "Fall back to `neutral` mood + raw text if parsing fails."

```ts
{ reply: rawText, mood: 'neutral' }
```

This is still a `200` — a parse failure is not a request failure from the
client's point of view.

## Response (actual server error — LLM/Supabase call failed)

`5xx`. The client's error handling (spec §8) shows `confused` mood + a
fixed in-character line ("aw beans, my brain short-circuited...") — it does
not need the error body to contain anything specific, so keep server error
bodies minimal and never leak stack traces or key names in them.

## Server-side flow per request (spec §5b "How memory flows each turn")

1. Resolve `userId`.
2. Load memory block from Supabase (`query-patterns.md` §1).
3. Build system prompt = base personality (spec §10) + injected memory block
   (spec §5b "Memory-aware system prompt").
4. Call the LLM with `history` + `message`.
5. Parse JSON response; strip code fences; fall back to raw text + neutral
   on failure.
6. Save messages, update `character_state`, upsert `new_facts`
   (`query-patterns.md` §2-4) — best-effort; a failure here should not fail
   the response back to the browser, since the user is already waiting on
   the reply.
7. Return `{ reply, mood }`.
