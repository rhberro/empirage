/* eslint-disable oxsome/no-inline-structural-types */
import { Hono } from 'hono';

import { AppError } from '../errors.ts';
import { invalidateCatalog } from '../game/catalog-cache.ts';
import {
  createHuntingLocation,
  type HuntingLocationMap,
  listHuntingLocations,
  listSpeciesCatalog,
  type UpdateHuntingLocationSpeciesInput,
  type UpdateHuntingLocationWaveRangeInput,
  updateHuntingLocationMap,
} from '../services/hunting-locations.ts';
import type { AppVariables } from '../types.ts';
import { createServerClient } from '../websocket/protocol.ts';

type AppEnvironment = { Variables: AppVariables };

interface CreateLocationRequestBody {
  description?: string;
  map?: HuntingLocationMap;
  name: string;
  slug: string;
  species?: Array<UpdateHuntingLocationSpeciesInput>;
  tilesetUrl?: string;
  waveRanges?: Array<UpdateHuntingLocationWaveRangeInput>;
}

interface UpdateMapRequestBody {
  map: HuntingLocationMap;
  species?: Array<UpdateHuntingLocationSpeciesInput>;
  tilesetUrl?: string;
  waveRanges?: Array<UpdateHuntingLocationWaveRangeInput>;
}

function specialKind(t: HuntingLocationMap['specialTiles'][number]): string {
  return t.kind;
}

const huntingLocations = new Hono<AppEnvironment>();

huntingLocations.get('/', async function getHuntingLocations(context) {
  const authorization = context.req.header('Authorization');
  const client =
    authorization && authorization.startsWith('Bearer ') && authorization.length > 7
      ? (context.get('supabase') ?? createServerClient())
      : createServerClient();
  const locations = await listHuntingLocations(client);
  return context.json(locations);
});

huntingLocations.get('/species', async function getSpeciesCatalog(context) {
  const authorization = context.req.header('Authorization');
  const client =
    authorization && authorization.startsWith('Bearer ') && authorization.length > 7
      ? (context.get('supabase') ?? createServerClient())
      : createServerClient();
  const species = await listSpeciesCatalog(client);
  return context.json(species);
});

huntingLocations.post('/', async function postHuntingLocation(context) {
  const body = (await context.req.json()) as CreateLocationRequestBody;
  if (!body || typeof body.name !== 'string' || typeof body.slug !== 'string') {
    throw new AppError(400, 'name_and_slug_required');
  }

  const name = body.name.trim();
  const slug = body.slug.trim().toLowerCase();
  if (name.length < 2 || slug.length < 2) {
    throw new AppError(400, 'invalid_name_or_slug');
  }

  const desc = body.description ? body.description.trim() : '';
  const adminClient = createServerClient();
  const created = await createHuntingLocation(adminClient, {
    description: desc,
    map: body.map,
    name,
    slug,
    species: body.species,
    tilesetUrl: body.tilesetUrl,
    waveRanges: body.waveRanges,
  });

  invalidateCatalog('hunt-static-catalog');
  invalidateCatalog(`hunting-location:${created.id}`);
  return context.json(created, 201);
});

huntingLocations.put('/:id/map', async function putHuntingLocationMap(context) {
  const locationId = Number(context.req.param('id'));
  if (Number.isNaN(locationId) || locationId <= 0) {
    throw new AppError(400, 'invalid_location_id');
  }

  const body = (await context.req.json()) as UpdateMapRequestBody;
  if (!body || !body.map || typeof body.map !== 'object') {
    throw new AppError(400, 'invalid_map_data');
  }

  const { map, species, tilesetUrl, waveRanges } = body;
  if (!Array.isArray(map.specialTiles)) {
    throw new AppError(400, 'special_tiles_required');
  }

  const specialKinds = map.specialTiles.map(specialKind);
  const kinds = new Set(specialKinds);
  if (
    !kinds.has('blocked') ||
    !kinds.has('enemy_spawn') ||
    !kinds.has('trainer_spawn') ||
    !kinds.has('creature_spawn')
  ) {
    throw new AppError(400, 'missing_required_special_tiles');
  }

  const adminClient = createServerClient();
  const updated = await updateHuntingLocationMap(
    adminClient,
    locationId,
    map,
    tilesetUrl,
    species,
    waveRanges,
  );
  invalidateCatalog(`hunting-location:${locationId}`);
  invalidateCatalog('hunt-static-catalog');
  return context.json(updated);
});

export { huntingLocations };
