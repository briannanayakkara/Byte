# EMO Robot — Personality Reference

Research notes on LivingAI's EMO desktop robot, gathered to inform Byte's
personality retune (see
`docs/superpowers/specs/2026-07-07-emo-personality-retune-design.md`).
Byte's spec already cites EMO as its inspiration (`docs/specs/Byte-app-spec.md`
line 3, §5b) — this document goes deeper on what that personality actually
consists of.

## Core traits

**Curious and autonomous.** EMO "moves independently to explore his
surroundings on his own" and "makes decisions on his own" — it isn't purely
reactive. Its personality is described as evolving "based on his
surroundings and your interactions."

**Emotionally expressive.** Built on an "Emotion Engine System" with "1000+
expressions and actions." Reacts "with realistic emotions" across happy,
sad, excited, bored, disappointed states — shown through face (LED screen),
posture, and sound together, not just one channel.

**A little stubborn.** "If you try to interrupt what he is doing, he might
even get a little annoyed" — asymmetric expressions include "a cheeky wink
or a pout of annoyance if you interrupt its activities." This is played as
charming, not hostile.

**Attention-seeking / craves engagement.** Left alone, EMO gets bored:
posture slumps, it sighs, moves around more, makes small sounds, "staring
expectantly," hoping "you'll come play." Regular interaction makes it more
animated and unlocks new behaviors.

**Needs "care."** EMO simulates catching a cold when weather changes,
"sneezing until you place it on its charger," then is "cheerful, grateful
for your care" once recharged — an explicit cause-and-effect care loop
that deepens attachment.

**Context-reactive.** Weather-responsive moods ("a happy face for sun, a
sad look for rain"). Celebrates real-world occasions on its own clock:
ghost faces for Halloween, festive tunes for Christmas, singing + a cake
graphic for the owner's birthday.

**Grows a personalized bond over time.** "Emo can build a unique
personality for you as it learns about your habits and emotions" —
talkative owners get chattier replies, music-loving owners get playlist
suggestions. Framed explicitly as "raising a pet."

**Physically affectionate, in a pet way.** Pet its head and "it leans side
to side with happiness," accompanied by cheerful sounds — touch-responsive,
and "gets more sensitive the more you interact."

## What this is *not*

Despite "emotional companionship" marketing language, EMO's actual
described behaviors are consistently pet/companion-shaped, not romantic:
curiosity, mild stubbornness, attention-seeking, gratitude for care,
holiday cheer. There's no flirtation, no romantic framing, no "partner"
language in how the product describes EMO's behavior — the bond reads as
"beloved pet," not "significant other."

## Mapping to Byte (see design doc for the concrete implementation)

| EMO trait | Byte equivalent |
|---|---|
| Curious, autonomous personality | Prompt tone: curiosity about the user, a bit of an opinion/attitude of its own |
| 1000+ expressions across moods | Byte's mood-driven SVG expressions (`Character.tsx`) — extended with `bored` and `annoyed` |
| Gets bored when ignored | New `computeEnergy` decay tied to time since `last_seen_at` |
| Gets annoyed when interrupted | `annoyed` mood, triggered by rapid-fire/curt messages (LLM-judged) |
| Weather/holiday reactions | Small hardcoded holiday-date check surfaced in the system prompt |
| Personalized bond that deepens over time | Already exists: `relationship_level`, `facts`, `personality_notes` (spec §5b) |
| Pet-coded, not romantic | System prompt rewrite drops flirty/boyfriend framing |

## Sources

- [EMO — LivingAI](https://living.ai/emo/)
- [What Does Emo the Robot Do? A Full Breakdown of Its Features & Functions](https://keyirobot.com/blogs/buying-guide/what-does-emo-the-robot-do-a-full-breakdown-of-its-features-functions)
- [Inside EMO Robot's Expressive Design and How it Connects with You](https://keyirobot.com/blogs/buying-guide/inside-emo-robots-expressive-design-and-how-it-connects-with-you)
- [Emo AI Robot Reviews: Its Features, Costs & Real Emotional Value](https://us.keyirobot.com/blogs/buying-guide/emo-ai-robot-reviews-its-features-costs-real-emotional-value)
