alter table public.moves
  drop constraint moves_id_check,
  drop constraint moves_target_shape_check,
  drop constraint moves_category_check;

alter table public.moves
  alter column base_pp drop not null;

alter table public.moves
  add column source_target_description text not null default '',
  add constraint moves_category_check check (category in ('physical', 'special', 'status', 'other')),
  add constraint moves_target_shape_check check (
    (area_shape = 'single' and area_radius = 0 and area_length = 0 and area_width = 0)
    or area_shape <> 'single'
  );

alter table public.moves
  drop constraint moves_target_check,
  add constraint moves_target_check check (
    target in (
      'self', 'enemy', 'ally', 'all_enemies', 'all_allies', 'all_adjacent', 'field', 'random_enemy'
    )
  );

alter table public.species_move_learnsets
  drop constraint species_move_learnsets_learn_method_check,
  drop constraint species_move_learnsets_details_check,
  add constraint species_move_learnsets_learn_method_check check (
    learn_method in ('level', 'machine', 'evolution', 'reminder')
  ),
  add constraint species_move_learnsets_details_check check (
    (learn_method = 'level' and required_level is not null and machine_code is null)
    or (learn_method = 'machine' and required_level is null and machine_code is not null)
    or (learn_method in ('evolution', 'reminder') and required_level is null and machine_code is null)
  );

alter table public.evolutions
  add column condition_description text not null default '';

create table public.move_status_effects (
  move_id smallint not null references public.moves (id) on delete cascade,
  status text not null check (status in ('burn', 'freeze', 'paralysis', 'poison', 'sleep', 'confusion')),
  chance smallint not null check (chance between 1 and 100),
  target text not null check (target in ('user', 'target')),
  primary key (move_id, status, target)
);

alter table public.move_status_effects enable row level security;
revoke all on public.move_status_effects from anon, authenticated;
grant select on public.move_status_effects to authenticated;
create policy move_status_effects_read on public.move_status_effects for select to authenticated using (true);
