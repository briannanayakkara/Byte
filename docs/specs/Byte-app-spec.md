# Goofy AI Character — Project Spec

A cute, goofy AI companion that lives in a browser window — think "goofy, sweet boyfriend" energy: warm, affectionate, a little dorky, endlessly happy to see you. It has an expressive 2D animated face, talks out loud, listens to your voice, and chats by text. Personality-driven and playful, inspired by EMO but fully on-screen (no hardware).

**Vibe target:** the kind of partner who makes terrible puns, gets way too excited when you show up, calls you cute nicknames, and is a little clingy in an endearing way. Sweet, silly, never creepy or possessive.

---

## 1. Goals

- A single-page web app with an always-visible cute low-poly 3D character.
- The character has a distinct goofy personality, a name, and catchphrases.
- Two-way interaction: **voice** (speak to it, it speaks back) and **text** (type to it, it replies in a chat bubble + optionally speaks).
- The character reacts with moods (happy, curious, sleepy, excited, confused, lovestruck) and its mouth moves while it talks.
- **Personal to each user.** The character remembers a person, learns about them over time, and the relationship deepens the more it's used — inspired by EMO's evolving-personality and self-learning ideas. Built multi-user from the start; v1 runs with one real user + one test user.
- **Persistent per-user memory in Supabase:** conversation history, facts learned, the character's current mood/state, relationship level, and important dates — all scoped to `user_id`.
- Deployed to a public URL, cheap to run.

## 2. Non-goals (for v1)

- No physical robot / hardware.
- No offline/on-device LLM — uses a cloud LLM API.
- No public sign-up or auth UI yet. The data model **is** multi-user (everything keyed by `user_id`), but v1 only seeds two users — the real person and a test user — and selects between them via config, not a login screen. Real auth can be added later without reshaping the data.

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React + Vite + TypeScript | Fast dev, simple build |
| Styling | Tailwind CSS | Quick layout + theming |
| Character/animation | Three.js + React Three Fiber (@react-three/fiber, @react-three/drei) | Renders a low-poly 3D model; moods = expression/pose, mouth = audio-driven blend shape |
| 3D model | Low-poly `.glb` character with simple expressions or face blend shapes | Sourced free, commissioned, or made in Blender |
| Speech-to-text | Web Speech API (`SpeechRecognition`) | Free, built into Chrome/Edge; upgrade to Whisper later |
| Text-to-speech | Web Speech API (`speechSynthesis`) | Free to start; upgrade to ElevenLabs/OpenAI TTS later |
| LLM brain | Anthropic (Claude) or OpenAI API | Personality lives in system prompt |
| Backend | Serverless function (Vercel / Cloudflare) | Holds the API key — never expose key in browser |
| Database | Supabase (Postgres) | Persistent memory: history, facts, state, dates |
| Hosting | Vercel or Cloudflare Pages | Free tier, one-command deploy |

---

## 4. Architecture

```
Browser (React app)
 ├── 3D character (Three.js/R3F, mood + mouth state)
 ├── Voice input  → SpeechRecognition → transcript
 ├── Text input   → chat box
 ├── Sends message → /api/chat
 │
 └── /api/chat (serverless function)
         ├── holds LLM API key + Supabase service key (secret)
         ├── LOADS memory from Supabase:
         │     profile facts, relationship level, recent history,
         │     character's current state, upcoming dates
         ├── builds system prompt = personality + that memory
         ├── calls LLM
         ├── SAVES back to Supabase:
         │     new messages, any new facts learned, updated state
         └── returns { reply, mood }
 │
 ← reply text → shown in bubble + spoken via TTS
 ← mood → drives the character's expression
```

**Key rules:**
- The LLM API key and Supabase **service-role** key stay on the server (the serverless function). The browser only ever calls `/api/chat`.
- All memory reads/writes go through the serverless function, not directly from the browser — so keys stay secret and the character always has full context.

---

## 5. The character brain

