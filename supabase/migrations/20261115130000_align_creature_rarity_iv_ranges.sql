alter table public.creatures
  drop constraint if exists creatures_rarity_check,
  drop column if exists rarity;

alter table public.creatures
  add column rarity text generated always as (
    case
      when iv_hp + iv_attack + iv_defense + iv_special_attack + iv_special_defense + iv_speed <= 74 then 'common'
      when iv_hp + iv_attack + iv_defense + iv_special_attack + iv_special_defense + iv_speed <= 111 then 'uncommon'
      when iv_hp + iv_attack + iv_defense + iv_special_attack + iv_special_defense + iv_speed <= 139 then 'rare'
      when iv_hp + iv_attack + iv_defense + iv_special_attack + iv_special_defense + iv_speed <= 167 then 'epic'
      else 'legendary'
    end
  ) stored,
  add constraint creatures_rarity_check
  check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary'));
