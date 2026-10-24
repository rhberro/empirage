-- Creatures — catalog seed.
--
-- Idempotent on purpose: the seed is applied with `bun run db:seed`, and it
-- must converge instead of failing. Rows are upserted by slug.
--
-- Careful: `supabase db push --include-seed` does NOT run this file on this
-- version of the CLI — it only updates the seed hash, so the file is skipped
-- without a warning. Apply the seed with `bun run db:seed`.

insert into public.species (
  id,
  slug,
  name,
  element,
  description,
  base_vitality,
  base_physical_attack,
  base_magic_attack,
  base_physical_defense,
  base_magic_defense,
  capture_chance,
  base_experience,
  is_starter
)
values
  (
    '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    'brasa',
    'Brasa',
    'fire',
    'Ágil e resistente, equilibra ataque e defesa.',
    22,
    8,
    4,
    7,
    2,
    0.05,
    100,
    true
  ),
  (
    '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
    'gota',
    'Gota',
    'water',
    'Sereno e adaptável, forte contra oponentes velozes.',
    24,
    6,
    6,
    6,
    3,
    0.05,
    100,
    true
  ),
  (
    '16fd2706-8baf-433b-82eb-8c7fada847da',
    'broto',
    'Broto',
    'plant',
    'Robusto e paciente, cresce devagar mas vai longe.',
    26,
    5,
    5,
    8,
    2,
    0.05,
    100,
    true
  ),
  (
    '4a1b2c3d-5e6f-4a8b-9c0d-1e2f3a4b5c6d',
    'cinzarra',
    'Cinzarra',
    'fire',
    'Criatura de cinzas, de ataque físico agressivo e pouca vida.',
    20,
    10,
    3,
    6,
    2,
    0.005,
    150,
    false
  ),
  (
    '8b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e',
    'pedrino',
    'Pedrino',
    'neutral',
    'Pedra viva, resistente e difícil de ferir.',
    28,
    7,
    2,
    9,
    3,
    0.002,
    180,
    false
  )
on conflict (slug) do update
set
  id = excluded.id,
  name = excluded.name,
  element = excluded.element,
  description = excluded.description,
  base_vitality = excluded.base_vitality,
  base_physical_attack = excluded.base_physical_attack,
  base_magic_attack = excluded.base_magic_attack,
  base_physical_defense = excluded.base_physical_defense,
  base_magic_defense = excluded.base_magic_defense,
  capture_chance = excluded.capture_chance,
  base_experience = excluded.base_experience,
  is_starter = excluded.is_starter;

insert into public.abilities (
  id,
  slug,
  name,
  element,
  damage,
  cooldown_ms,
  description,
  target_type,
  range,
  area_shape,
  area_length,
  area_radius,
  area_step_ms,
  travel_ms
)
values
  (
    'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    'brasa',
    'Brasa',
    'fire',
    12,
    4000,
    'Ataque de fogo rápido, o golpe mais curto da criatura.',
    'target',
    5,
    null,
    null,
    null,
    150,
    200
  ),
  (
    'c2b3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    'ignea',
    'Ígnea',
    'fire',
    24,
    7000,
    'Explosão de fogo de alto dano e longo tempo de recarga.',
    'area',
    5,
    'circle',
    null,
    2,
    150,
    0
  ),
  (
    'd3c4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f',
    'garra',
    'Garra',
    'neutral',
    8,
    2000,
    'Arranhão sem elemento, disponível para quase toda espécie.',
    'target',
    1,
    null,
    null,
    null,
    150,
    0
  ),
  (
    'e4d5f6a7-b8c9-4d0e-9f1a-3b4c5d6e7f8a',
    'jato',
    'Jato',
    'water',
    14,
    4000,
    'Jato de água de alcance médio.',
    'target',
    6,
    null,
    null,
    null,
    150,
    200
  ),
  (
    'f5e6a7b8-c9d0-4e1f-8a2b-4c5d6e7f8a9b',
    'espinho',
    'Espinho',
    'plant',
    10,
    4000,
    'Espinho venenoso que perfura a defesa.',
    'area',
    4,
    'line',
    4,
    null,
    200,
    0
  ),
  (
    'a6b7c8d9-e0f1-4a2b-8c3d-4e5f6a7b8c9d',
    'explosao',
    'Explosão',
    'fire',
    18,
    5000,
    'Explosão de fogo centrada no conjurador, sem alvo.',
    'area_self',
    0,
    'circle',
    null,
    1,
    150,
    0
  ),
  (
    'b7c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e',
    'vendaval',
    'Vendaval',
    'water',
    12,
    6000,
    'Vendaval de água que varre a área ao redor do conjurador.',
    'area_self',
    0,
    'circle',
    null,
    2,
    150,
    0
  )
