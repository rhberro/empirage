import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const pathToSource = new URL('./src', import.meta.url);

const config = {
  plugins: [react()],
  resolve: {
    alias: {
      '~': fileURLToPath(pathToSource),
    },
  },
};

export default defineConfig(config);
