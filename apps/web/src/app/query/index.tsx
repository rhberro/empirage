import { QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

import { createQueryClient } from "./create-query-client";

type QueryProviderProps = { children: React.ReactNode };

/**
 * The provider of the queries.
 *
 * There is one client for the whole application: the cache is shared by every
 * screen, and that is what makes two screens that ask for the same thing ask
 * the server once.
 */
export function QueryProvider(props: QueryProviderProps): React.ReactElement {
  const [client] = React.useState(createQueryClient());
  return <QueryClientProvider client={client}>{props.children}</QueryClientProvider>;
}
