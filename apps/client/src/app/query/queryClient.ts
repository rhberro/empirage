import { QueryClient } from '@tanstack/react-query';

import { isRetryableError } from '~/shared/api';

/**
 * How many times a request that got no answer is repeated.
 *
 * The number is small on purpose: the game has its own source of truth, and
 * a screen that waits for a long retry looks broken.
 */
const MAX_ATTEMPTS = 2;

/**
 * The client of the queries of the application.
 *
 * The defaults are the ones every query of the game wants: no attempt on a
 * refusal, no storm of requests when the tab comes back to the front, and no
 * freshness rule that is not written in the query itself.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: shouldRetry,
      },
    },
  });
}

function shouldRetry(failureCount: number, error: Error): boolean {
  return failureCount < MAX_ATTEMPTS && isRetryableError(error);
}
