import {createServer} from 'vite';
const server=await createServer({configLoader:'native',cacheDir:'/private/tmp/ducky-cathedral-communities-vite',server:{port:5368,host:'127.0.0.1',strictPort:true}});
await server.listen();server.printUrls();
