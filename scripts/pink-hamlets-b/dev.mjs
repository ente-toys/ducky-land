import {createServer} from 'vite';
const s=await createServer({configLoader:'native',cacheDir:'/private/tmp/ducky-pink-b-cache',server:{host:'127.0.0.1',port:19962,strictPort:true,hmr:{port:19963}}});await s.listen();s.printUrls();
