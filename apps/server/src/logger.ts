import { env } from 'node:process';

import pino from 'pino';

const options = {
  level: env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['authorization', 'headers.authorization', 'req.headers.authorization'],
    remove: true,
  },
};

export const logger = pino(options);
