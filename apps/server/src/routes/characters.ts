import type { PostgrestError } from '@supabase/supabase-js';
import { Hono } from 'hono';

import { AppError } from '../errors.ts';
import { authentication } from '../middleware/authentication.ts';
import type { AppVariables } from '../types.ts';

type AppEnvironment = { Variables: AppVariables };
type CreateCharacterBody = {
  gender?: unknown;
  name?: unknown;
};

const characters = new Hono<AppEnvironment>();

function databaseError(error: PostgrestError): AppError {
  if (error.code === 'P0001') {
    return new AppError(409, 'character_name_unavailable', error);
  }

  if (error.code === 'P0002') {
    return new AppError(409, 'character_limit_reached', error);
  }

  if (error.code === 'P0003') {
    return new AppError(401, 'authentication_required', error);
  }

  if (error.code === 'P0004') {
    return new AppError(404, 'character_not_found', error);
  }

  if (error.code === '22023' || error.code === '23514') {
    return new AppError(400, 'invalid_character', error);
  }

  return new AppError(500, 'database_error', error);
}

async function parseCreateCharacterBody(request: Request): Promise<CreateCharacterBody> {
  try {
    return (await request.json()) as CreateCharacterBody;
  } catch (error) {
    throw new AppError(400, 'invalid_json', error);
  }
}

characters.use('*', authentication);

characters.get('/', async function listCharacters(context) {
  const supabase = context.get('supabase');
  const { data, error } = await supabase
    .from('characters')
    .select('id, name, level, gender, avatar_url, is_selected')
    .order('slot');

  if (error) {
    throw databaseError(error);
  }

  return context.json(data);
});

characters.post('/', async function createCharacter(context) {
  const body = await parseCreateCharacterBody(context.req.raw);

  if (typeof body.name !== 'string' || (body.gender !== 'male' && body.gender !== 'female')) {
    throw new AppError(400, 'invalid_character');
  }

  const parameters = {
    character_gender: body.gender,
    character_name: body.name,
  };
  const supabase = context.get('supabase');
  const { data, error } = await supabase.rpc('create_character', parameters);

  if (error) {
    throw databaseError(error);
  }

  const response = { id: data };
  return context.json(response, 201);
});

characters.post('/:characterId/select', async function selectCharacter(context) {
  const characterId = context.req.param('characterId');
  const parameters = { character_id: characterId };
  const supabase = context.get('supabase');
  const { error } = await supabase.rpc('select_character', parameters);

  if (error) {
    throw databaseError(error);
  }

  return context.body(null, 204);
});

export { characters };
