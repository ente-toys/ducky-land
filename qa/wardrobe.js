import {Application,Text} from 'pixi.js';
import {createDuck,getDuckWardrobe} from '../src/pixi/duck.js';
const params=new URLSearchParams(location.search),group=document.querySelector('#group'),action=document.querySelector('#action'),animate=document.querySelector('#animate'),status=document.querySelector('#status');
group.value=params.get('group')||'cap';action.value=params.get('action')||'0';let page=Number(params.get('page')||0),rigs=[],labels=[],generation=0;
const angles=[0,45,90,135,180,-135,-90,-45],cell=150,row=155;
const app=new Application();await app.init({width:1200,height:670,background:0xfff4d7,antialias:true,resolution:window.devicePixelRatio||1,autoDensity:true});document.body.append(app.canvas);
const wardrobe=await getDuckWardrobe();
const combinations=[{cap:2,shades:1,acc:4,shoes:2},{cap:3,acc:4,shoes:3},{cap:8,shades:2,acc:5,shoes:4},{cap:13,shades:3,acc:2,shoes:5}];
async function draw(){
 const version=++generation;status.textContent='Loading';rigs.forEach(r=>r.duck.dispose());rigs=[];labels.forEach(l=>l.destroy());labels=[];
 const entries=group.value==='outfits'?combinations.map((outfit,i)=>({name:`Combination ${i+1}`,outfit})):wardrobe.filter(e=>e.slot===group.value).map(e=>({...e,outfit:{[e.slot]:e.index}}));
 const pages=Math.ceil(entries.length/4);page=(page+pages)%pages;
 const addText=(text,x,y,size=13)=>{const label=new Text({text,style:{fontFamily:'system-ui',fontSize:size,fill:0x292929}});label.position.set(x,y);app.stage.addChild(label);labels.push(label);};
 angles.forEach((a,i)=>addText(`${a}°`,i*cell+65,8));
 for(const [r,entry]of entries.slice(page*4,page*4+4).entries()){
  addText(entry.name,12,34+r*row,15);
  for(const [c,angle]of angles.entries()){
   const duck=await createDuck({outfit:entry.outfit});if(version!==generation){duck.dispose();return;}
   duck.root.position.set(c*cell+75,r*row+165);duck.root.scale.set(.48);app.stage.addChild(duck.root);
   for(let i=0;i<100;i++)duck.update(.1,{turn:angle*Math.PI/180,action:0,reducedMotion:true,time:0});
   for(let i=0;i<4;i++)duck.update(.1,{turn:angle*Math.PI/180,action:Number(action.value),speed:Number(action.value)===1?165:0,reducedMotion:!params.has('fullMotion'),time:0});
   rigs.push({duck,angle});
  }
 }
 status.textContent=`${group.value} ${page+1}/${pages}: ${rigs.length} views`;
 const url=new URL(location);url.searchParams.set('group',group.value);url.searchParams.set('page',page);history.replaceState(null,'',url);
}
group.onchange=()=>{page=0;draw();};action.onchange=draw;document.querySelector('#prev').onclick=()=>{page--;draw();};document.querySelector('#next').onclick=()=>{page++;draw();};
app.ticker.add(ticker=>{if(animate.checked)for(const {duck,angle}of rigs)duck.update(ticker.deltaMS/1000,{turn:angle*Math.PI/180,action:Number(action.value),speed:Number(action.value)===1?165:0});});
await draw();
if(params.has('verify')){
 const {verifyWardrobe}=await import('./wardrobe-runtime.js');
 try{status.textContent=await verifyWardrobe(wardrobe);document.body.dataset.verification='passed';}
 catch(error){status.textContent=`FAIL: ${error.message}`;document.body.dataset.verification='failed';throw error;}
}
