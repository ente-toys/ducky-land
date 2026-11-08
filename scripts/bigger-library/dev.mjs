import {createServer} from 'vite';
const server=await createServer({configLoader:'native',cacheDir:'/private/tmp/ducky-big-library-vite',server:{host:'127.0.0.1',port:19953,strictPort:true}});await server.listen();server.printUrls();
