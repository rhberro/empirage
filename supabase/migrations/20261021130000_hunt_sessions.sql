-- Creatures -- the hunt sessions.
--
-- A hunt session is the durable record of a hunt: it starts when the player
-- enters an area and it ends when one of the rules of `docs/game/HUNT.md` says
-- so. The row is a checkpoint, not a work queue: the server keeps the
-- simulation alive in memory and writes the row every now and then.
--
-- The row is closed in soft-close and never deleted. The delete would throw
-- away exactly what the game still needs: `end_reason` says why the hunt
-- ended, the loot obtained in it stays with the session, and the accounting of
-- the offline session -- which counts consecutive hunts -- needs to know when
-- the hunt began and when it ended.
--
-- The random state lives in the row, and not in the process: `rng_seed` and
-- `rng_draws` are what make the catch-up of an offline hunt reproducible. If
-- the seed were only in memory, the catch-up would draw again and the player
-- would receive loot that is not the loot they earned before closing the tab.
--
-- The stamina of the trainer when the hunt began is captured in the row, and
-- not read from the trainer. The instant the hunt ends because the stamina ran
-- out depends on that value, and reading it from the trainer would tie the end
-- of the hunt to a rule about how the stamina is persisted -- a rule that is
-- not guaranteed anywhere.
--
-- Access model stays deny-by-default: RLS is enabled, anon and authenticated
-- have no grant and no policy, and only the service role -- which bypasses
-- RLS -- sees the rows. The server is the only writer.

create table public.hunt_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users (id) on delete cascade,
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  hunt_area_id uuid not null references public.hunt_areas (id) on delete restrict,
  status text not null check (status in ('active', 'finished')),
  started_at timestamptz not null default now(),
  last_simulated_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text check (
    end_reason in (
      'stamina_depleted',
      'offline_session_expired',
      'no_viable_creature',
      'player_finalized',
      'trainer_switched'
    )
  ),
  rng_seed bigint not null,
  rng_draws bigint not null default 0,
  encounters bigint not null default 0,
  kills bigint not null default 0,
  stamina_spent_minutes int not null default 0,
  -- The stamina of the trainer when the hunt started.
  --
  -- The value is captured once, when the hunt begins, and travels with the
  -- session: the instant the hunt ends because the stamina ran out depends on
  -- it, and deriving it from the stamina of the trainer would tie the end of
  -- the hunt to a rule about how the stamina is persisted -- a rule that is
  -- not guaranteed anywhere.
  stamina_at_start int not null,
  actions jsonb not null default '[]'::jsonb,
  constraint hunt_sessions_ended_at_check check (ended_at is null or ended_at >= started_at),
  constraint hunt_sessions_consistency_check check (
    (status = 'active' and ended_at is null and end_reason is null)
    or (status = 'finished' and ended_at is not null and end_reason is not null)
  ),
  constraint hunt_sessions_counters_check check (
    encounters >= 0 and kills >= 0 and rng_draws >= 0 and stamina_spent_minutes >= 0
    and stamina_at_start >= 0 and stamina_at_start <= 720
  )
);

-- The boot of the server sweeps the hunts that are still open and resumes
-- each one by catch-up. The index is partial because the finished hunts are
-- the majority of the table and are never part of that sweep.
create index hunt_sessions_active_last_simulated_at_idx
  on public.hunt_sessions (last_simulated_at)
  where status = 'active';

-- A trainer hunts one area at a time: the hunt of a trainer is closed before
-- the next one begins. The partial unique index keeps two open hunts of the
-- same trainer from existing, which would make the session of the trainer
-- ambiguous.
create unique index hunt_sessions_active_trainer_id_idx
  on public.hunt_sessions (trainer_id)
  where status = 'active';

-- The sessions of an account are read when the account comes back and the
-- hunt of the trainer is looked up.
create index hunt_sessions_account_id_idx on public.hunt_sessions (account_id);

alter table public.hunt_sessions enable row level security;

revoke all on table public.hunt_sessions from anon, authenticated;

grant all on table public.hunt_sessions to service_role;
grant all on table public.hunt_sessions to postgres;

drop policy if exists hunt_sessions_service_role_all on public.hunt_sessions;
create policy hunt_sessions_service_role_all on public.hunt_sessions
for all to service_role
using (true)
with check (true);
