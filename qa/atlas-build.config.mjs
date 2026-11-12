import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

// Build the real telescope component independently of the rest of the island.
export default defineConfig({plugins:[react()],build:{
  rollupOptions:{input:fileURLToPath(new URL('./telescope-preview.html',import.meta.url))},
}});
