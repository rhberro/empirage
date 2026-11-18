create table public.move_effects (
  move_id smallint not null references public.moves (id) on delete cascade,
  sequence smallint not null check (sequence >= 0),
  kind text not null check (kind in (
    'action_block', 'airborne_damage_multiplier', 'always_hit', 'battle_reward',
    'charge', 'copy_first_move_type', 'copy_target_combat_profile',
    'counter_physical', 'critical_ratio', 'damage', 'damage_screen',
    'disable_last_move', 'fixed_damage', 'forced_repeat', 'full_heal_and_sleep',
    'health_delta', 'level_damage', 'miss_recoil', 'multi_hit', 'no_op',
    'one_hit_ko', 'prevent_stat_stage_change', 'random_known_move',
    'random_status', 'recharge', 'recurring_damage', 'repeat_target_last_move',
    'reset_stat_stages', 'retaliation_stat_stage', 'self_faint', 'stat_stage',
    'status', 'substitute', 'target_health_fraction', 'target_requirement',
    'underground_damage_multiplier', 'weight_scaled_damage', 'wild_battle_flee'
  )),
  target text not null check (target in ('all', 'user', 'target')),
  chance smallint not null default 100 check (chance between 1 and 100),
  magnitude smallint,
  stat text check (stat is null or stat in ('attack', 'defense', 'special_attack', 'special_defense', 'speed', 'accuracy', 'evasion')),
  status text check (status is null or status in ('burn', 'confusion', 'freeze', 'paralysis', 'poison', 'sleep')),
  duration_min_ticks smallint,
  duration_max_ticks smallint,
  interval_ms integer,
  requirement text,
  parameters jsonb not null default '{}'::jsonb,
  primary key (move_id, sequence)
);

alter table public.move_effects enable row level security;
revoke all on public.move_effects from anon, authenticated;
grant select on public.move_effects to authenticated;
create policy move_effects_read on public.move_effects for select to authenticated using (true);
