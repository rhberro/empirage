import { Hono } from 'hono';

import { authentication } from '../middleware/authentication.ts';
import { listHuntingLocations } from '../services/hunting-locations.ts';
import type { AppVariables } from '../types.ts';

type AppEnvironment = { Variables: AppVariables };

const huntingLocations = new Hono<AppEnvironment>();

huntingLocations.use('*', authentication);

huntingLocations.get('/', async function getHuntingLocations(context) {
  const locations = await listHuntingLocations(context.get('supabase'));
  return context.json(locations);
});

export { huntingLocations };
