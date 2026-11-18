alter table public.moves
  add column drain_percentage smallint not null default 0 check (drain_percentage between -100 and 100),
  add column healing_percentage smallint not null default 0 check (healing_percentage between 0 and 100),
  add column flinch_chance smallint not null default 0 check (flinch_chance between 0 and 100);
