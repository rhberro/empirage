-- Creatures -- the durable position of the trainer in the city.
--
-- The world keeps the position in memory while the trainer walks and writes
-- the confirmed tile behind, at most once per debounce window. The row is a
-- checkpoint, not a path: it answers where a reconnect starts, and a process
-- that restarts must not pull every trainer back to the spawn.
--
-- The row is created on the first write and rewritten afterwards, so there is
-- one row per trainer and no history to clean up.
--
-- Access model stays deny-by-default: RLS is enabled, anon and authenticated
-- have no grant and no policy, and only the service role -- which bypasses
-- RLS -- sees the rows. The server is the only writer.

create table public.trainer_positions (
  trainer_id uuid primary key references public.trainers (id) on delete cascade,
  x integer not null,
  y integer not null,
  facing text not null check (
    facing in ('up', 'upRight', 'right', 'downRight', 'down', 'downLeft', 'left', 'upLeft')
  ),
  updated_at timestamptz not null default now()
);

create trigger trainer_positions_set_updated_at
before update on public.trainer_positions
for each row execute function public.set_updated_at();

alter table public.trainer_positions enable row level security;

revoke all on table public.trainer_positions from anon, authenticated;

grant all on table public.trainer_positions to service_role;
grant all on table public.trainer_positions to postgres;

drop policy if exists trainer_positions_service_role_all on public.trainer_positions;
create policy trainer_positions_service_role_all on public.trainer_positions
for all to service_role
using (true)
with check (true);
