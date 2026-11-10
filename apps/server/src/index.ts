import { app } from './app.ts';
import { config } from './config.ts';
import { logger } from './logger.ts';

const serverOptions = { fetch: app.fetch, port: config.port };

globalThis.Bun.serve(serverOptions);

const details = { port: config.port };

logger.info(details, 'server started');
