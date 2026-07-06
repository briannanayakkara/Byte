-- Byte memory schema (spec §5b). Multi-user from the start: every table
-- besides `users` is keyed by user_id.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nicknames text[] not null default '{}',
  birthday date,
  notes text,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  content text not null,
  category text not null default 'other' check (category in ('likes', 'dislikes', 'people', 'events', 'other')),
  confidence real,
  created_at timestamptz not null default now(),
  last_referenced_at timestamptz not null default now()
);
create index if not exists facts_user_id_idx on facts(user_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  mood text,
  created_at timestamptz not null default now()
);
create index if not exists messages_user_id_idx on messages(user_id);

-- One row per user (spec §5b) -- the character is a bit different with each person.
create table if not exists character_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  mood text not null default 'neutral',
  energy int not null default 100 check (energy between 0 and 100),
  relationship_level int not null default 1,
  interaction_count int not null default 0,
  last_seen_at timestamptz,
  streak_days int not null default 0,
  personality_notes text
);

create table if not exists important_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  label text not null,
  date date not null,
  recurring boolean not null default false,
  notes text
);
create index if not exists important_dates_user_id_idx on important_dates(user_id);

-- RLS on every table, no policies for anon/authenticated (deny-by-default).
-- Only the server-side service-role key (api/chat.ts) reads/writes any of
-- this -- it bypasses RLS entirely. See skills/supabase-patterns/references/
-- rls-policies.md for why this is enabled now with no policies yet, rather
-- than waiting until real auth ships.
alter table users enable row level security;
alter table facts enable row level security;
alter table messages enable row level security;
alter table character_state enable row level security;
alter table important_dates enable row level security;
