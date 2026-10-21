import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { useState } from 'react';

import { createQueryClient } from '~/app/query/queryClient';

type QueryProviderProps = {
  children: ReactNode;
};

/**
 * The provider of the queries.
 *
 * There is one client for the whole application: the cache is shared by every
 * screen, and that is what makes two screens that ask for the same thing ask
 * the server once.
 */
export function QueryProvider(props: QueryProviderProps): ReactElement {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{props.children}</QueryClientProvider>;
}
