-- Creatures -- the starter backpack is now a fixed, generous kit.
--
-- A new trainer is born with 500 of the most basic potion and 500 of the most
-- basic capture device, so the player can test the hunt from the first minute
-- without running out. The previous random draw is replaced entirely.
--
-- "Most basic" is read from the catalog, not hardcoded: the cheapest healing
-- consumable and the device with the lowest capture multiplier.

create or replace function public.fill_starter_backpack(p_trainer_id uuid, p_seed bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item uuid;
begin
  -- 500 of the most basic potion: the cheapest consumable that heals.
  select i.id into v_item
  from public.items i
  where i.category = 'consumable' and i.heal_percent is not null
  order by i.price asc, i.id asc
  limit 1;

  if v_item is not null then
    insert into public.trainer_items (trainer_id, item_id, quantity)
    values (p_trainer_id, v_item, 500)
    on conflict (trainer_id, item_id) do update
      set quantity = trainer_items.quantity + excluded.quantity;
  end if;

  -- 500 of the most basic device: the one with the lowest capture multiplier.
  select i.id into v_item
  from public.items i
  where i.category = 'device'
  order by i.capture_multiplier asc, i.id asc
  limit 1;

  if v_item is not null then
    insert into public.trainer_items (trainer_id, item_id, quantity)
    values (p_trainer_id, v_item, 500)
    on conflict (trainer_id, item_id) do update
      set quantity = trainer_items.quantity + excluded.quantity;
  end if;
end;
$$;

revoke execute on function public.fill_starter_backpack(uuid, bigint) from public, anon, authenticated;
grant execute on function public.fill_starter_backpack(uuid, bigint) to service_role;
