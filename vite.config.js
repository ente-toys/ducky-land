import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {productionProxy,productionSignIn} from './scripts/vite-production-proxy.mjs';

export default defineConfig({
  // Serve the homepage directly and let removed routes return 404.
  appType: 'mpa',
  plugins: [react(),productionSignIn()],
  server: {host:'127.0.0.1',proxy:productionProxy()},
});
