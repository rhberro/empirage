import { env } from 'node:process';

import pino from 'pino';

function serializeError(error: unknown): unknown {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    cause: error.cause,
    message: error.message,
    name: error.name,
    stack: error.stack,
  };
}

const options = {
  level: env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['authorization', 'headers.authorization', 'req.headers.authorization'],
    remove: true,
  },
  serializers: { error: serializeError },
};

export const logger = pino(options);
