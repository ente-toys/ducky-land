import {createServer} from 'vite';
const server=await createServer({configLoader:'native',cacheDir:'/private/tmp/ducky-big-pink-vite-cache',server:{host:'127.0.0.1',port:19952,strictPort:true,hmr:{port:19953}}});
await server.listen();server.printUrls();
