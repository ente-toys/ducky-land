import config from '../vite.config.js';
import {createAuditServer} from '../scripts/audit-room.mjs';
// Test sessions and control routes are bound to loopback only.
export default {...config,plugins:[...config.plugins.filter(p=>p.name!=='production-sign-in'),{
 name:'local-audit-room',async configureServer(server){
  // Force complete network loads for repeatable cold-document measurements.
  server.middlewares.use((req,res,next)=>{
   delete req.headers['if-none-match'];delete req.headers['if-modified-since'];
   const writeHead=res.writeHead;
   res.writeHead=function(...args){this.setHeader('Cache-Control','no-store');return writeHead.apply(this,args);};next();
  });
  const fixture=await createAuditServer({port:Number(process.env.AUDIT_ROOM_PORT||8942),browser:true});
  server.httpServer.once('close',()=>fixture.dispose());
 }
}],server:{host:'127.0.0.1',port:Number(process.env.AUDIT_PORT||5188),strictPort:true,proxy:{'/arena-room':{target:'http://127.0.0.1:'+(process.env.AUDIT_ROOM_PORT||8942),ws:true},'/api':{target:'http://127.0.0.1:'+(process.env.AUDIT_ROOM_PORT||8942),ws:true},'/test':{target:'http://127.0.0.1:'+(process.env.AUDIT_ROOM_PORT||8942)}}}};
