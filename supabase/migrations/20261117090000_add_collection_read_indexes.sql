create index creatures_character_storage_captured_at_idx
on public.creatures (character_id, captured_at desc)
where party_slot is null;
