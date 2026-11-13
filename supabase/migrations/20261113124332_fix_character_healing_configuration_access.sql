alter table public.healing_items
add column restores_full_health boolean not null default false;

update public.healing_items
set restores_full_health = true
where slug = 'max-potion';

grant update (healing_item_id, healing_threshold_percentage)
on table public.characters to service_role;
