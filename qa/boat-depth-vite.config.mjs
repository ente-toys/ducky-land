import config from '../vite.config.js';
import {writeFileSync, mkdirSync} from 'node:fs';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/boat-turntable/spin48-work/fix6';
export default {...config,cacheDir:'/private/tmp/boat48-depth-vite',plugins:[...config.plugins,{
 name:'boat-proof-capture',configureServer(server){server.middlewares.use('/__boat-proof',async(req,res,next)=>{
  if(req.method!=='POST')return next();
  let body='';for await(const chunk of req)body+=chunk;
  const {file,data}=JSON.parse(body);
  if(!/^[a-z0-9-]+\.(png|json)$/.test(file)){res.statusCode=400;res.end();return;}
  mkdirSync(out,{recursive:true});writeFileSync(`${out}/${file}`,file.endsWith('.png')?Buffer.from(data.split(',')[1],'base64'):data);
  res.end('saved');
 });}
}]};
