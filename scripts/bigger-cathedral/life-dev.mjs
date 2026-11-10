import {createServer} from 'vite';
const server=await createServer({configLoader:'native',cacheDir:'/private/tmp/ducky-bellovo-life-vite',server:{port:5374,host:'127.0.0.1',strictPort:true}});
await server.listen();server.printUrls();
