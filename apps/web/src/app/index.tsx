/* oxlint-disable import/no-unassigned-import -- Font CSS imports register their font faces globally. */
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
/* oxlint-enable import/no-unassigned-import */
import { ChakraProvider } from '@chakra-ui/react';
import { ThemeProvider } from 'next-themes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { QueryProvider } from './query';
import { router } from './routes';
import { system } from './theme';

const rootEl = document.querySelector('#root');

if (!rootEl) {
  throw new Error('Root element #root not found.');
}

function preventGestureStart(event: Event): void {
  event.preventDefault();
}

document.addEventListener('gesturestart', preventGestureStart);

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <ChakraProvider value={system}>
        <QueryProvider>
          <RouterProvider router={router} />
        </QueryProvider>
      </ChakraProvider>
    </ThemeProvider>
  </StrictMode>,
);
