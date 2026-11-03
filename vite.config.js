import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Serve the homepage directly and let removed routes return 404.
  appType: 'mpa',
  plugins: [react()],
});