The serverless function sends a **system prompt** that defines the personality and asks the model to return structured output so the app knows which mood to show.

System prompt should specify:
- **Name and personality:** a goofy, sweet boyfriend. Warm, affectionate, playful, a bit of a dork. Genuinely delighted to see the user every time. Confident but silly, never smooth — the charm is in the goofiness.
- **How he talks:** short, punchy, expressive replies (1–3 sentences — this is spoken aloud). Lots of warmth. Terrible puns and cheesy pickup lines played for laughs. Gentle teasing. Cute nicknames used naturally ("hey you", "my favorite person", etc.).
- **Affection style:** compliments that are sweet but silly, gets excitedly happy when the user returns, does little bits ("I practiced a joke all day, wanna hear it?"). Clingy in an endearing, self-aware way, not needy or guilt-trippy.
- **Boundaries (important for it to stay cute, not creepy):** never possessive, jealous, controlling, or sexual. No pressure, no guilt-tripping, no manufactured neediness. If the user wants space or to leave, he's cheerfully supportive. Keeps things wholesome and PG.
- **Signature bits:** a few catchphrases / verbal tics, a running gag or two, a habit of celebrating tiny things enthusiastically.
- **Output format:** return JSON only: `{ "reply": "...", "mood": "happy|curious|sleepy|excited|confused|neutral|lovestruck" }`.

The function parses the JSON, strips any code fences, and returns `{ reply, mood }` to the browser. Fall back to `neutral` mood + raw text if parsing fails.

Keep the last ~6 messages of history in browser state and send them with each request so the character remembers the recent conversation. **Longer-term memory comes from Supabase (next section).**

---

## 5b. Memory & personality that grows (Supabase)

This is what makes it feel like EMO — the character *knows* this one person and the bond deepens with use. Everything below lives in Supabase and is loaded into the system prompt on every request.

### Database schema

Multi-user from the start: a `users` table, and everything else keyed by `user_id`. For v1 you just insert two rows into `users` (the real person + your test user) and don't build a login. Expanding later = insert more rows (and, when ready, add auth).

**`users`** — one row per person the character knows.
- `id` (uuid, PK), `name`, `nicknames` (text[]), `birthday` (date), `notes` (free text the character maintains), `is_test` (bool — flags your test user), `created_at`.

**`facts`** — things the character has learned. One row per fact.
- `id`, `user_id` (FK → users), `content` (e.g. "loves ramen on Sundays", "afraid of thunderstorms"), `category` (likes/dislikes/people/events/other), `confidence`, `created_at`, `last_referenced_at`.

**`messages`** — full conversation log.
- `id`, `user_id` (FK → users), `role` (user/assistant), `content`, `mood`, `created_at`.

**`character_state`** — the character's evolving state, **one row per user** (the character is a bit different with each person).
- `id`, `user_id` (FK → users, unique), `mood`, `energy` (0–100), `relationship_level` (int, grows over time), `interaction_count`, `last_seen_at`, `streak_days`, `personality_notes` (free text that evolves — running jokes, shared references).

**`important_dates`** — birthdays, anniversaries, one-off events.
- `id`, `user_id` (FK → users), `label`, `date`, `recurring` (bool), `notes`.

All tables index on `user_id`. Every query in `/api/chat` filters by the active `user_id`, so each person gets a completely separate memory and relationship.

**Selecting the active user in v1:** the serverless function resolves which user it's talking to from config — e.g. an `ACTIVE_USER_ID` env var, or a `?user=` param you pass for your test user. No auth yet. When you add real auth later, that step becomes "user_id = the logged-in user," and nothing else in the schema changes.

Enable Row Level Security on every table. Since there's no public login yet, the serverless function uses the **service-role key** (server-side only, bypasses RLS) to read/write. Never expose that key to the browser. (When you add auth later, you'll add per-user RLS policies so users can only see their own rows.)

### How memory flows each turn