on conflict (slug) do update
set
  id = excluded.id,
  name = excluded.name,
  element = excluded.element,
  damage = excluded.damage,
  cooldown_ms = excluded.cooldown_ms,
  description = excluded.description,
  target_type = excluded.target_type,
  range = excluded.range,
  area_shape = excluded.area_shape,
  area_length = excluded.area_length,
  area_radius = excluded.area_radius,
  area_step_ms = excluded.area_step_ms,
  travel_ms = excluded.travel_ms;

-- The set of abilities of a species is replaced as a whole: an ability that
-- moves from one slot to another would collide with the unique
-- (species_id, ability_id) constraint if the seed only upserted by slot. The
-- upsert below still makes a rerun converge after the rows are recreated.
delete from public.species_abilities
where species_id in (
  '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
  '16fd2706-8baf-433b-82eb-8c7fada847da',
  '4a1b2c3d-5e6f-4a8b-9c0d-1e2f3a4b5c6d',
  '8b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e'
);

insert into public.species_abilities (
  species_id,
  ability_id,
  slot,
  wild_chance,
  wild_interval_ms
)
values
  -- Every species shares the six abilities of the 2.2 catalog: two that reach
  -- a target, two areas around a target, and two centred on the caster.
  -- Brasa.
  ('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 0, 10, 3000),
  ('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'd3c4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f', 1, 12, 2000),
  ('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'c2b3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 2, 6, 7000),
  ('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'f5e6a7b8-c9d0-4e1f-8a2b-4c5d6e7f8a9b', 3, 8, 5000),
  ('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'a6b7c8d9-e0f1-4a2b-8c3d-4e5f6a7b8c9d', 4, 8, 5000),
  ('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'b7c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e', 5, 6, 6000),
  -- Gota.
  ('6ba7b810-9dad-41d1-80b4-00c04fd430c8', 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 0, 10, 3000),
  ('6ba7b810-9dad-41d1-80b4-00c04fd430c8', 'd3c4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f', 1, 12, 2000),
  ('6ba7b810-9dad-41d1-80b4-00c04fd430c8', 'c2b3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 2, 6, 7000),
  ('6ba7b810-9dad-41d1-80b4-00c04fd430c8', 'f5e6a7b8-c9d0-4e1f-8a2b-4c5d6e7f8a9b', 3, 8, 5000),
  ('6ba7b810-9dad-41d1-80b4-00c04fd430c8', 'a6b7c8d9-e0f1-4a2b-8c3d-4e5f6a7b8c9d', 4, 8, 5000),
  ('6ba7b810-9dad-41d1-80b4-00c04fd430c8', 'b7c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e', 5, 6, 6000),
  -- Broto.
  ('16fd2706-8baf-433b-82eb-8c7fada847da', 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 0, 10, 3000),
  ('16fd2706-8baf-433b-82eb-8c7fada847da', 'd3c4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f', 1, 12, 2000),
  ('16fd2706-8baf-433b-82eb-8c7fada847da', 'c2b3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 2, 6, 7000),
  ('16fd2706-8baf-433b-82eb-8c7fada847da', 'f5e6a7b8-c9d0-4e1f-8a2b-4c5d6e7f8a9b', 3, 8, 5000),
  ('16fd2706-8baf-433b-82eb-8c7fada847da', 'a6b7c8d9-e0f1-4a2b-8c3d-4e5f6a7b8c9d', 4, 8, 5000),
  ('16fd2706-8baf-433b-82eb-8c7fada847da', 'b7c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e', 5, 6, 6000),
  -- Cinzarra.
  ('4a1b2c3d-5e6f-4a8b-9c0d-1e2f3a4b5c6d', 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 0, 10, 3000),
  ('4a1b2c3d-5e6f-4a8b-9c0d-1e2f3a4b5c6d', 'd3c4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f', 1, 12, 2000),
  ('4a1b2c3d-5e6f-4a8b-9c0d-1e2f3a4b5c6d', 'c2b3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 2, 6, 7000),
  ('4a1b2c3d-5e6f-4a8b-9c0d-1e2f3a4b5c6d', 'f5e6a7b8-c9d0-4e1f-8a2b-4c5d6e7f8a9b', 3, 8, 5000),
  ('4a1b2c3d-5e6f-4a8b-9c0d-1e2f3a4b5c6d', 'a6b7c8d9-e0f1-4a2b-8c3d-4e5f6a7b8c9d', 4, 8, 5000),
  ('4a1b2c3d-5e6f-4a8b-9c0d-1e2f3a4b5c6d', 'b7c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e', 5, 6, 6000),
  -- Pedrino.
  ('8b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e', 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 0, 10, 3000),
  ('8b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e', 'd3c4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f', 1, 12, 2000),
  ('8b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e', 'c2b3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 2, 6, 7000),
  ('8b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e', 'f5e6a7b8-c9d0-4e1f-8a2b-4c5d6e7f8a9b', 3, 8, 5000),
  ('8b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e', 'a6b7c8d9-e0f1-4a2b-8c3d-4e5f6a7b8c9d', 4, 8, 5000),
  ('8b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e', 'b7c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e', 5, 6, 6000)
on conflict (species_id, slot) do update
set ability_id = excluded.ability_id,
  wild_chance = excluded.wild_chance,
  wild_interval_ms = excluded.wild_interval_ms;

insert into public.items (
  id,
  slug,
  name,
  category,
  description,
  price,
  is_store_item,
  heal_percent,
  cooldown_ms,
  capture_multiplier
)
values
  (
    '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
    'pocao-de-cura',
    'Poção de Cura',
    'consumable',
    'Restaura a vida de uma criatura.',
    120,
    true,
    50,
    1000,
    1.00
  ),
  (
    '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e',
    'pocao-de-cura-forte',
    'Poção de Cura Forte',
    'consumable',
    'Restaura mais vida que a poção comum.',
    320,
    true,
    80,
    1500,
    1.00
  ),
  (
    '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
    'pocao-fraca',
    'Poção Fraca',
    'consumable',
    'Restaura pouca vida, mas sai barato.',
    60,
    true,
    25,
    1000,
    1.00
  ),
  (
    '4e5f6a7b-8c9d-4e0f-9a1b-3c4d5e6f7a8b',
    'prisma-simples',
    'Prisma Simples',
    'device',
    'Dispositivo de captura mais simples, multiplicador 1x.',
    900,
    true,
    null,
    0,
    1.00
  ),
  (
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    'prisma-reforcado',
    'Prisma Reforçado',
    'device',
    'Dispositivo de captura com multiplicador 2x.',
    1300,
    true,
    null,
    0,
    2.00
  ),
  (
    '3d4e5f6a-7b8c-4d9e-8f0a-2b3c4d5e6f7a',
    'prisma-de-captura',
    'Prisma de Captura',
    'device',
    'Dispositivo de captura de multiplicador alto, 3x.',
    1800,
    true,
    null,
    0,
    3.00
  ),
  (
    'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    'prisma-lapidado',
    'Prisma Lapidado',
    'device',
    'Dispositivo de captura com multiplicador 4x.',
    2000,
    true,
    null,
    0,
    4.00
  ),
  (
    '5f6a7b8c-9d0e-4f1a-8b2c-4d5e6f7a8b9c',
    'cristal-bruto',
    'Cristal Bruto',
    'device',
    'Dispositivo de captura bruto, de multiplicador máximo, 5x.',
    2400,
    true,
    null,
    0,
    5.00
  ),
  (
    '6a7b8c9d-0e1f-4a2b-9c3d-5e6f7a8b9c0d',
    'elixir-de-stamina',
    'Elixir de Stamina',
    'consumable',
    'Recupera stamina do treinador.',
    340,
    false,
    null,
    0,
    1.00
  ),
  (
    '7b8c9d0e-1f2a-4b3c-8d4e-6f7a8b9c0d1e',
    'frasco-antidoto',
    'Frasco Antídoto',
    'consumable',
    'Cura o efeito de veneno de uma criatura.',
    260,
    false,
    null,
    0,
    1.00
  ),
  (
    '8c9d0e1f-2a3b-4c4d-9e5f-7a8b9c0d1e2f',
    'pata-de-criatura',
    'Pata de Criatura',
    'material',
    'Pata de uma criatura derrotada, o drop mais comum dos quadrúpedes.',
    40,
    false,
    null,
    0,
    1.00
  ),
  (
    '9d0e1f2a-3b4c-4d5e-8f6a-9b0c1d2e3f4a',
    'pele-de-criatura',
    'Pele de Criatura',
    'material',
    'Pele de uma criatura derrotada, usada como matéria-prima.',
    45,
    false,
    null,
    0,
    1.00
  ),
  (
    '0e1f2a3b-4c5d-4e6f-9a7b-0c1d2e3f4a5b',
    'couro-de-criatura',
    'Couro de Criatura',
    'material',
    'Couro de uma criatura derrotada, mais resistente que a pele comum.',
    70,
    false,
    null,
    0,
    1.00
  ),
  (
    '1f2a3b4c-5d6e-4f7a-8b8c-1d2e3f4a5b6c',
    'asa-de-criatura',
    'Asa de Criatura',
    'material',
    'Asa de uma criatura alada derrotada, leve e resistente.',
    60,
    false,
    null,
    0,
    1.00
  ),
  (
    '2b3c4d5e-6f70-4181-92a3-b4c5d6e7f809',
    'cinza-de-criatura',
    'Cinza de Criatura',
    'material',
    'Cinza que fica de uma criatura de cinzas derrotada.',
    30,
    false,
    null,
    0,
    1.00
  ),
  (
    '3c4d5e6f-7081-4292-a3b4-c5d6e7f8091a',
    'seiva-de-criatura',
    'Seiva de Criatura',
    'material',
    'Seiva que escorre de uma criatura de planta derrotada.',
    35,
    false,
    null,
    0,
    1.00
  )
on conflict (slug) do update
set
  id = excluded.id,
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  price = excluded.price,
  is_store_item = excluded.is_store_item,
  heal_percent = excluded.heal_percent,
  cooldown_ms = excluded.cooldown_ms,
  capture_multiplier = excluded.capture_multiplier;

-- The drops of the species are the parts of the creature, and nothing else: a
-- capture device is never dropped by a wild creature. The old device drops are
-- removed so the catalog tells the same story the game design tells.
delete from public.species_drops
where item_id in (
  '4e5f6a7b-8c9d-4e0f-9a1b-3c4d5e6f7a8b',
  '5f6a7b8c-9d0e-4f1a-8b2c-4d5e6f7a8b9c'
);

insert into public.species_drops (species_id, item_id, chance)
values
  -- Brasa: a small winged ember creature.
  ('3f2504e0-4f89-41d3-9a0c-0305e82c3301', '1f2a3b4c-5d6e-4f7a-8b8c-1d2e3f4a5b6c', 0.12),
  ('3f2504e0-4f89-41d3-9a0c-0305e82c3301', '8c9d0e1f-2a3b-4c4d-9e5f-7a8b9c0d1e2f', 0.3),
  ('3f2504e0-4f89-41d3-9a0c-0305e82c3301', '9d0e1f2a-3b4c-4d5e-8f6a-9b0c1d2e3f4a', 0.2),
  -- Gota: a soft creature that only leaves its skin behind.
  ('6ba7b810-9dad-41d1-80b4-00c04fd430c8', '9d0e1f2a-3b4c-4d5e-8f6a-9b0c1d2e3f4a', 0.3),
  -- Broto: a plant creature that bleeds sap.
  ('16fd2706-8baf-433b-82eb-8c7fada847da', '3c4d5e6f-7081-4292-a3b4-c5d6e7f8091a', 0.3),
  ('16fd2706-8baf-433b-82eb-8c7fada847da', '9d0e1f2a-3b4c-4d5e-8f6a-9b0c1d2e3f4a', 0.15),
  -- Cinzarra: a creature of ashes, with a hard hide.
  ('4a1b2c3d-5e6f-4a8b-9c0d-1e2f3a4b5c6d', '2b3c4d5e-6f70-4181-92a3-b4c5d6e7f809', 0.35),
  ('4a1b2c3d-5e6f-4a8b-9c0d-1e2f3a4b5c6d', '0e1f2a3b-4c5d-4e6f-9a7b-0c1d2e3f4a5b', 0.15),
  -- Pedrino: a living rock, cracked and crusted.
  ('8b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e', '0e1f2a3b-4c5d-4e6f-9a7b-0c1d2e3f4a5b', 0.25),
  ('8b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e', '9d0e1f2a-3b4c-4d5e-8f6a-9b0c1d2e3f4a', 0.1)
on conflict (species_id, item_id) do update
set chance = excluded.chance;

-- Only the relation defined by the game design is seeded: fire against plant is
-- super effective. Every other combination is absent and the server applies the
-- 1.00 default.
insert into public.type_effectiveness (attacker_element, defender_element, multiplier)
values ('fire', 'plant', 1.5)
on conflict (attacker_element, defender_element) do update
set multiplier = excluded.multiplier;

-- The hunt areas. The names and the descriptions are the ones of the design
-- gallery, so the gallery and the runtime tell the same story.
--
-- The tone of the area is chosen here, by design. The tone of a species and of
-- an item is not stored: the server derives it from the element of the species
-- and from the category of the item.
insert into public.hunt_areas (
  id,
  slug,
  name,
  description,
  recommended_level,
  minimum_level,
  tone
)
values
  (
    '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d01',
    'campina-cinzenta',
    'Campina Cinzenta',
    'Campina coberta de cinzas onde criaturas de brasa passeiam entre tufos secos.',
    3,
    1,
    'ember'
  ),
  (
    '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d02',
    'lago-congelado',
    'Lago Congelado',
    'Lago de gelo espesso, onde o vento carrega cristais e a caçada é lenta.',
    7,
    5,
    'frost'
  ),
  (
    '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d03',
    'bosque-urrante',
    'Bosque Urrante',
    'Bosque de plantas falantes, cujas folhas sussurram o nome de quem caça.',
    11,
    9,
    'verdant'
  ),
  (
    '7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d04',
    'ruinas-de-pedra',
    'Ruínas de Pedra',
    'Ruínas de pedra antiga, onde a vida se instalou entre os blocos caídos.',
    15,
    14,
    'neutral'
  )
on conflict (slug) do update
set
  id = excluded.id,
  name = excluded.name,
  description = excluded.description,
  recommended_level = excluded.recommended_level,
  minimum_level = excluded.minimum_level,
  tone = excluded.tone;

-- The species of each area, with the primary one. The primary species is the
-- one that represents the place, not the strongest nor the rarest of it.
insert into public.hunt_area_species (hunt_area_id, species_id, is_primary, position)
values
  -- Campina Cinzenta.
  ('7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d01', '3f2504e0-4f89-41d3-9a0c-0305e82c3301', true, 0),
  ('7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d01', '16fd2706-8baf-433b-82eb-8c7fada847da', false, 1),
  ('7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d01', '8b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e', false, 2),
  ('7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d01', '4a1b2c3d-5e6f-4a8b-9c0d-1e2f3a4b5c6d', false, 3),
  -- Lago Congelado.
  ('7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d02', '6ba7b810-9dad-41d1-80b4-00c04fd430c8', true, 0),
  ('7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d02', '8b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e', false, 1),
  ('7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d02', '3f2504e0-4f89-41d3-9a0c-0305e82c3301', false, 2),
  -- Bosque Urrante.
  ('7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d03', '16fd2706-8baf-433b-82eb-8c7fada847da', true, 0),
  ('7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d03', '6ba7b810-9dad-41d1-80b4-00c04fd430c8', false, 1),
  ('7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d03', '8b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e', false, 2),
  ('7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d03', '3f2504e0-4f89-41d3-9a0c-0305e82c3301', false, 3),
  -- Ruínas de Pedra.
  ('7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d04', '8b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e', true, 0),
  ('7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d04', '4a1b2c3d-5e6f-4a8b-9c0d-1e2f3a4b5c6d', false, 1),
  ('7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d04', '6ba7b810-9dad-41d1-80b4-00c04fd430c8', false, 2),
  ('7a1c9e20-4b31-4d52-8e63-0f1a2b3c4d04', '3f2504e0-4f89-41d3-9a0c-0305e82c3301', false, 3)
on conflict (hunt_area_id, species_id) do update
set is_primary = excluded.is_primary,
  position = excluded.position;
