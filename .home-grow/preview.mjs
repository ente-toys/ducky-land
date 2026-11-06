// a second dev server (port 5299) that serves the game WITH the merge applied in memory; 5210 is left alone
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {mergePlugin} from './merge.mjs';
const server = await createServer({root: '/Users/pragadees.xd/Downloads/Ducky Land/aswin-ducky-land', configFile: false, appType: 'mpa', cacheDir: '.home-grow/.vite',
  plugins: [react(), mergePlugin()], server: {host: '127.0.0.1', port: 5299, strictPort: true, hmr: false}});
await server.listen(); console.log('preview on 5299');