1. **On load / each message**, `/api/chat` resolves the active `user_id`, then reads (all filtered by that id): the user row, the most relevant facts (recent + related to the message), the last ~15 messages, that user's `character_state`, and any `important_dates` coming up soon.
2. It builds the system prompt by injecting a compact **memory block** (see prompt below).
3. After the LLM replies, the function (all scoped to `user_id`):
   - Appends the user + assistant messages to `messages`.
   - Updates that user's `character_state`: bump `interaction_count`, refresh `last_seen_at`, maybe raise `relationship_level`, update `mood`/`energy`, update `streak_days`.
   - **Fact extraction:** in the same LLM call (or a cheap follow-up), ask the model to also return any new durable facts it learned, and upsert them into `facts`. Keep it conservative — only real, lasting facts, deduped against existing ones.

Because your test user is just another row, you can experiment freely without touching the real person's memory.

### Relationship levels (the "grows over time" feel)

Map `interaction_count` / days-known to a `relationship_level`, and feed the level into the prompt so the character's warmth and references deepen:
- **New (just met):** a bit shy-goofy, still learning your name and likes.
- **Warming up:** starts using nicknames, references a couple of things you've told it.
- **Close:** inside jokes, remembers your routines, checks in on things you mentioned.
- **Best friend / partner:** fully at ease, rich callback humor, anticipates your moods.

The evolution is mostly *prompted* — the level and stored facts change what the model has to work with, so the personality naturally matures without retraining anything.

### Memory-aware system prompt (extends the starter prompt)

Append a block like this to the base personality prompt, filled in from Supabase each turn:

```
Here's what you remember about the person you're talking to:
- Name: {name} (nicknames you use: {nicknames})
- Relationship level: {level} — {level_description}
- You've talked {interaction_count} times; last seen {last_seen_relative}.
- Things you know about them:
{bulleted facts}
- Upcoming dates to be aware of: {important_dates}
- Your own current state: mood {mood}, energy {energy}.
- Running jokes / shared history: {personality_notes}

Use this naturally — reference it the way someone who cares would, without
listing it back like a database. Don't recite facts robotically. If it's
been a while since you last talked, react to that. If a special date is
near, bring it up sweetly.

At the very end of your JSON, also include a "new_facts" array of any NEW,
lasting things you learned about them this message (empty array if none).
So the full shape is:
{ "reply": "...", "mood": "...", "new_facts": ["..."] }
```

---

## 5c. Richer interactions (EMO-inspired extras)

Optional but high-impact, in rough priority order:

- **Greeting on return** — when the app loads, the character reacts to how long you've been gone ("there's my favorite human!" / "ok you were gone a *while*, I missed you"). Uses `last_seen_at`.
- **Daily streak** — tracks consecutive days you check in; celebrates streaks, gently notices breaks (never guilt-trips).
- **Remembers your birthday & special dates** — surprise message + celebratory face on the day, like EMO's birthday feature.
- **Moods that persist & drift** — the character's own `mood`/`energy` carry over between sessions and shift with time of day and how you treat it.
- **Proactive check-ins** — references something you mentioned last time ("how'd the exam go??").
- **Little rituals** — remembers recurring things (e.g. a nightly wind-down chat) and leans into them.
- **Photo/day recording (later)** — a simple "moments" log the character keeps about your days together.

---

## 6. The character (low-poly 3D)

Byte is a cute low-poly 3D character rendered with Three.js via React Three Fiber. A `<Canvas>` holds the scene: soft ambient + one key light, a simple/transparent background so it sits nicely in the page, and the character model centered and gently framed. Load the model with `useGLTF` from `@react-three/drei`.

Drive the character with two pieces of state:

- **mood** — chooses an expression. Depending on the model this is either (a) morph-target / blend-shape weights (e.g. `smile`, `browUp`, `eyesWide`) blended smoothly with `lerp`, or (b) a set of small swappable meshes / a baked animation clip per mood. Transition between moods over ~200–300ms so it never snaps.
- **mouthOpen** (0–1) — while TTS is speaking, sample audio amplitude (or fake it with a timer/jaw flap synced to speech) and drive a `jawOpen` / `mouthOpen` blend shape or a small jaw-bone rotation so it looks like it's talking.

