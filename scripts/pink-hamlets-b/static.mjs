import {render,read} from '../bigger-pink/render.mjs';
import sharp from 'sharp';
const dir='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/pink-fix';
const art=read('public/pixi-art/themes/pink/art.json');
for(const [name,view,k] of [['teacup',[7100,500,2900,2200],.44],['tutu-tides',[2850,4800,2900,2200],.44]]){
 await render(art,view,k,`${dir}/ingame/${name}-production-art.png`);
 await sharp({create:{width:2560,height:1000,channels:4,background:'#fff0cf'}}).composite([
 {input:await sharp(`${dir}/ingame/${name}-production-art.png`).resize(1280,960,{fit:'contain',background:'#fff0cf'}).png().toBuffer(),left:0,top:40},
 {input:await sharp(`${dir}/gpt/${name}.png`).resize(1280,960,{fit:'contain',background:'#fff0cf'}).png().toBuffer(),left:1280,top:40},
 {input:Buffer.from('<svg width="2560" height="40"><text x="20" y="27" font-size="20">Production SVG placement (static, browser capture blocked)</text><text x="1300" y="27" font-size="20">Approved blueprint</text></svg>'),left:0,top:0}]).png().toFile(`${dir}/ingame/${name}-comparison.png`);
}
