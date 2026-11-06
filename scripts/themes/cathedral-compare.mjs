// HOME reference stays at original pixel size. Both maps use .25 screen pixels per world unit.
import {render} from './cathedral-render.mjs';
import sharp from 'sharp';import {readFileSync,writeFileSync}from'node:fs';
const ROOT='public/pixi-art/themes/cathedral/',round=process.env.ROUND||'1';
const WORK='../concepts/themes/work/cathedral/';
const art=JSON.parse(readFileSync(ROOT+'art.json'));
const width=2000,height=1500,k=.25;
const cat=await render(art,{k,width,height,sleepers:true});
await sharp(cat).toFile(WORK+'cathedral-round-'+round+'.png');
await sharp(cat).toFile(WORK+'cathedral-preview.png');
await sharp(cat).resize(1160,870).toFile(WORK+'preview.png');
const title=t=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="58"><rect width="100%" height="100%" fill="#FFF6E1"/><text x="30" y="38" font-family="Arial" font-size="23" fill="#39472D">${t}</text></svg>`);
const home=await sharp('../concepts/themes/home-bigger-before-island.png').png().toBuffer();
const comparison=await sharp({create:{width:width*2,height:height+58,channels:4,background:'#6EC9DE'}}).composite([
{input:title('HOME | supplied in-game reference | original pixels'),left:0,top:0},
{input:home,left:200,top:258},
{input:title('CATHEDRAL | round '+round+' | asset render | same .25 overview zoom'),left:width,top:0},
{input:cat,left:width,top:58}]).png().toBuffer();
writeFileSync(WORK+'cathedral-vs-home.png',comparison);writeFileSync(WORK+'cathedral-vs-home-round-'+round+'.png',comparison);
console.log('Saved comparison, HOME left unchanged at original size; Cathedral right at zoom .25.');
