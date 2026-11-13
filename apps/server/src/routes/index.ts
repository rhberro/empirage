import { Hono } from 'hono';

import type { AppVariables } from '../types.ts';
import { characters } from './characters.ts';
import { huntingLocations } from './hunting-locations.ts';

interface AppEnvironment {
  Variables: AppVariables;
}

const routes = new Hono<AppEnvironment>();

routes.route('/characters', characters);
routes.route('/hunting-locations', huntingLocations);

export { routes };
