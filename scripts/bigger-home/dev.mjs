import {createServer} from 'vite';
const server=await createServer({configLoader:'native',cacheDir:'/private/tmp/ducky-bigger-browser-vite',server:{port:5309,host:'127.0.0.1'}});await server.listen();server.printUrls();
