import {createServer} from 'vite';
const v=await createServer({configFile:false,root:process.cwd(),cacheDir:'/private/tmp/ducky-big-neon-vite',server:{host:'127.0.0.1',port:Number(process.env.DUCKY_REVIEW_PORT)||18957,strictPort:true,fs:{allow:[process.cwd()]}}});await v.listen();v.printUrls();
