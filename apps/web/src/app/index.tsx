import './fonts.css';
import { ChakraProvider } from '@chakra-ui/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { ColorModeProvider } from '~/shared/ui/ColorMode';

import { initializeAuth } from '../shared/auth';
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

initializeAuth();

createRoot(rootEl).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <ColorModeProvider>
        <QueryProvider>
          <RouterProvider router={router} />
        </QueryProvider>
      </ColorModeProvider>
    </ChakraProvider>
  </StrictMode>,
);
