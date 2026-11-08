import {createServer} from 'vite';
const server=await createServer({configLoader:'native',cacheDir:'/private/tmp/ducky-live-persp-vite-cache',server:{host:'127.0.0.1',port:5298,strictPort:true}});
await server.listen();server.printUrls();
