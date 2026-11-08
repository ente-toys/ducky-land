import {createServer} from 'vite';
const s=await createServer({configLoader:'native',cacheDir:'/private/tmp/ducky-sunflower-vite',server:{host:'127.0.0.1',port:5391,strictPort:true}});await s.listen();s.printUrls();
