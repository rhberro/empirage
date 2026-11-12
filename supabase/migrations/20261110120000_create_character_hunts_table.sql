create table public.character_hunts (
  character_id uuid primary key references public.characters (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  constraint character_hunts_one_per_user unique (user_id),
  constraint character_hunts_character_owner
    foreign key (character_id, user_id)
    references public.characters (id, user_id)
    on delete cascade
);

alter table public.character_hunts enable row level security;

revoke all on table public.character_hunts from anon, authenticated;

grant select on table public.character_hunts to authenticated;

create policy "Users can view their active hunt"
on public.character_hunts
for select
to authenticated
using ((select auth.uid()) = user_id);
