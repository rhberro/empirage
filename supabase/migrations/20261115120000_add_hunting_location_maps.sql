alter table public.hunting_locations
  add column tileset_url text not null default '/assets/hunting-locations/grassland-tiles.png',
  add column map_data jsonb not null default '{
    "width": 12,
    "height": 8,
    "tileSize": 16,
    "defaultTileFrame": 0,
    "tiles": [],
    "objects": [
      { "kind": "player_spawn", "x": 2, "y": 3 },
      { "kind": "ally_spawn", "x": 6, "y": 3 }
    ]
  }'::jsonb;

alter table public.hunting_locations
  add constraint hunting_locations_map_data_is_object
  check (jsonb_typeof(map_data) = 'object');
