-- Follow-up to 20260707150000_personality_base_and_evolving_layers.sql per
-- task review: the partial unique index only guaranteed "at most one active
-- row" in personality_base, not "exactly one" -- a manual SQL update could
-- deactivate the only row, leaving zero. This trigger closes that gap.
create or replace function personality_base_enforce_one_active() returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from personality_base where active) then
    raise exception 'personality_base must always have at least one active row';
  end if;
  return null;
end;
$$;

create trigger personality_base_enforce_one_active_trigger
  after insert or update or delete on personality_base
  for each statement
  execute function personality_base_enforce_one_active();

-- Follow-up per task review: p_new_milestones could theoretically be NULL
-- (no current caller does this -- Task 8's newMilestones() always returns a
-- real array -- but the RPC itself should not silently corrupt the row if
-- it ever were). NULL || anything and to_jsonb(NULL) both propagate NULL in
-- Postgres, which would violate milestones' NOT NULL constraint on either
-- the insert or the update branch. Coalesce to an empty array in both.
create or replace function upsert_character_turn(
  p_user_id uuid,
  p_mood text,
  p_energy int,
  p_last_seen_at timestamptz,
  p_streak_days int,
  p_cold_onset boolean,
  p_new_milestones text[],
  p_personality_notes text
) returns void
language sql
as $$
  insert into character_state (
    user_id, mood, energy, interaction_count, last_seen_at, relationship_level,
    streak_days, last_cold_at, milestones, personality_notes
  )
  values (
    p_user_id, p_mood, p_energy, 1, p_last_seen_at, 1, p_streak_days,
    case when p_cold_onset then p_last_seen_at else null end,
    to_jsonb(coalesce(p_new_milestones, array[]::text[])),
    p_personality_notes
  )
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
    streak_days = excluded.streak_days,
    last_cold_at = case when p_cold_onset then excluded.last_seen_at else character_state.last_cold_at end,
    milestones = to_jsonb(
      array(
        select distinct unnest(
          array(select jsonb_array_elements_text(character_state.milestones)) || coalesce(p_new_milestones, array[]::text[])
        )
      )
    ),
    personality_notes = excluded.personality_notes;
$$;
