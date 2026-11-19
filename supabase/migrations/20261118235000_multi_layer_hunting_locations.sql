-- Update default tileset_url and ensure map_data supports multiple layers
alter table public.hunting_locations
  alter column tileset_url set default '/assets/tilesets/route-1.png';

-- Ensure Route 1 has initial map_data with layer 0 and tileset_url
update public.hunting_locations
set
  tileset_url = '/assets/tilesets/route-1.png',
  map_data = jsonb_build_object(
    'width', coalesce((map_data->>'width')::int, 12),
    'height', coalesce((map_data->>'height')::int, 8),
    'tileSize', coalesce((map_data->>'tileSize')::int, 16),
    'defaultTileFrame', coalesce((map_data->>'defaultTileFrame')::int, 0),
    'tiles', coalesce(map_data->'tiles', '[]'::jsonb),
    'specialTiles', coalesce(map_data->'specialTiles', '[
      {"kind": "blocked", "x": 0, "y": 0},
      {"kind": "trainer_spawn", "x": 2, "y": 3},
      {"kind": "creature_spawn", "x": 6, "y": 3},
      {"kind": "enemy_spawn", "x": 9, "y": 3}
    ]'::jsonb),
    'animations', coalesce(map_data->'animations', '[]'::jsonb),
    'layers', case
      when map_data->'layers' is not null then map_data->'layers'
      else jsonb_build_array(
        jsonb_build_object(
          'id', 'layer-0',
          'name', 'Ground (Base)',
          'order', 0,
          'placement', 'below_characters',
          'visible', true,
          'tiles', coalesce(map_data->'tiles', '[]'::jsonb)
        )
      )
    end
  )
where id = 1;
