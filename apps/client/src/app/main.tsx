import { ChakraProvider } from '@chakra-ui/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '~/app/App';
import { QueryProvider } from '~/app/query/QueryProvider';
import { InterfaceScale } from '~/app/scale';
import { getAuthStore } from '~/shared/auth';
import { system } from '~/shared/theme';
import { AlertsProvider, AlertsViewport } from '~/shared/ui/alert';

const rootEl = document.querySelector('#root');

if (!rootEl) {
  throw new Error('Root element #root not found');
}

getAuthStore();

createRoot(rootEl).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <InterfaceScale />
      <AlertsProvider>
        <AlertsViewport />
        <QueryProvider>
          <App />
        </QueryProvider>
      </AlertsProvider>
    </ChakraProvider>
  </StrictMode>,
);