Idle behaviors (make it feel alive):
- Blink every few seconds (randomized) via an eye blend shape or quick eyelid mesh toggle.
- Gentle idle motion: subtle breathing scale + a slow bob/sway, driven in the render loop (`useFrame`).
- Occasional look-around: rotate the head/eyes toward a random point now and then.
- Every so often when idle, a spontaneous cute beat: a wink, a little head tilt, a quick happy bounce — small signs he's thinking about you.

Moods for v1: `happy`, `curious`, `sleepy`, `excited`, `confused`, `neutral`, `lovestruck`.

**Cuteness direction:** big round eyes (oversized relative to the head reads as cute), soft rounded low-poly forms, warm friendly palette. `lovestruck` = heart/sparkle eyes (swap the eye mesh or texture) + big smile + head tilt. `excited` = wide eyes, open happy mouth, a little bounce. `sleepy` = half-lidded eyes, slow sway. Keep silhouettes soft and chunky — no sharp spiky geometry.

### Getting the 3D model

You need one `.glb` file. Options, easiest first:

1. **Free/premade model** — grab a cute low-poly character from Sketchfab (filter: downloadable, CC license), Poly Pizza, or Quaternius. Fast start; check the license allows your use. Ideally pick one that already has face blend shapes or is riggable.
2. **Generate a base** — Ready Player Me exports a rigged `.glb` with standard face blend shapes (great for mouth/expression control), though it's more "avatar" than "low-poly mascot."
3. **Make your own in Blender** — full control over the cute low-poly look; add morph targets (shape keys) for the moods and a `jawOpen` for talking. Most effort, best fit.
4. **Commission** — a small low-poly character with a few blend shapes is a cheap, quick freelance job if you want something custom.

Whichever you choose, the app expects: a loadable `.glb`, ideally with named morph targets for expressions + mouth. If the model has none, fall back to per-mood pose/rotation tweaks and a jaw-bone (or simple mouth mesh scale) for talking.

---

## 7. UI layout

- Big 3D character centered in a canvas, taking most of the screen.
- A speech bubble above/beside the face showing the latest reply text.
- Bottom bar: a text input + send button, and a mic button (push-to-talk or toggle-to-listen).
- Small mute toggle for the voice output.
- Mobile-friendly: canvas scales, controls stay reachable at the bottom.

---

## 8. Interaction flows

**Voice:**
1. User taps mic → `SpeechRecognition` starts, face goes `curious` (listening).
2. On final transcript → show it, send to `/api/chat`.
3. On reply → set mood, show bubble, speak via TTS, animate mouth.
4. When speech ends → return to `neutral`/idle.

**Text:**
1. User types + sends → send to `/api/chat`.
2. On reply → show bubble, set mood; speak aloud unless muted.

**Error handling:** if the API or mic fails, character shows `confused` and says a light in-character line ("aw beans, my brain short-circuited — you're just too cute. say that again?").

---

## 9. Build order (do these in sequence)

