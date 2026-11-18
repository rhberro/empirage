alter table public.moves
  drop constraint moves_healing_percentage_check,
  add constraint moves_healing_percentage_check check (healing_percentage between -100 and 100);
