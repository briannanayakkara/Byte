-- Design doc docs/superpowers/specs/2026-07-07-byte-v3-character-and-continuity-design.md
-- §4: interaction_count/relationship_level must increment atomically
-- against whatever is actually in the row at write time, not a
-- client-side snapshot read at the start of the request -- otherwise two
-- near-simultaneous devices could race and one's increment would
-- silently overwrite the other's, losing an interaction. mood/energy/
-- streak_days stay last-write-wins (confirmed acceptable), computed
-- exactly as before by the caller and passed straight through.
--
-- The relationship_level bucket thresholds (5/20/60) mirror
-- relationshipLevel() in api/lib/relationship.ts -- a future threshold
-- change must update both places.
create or replace function upsert_character_turn(
  p_user_id uuid,
  p_mood text,
  p_energy int,
  p_last_seen_at timestamptz,
  p_streak_days int
) returns void
language sql
as $$
  insert into character_state (user_id, mood, energy, interaction_count, last_seen_at, relationship_level, streak_days)
  values (p_user_id, p_mood, p_energy, 1, p_last_seen_at, 1, p_streak_days)
  on conflict (user_id) do update set
    mood = excluded.mood,
    energy = excluded.energy,
    interaction_count = character_state.interaction_count + 1,
    last_seen_at = excluded.last_seen_at,
    relationship_level = case
      when character_state.interaction_count + 1 < 5 then 1
      when character_state.interaction_count + 1 < 20 then 2
      when character_state.interaction_count + 1 < 60 then 3
      else 4
    end,
    streak_days = excluded.streak_days;
$$;