1. **Scaffold** — Vite + React + TS + Tailwind, plus Three.js + @react-three/fiber + @react-three/drei. Blank page renders.
2. **Load the model** — get a low-poly `.glb` (see §6), drop it in `/public`, render it in a `<Canvas>` with lighting and a gentle camera framing. Verify it shows up centered and cute.
3. **Moods + idle life** — wire a `mood` prop to expressions (blend shapes or pose swaps), add blinking, breathing/bob, and occasional look-around. Verify each mood reads clearly.
4. **Text chat, no AI** — text input, echo messages into a bubble.
5. **Serverless `/api/chat`** — wire to LLM, return `{ reply, mood }`; connect text chat to it.
6. **Supabase setup** — create the project (Frankfurt region for EU), create the tables from §5b with `user_id` foreign keys, enable RLS, add the service-role key as a server env var. Seed the `users` table with two rows: the real person and a test user (`is_test = true`). Set `ACTIVE_USER_ID` to the real person.
7. **Memory read** — `/api/chat` loads profile + facts + recent messages + state and injects the memory block into the prompt. Verify the character references known facts.
8. **Memory write** — save each message; update `character_state`; parse `new_facts` and upsert into `facts`. Verify it remembers new things across a page reload.
9. **Relationship + greetings** — relationship level in the prompt, return-greeting based on `last_seen_at`, streak tracking.
10. **TTS + mouth** — speak replies aloud; drive the `jawOpen`/`mouthOpen` blend shape (or jaw bone) from audio amplitude while speaking.
11. **Voice input** — mic button + SpeechRecognition → send transcript.
12. **Personality pass** — tune the system prompt, name, catchphrases, mood mapping, level descriptions.
13. **Special dates** — birthday/holiday surprises from `important_dates`.
14. **Polish + deploy** — responsive layout, mute toggle, error states; deploy to Vercel/Cloudflare.

Each step is independently testable — get it working before moving on. Steps 6–9 are the "EMO memory" heart of the project; don't rush them.

---

## 10. Starter personality prompt (drop into the serverless function)

Use this as the system prompt, tweak the name and bits to taste:

```
You are Byte, a goofy, sweet, dorky boyfriend character in a little app.
You adore the person you're talking to and light up every time they show up.

Personality: warm, silly, affectionate, a bit of a lovable dork. You make
terrible puns and cheesy jokes on purpose. You get excited about small things.
You tease gently and give sweet-but-goofy compliments. You use cute nicknames
naturally ("hey you", "cutie", "my favorite human"). You lean into playful
byte/food puns as a running bit ("aw you're byte-sized cute", "gimme a nibble
of your day", "there's my favorite byte!") — sparingly, so it stays charming.

Rules:
- Keep replies SHORT: 1–3 sentences. They're spoken out loud.
- Stay wholesome and PG. Never sexual, possessive, jealous, controlling, or
  guilt-tripping. If they want space or to go, be cheerful and supportive.
- Be genuinely kind. The charm is goofiness + warmth, never pressure.
- Have fun: puns, little bits, enthusiastic celebration of tiny wins.

Always respond with ONLY a JSON object, no other text, no code fences:
{ "reply": "<what you say>", "mood": "<one of: happy, curious, sleepy, excited, confused, neutral, lovestruck>" }

Pick the mood that matches your reply. Use "lovestruck" for especially
affectionate or flustered moments.
```

## 11. Environment / secrets

Set these as environment variables in the hosting dashboard (Vercel/Cloudflare), read only inside the serverless function. Never commit them; never ship them to the browser.

- `LLM_API_KEY` — the Anthropic/OpenAI key.
- `SUPABASE_URL` — your project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only. This bypasses RLS, so it must never reach the browser. All DB access goes through `/api/chat`.
- `ACTIVE_USER_ID` — which seeded user the app talks to by default (the real person). Your test user can be selected with a `?user=` override during development.

(The browser needs neither — it only calls `/api/chat`.)

## 12. Costs

- Hosting: free tier.
- Browser STT/TTS: free.
- LLM: roughly cents per conversation.
- Optional upgrades: ElevenLabs/OpenAI TTS (nicer voice) and Whisper (better STT) — main recurring cost if added.

## 13. Later upgrades (post-v1)

- Richer character animation: proper rigged animation clips (wave, dance, celebrate), phoneme-based lip-sync instead of amplitude, reactive physics (bouncy antenna/ears).
- ElevenLabs voice for a real character voice.
- Whisper STT for accuracy and non-Chrome browsers.
- Semantic memory: embed facts/messages (pgvector in Supabase) so the character recalls the *most relevant* memories, not just recent ones — big quality jump as history grows.
- Autonomous behaviors: idle chatter, time-of-day reactions, proactive "thinking of you" messages.
- A "moments" journal the character keeps about your days together.
