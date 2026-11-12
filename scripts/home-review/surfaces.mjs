import {readFileSync,writeFileSync,mkdirSync,readdirSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const F='src/pixi/home-expansion.json', E=JSON.parse(readFileSync(F));
let painter=readFileSync('scripts/home-10/ground.mjs','utf8');
const a=painter.indexOf('const roadD ='),b=painter.indexOf('// water: every river',a);
painter=painter.slice(0,a)+"g += readFileSync('scripts/home-review/path-surface.svgfrag','utf8');\n"+painter.slice(b);
painter=painter.replace('const S = SHORE ?', 'const S = !E.reviewWater && SHORE ?');
painter=painter.replace('const MOUTHS = [', 'const MOUTHS = E.reviewWater ? E.riverMouths.map(([x,y,X,Y])=>[[x,y],[X,y],[X,Y],[x,Y]]) : [');
const wa=painter.indexOf('// water: every river'), wb=painter.indexOf('const tiles =',wa);
painter=painter.slice(0,wa)+"g += readFileSync('scripts/home-review/water-surface.svgfrag','utf8');\n"+painter.slice(wb);
const tail=painter.indexOf('// ---------- the river crossings:');
painter=painter.slice(0,tail)+`\nwriteFileSync('${F}',JSON.stringify({...E, riverWater, tiles, groundDecals:[...decals,...(E.hamletDecals??[]).map(({hamlet,...d})=>d)]},null,2)+'\\n');\n`;
const runtime='scripts/home-review/.ground-runtime.mjs';
writeFileSync(runtime,painter);
try{execFileSync('node',[runtime],{stdio:'inherit'});}finally{unlinkSync(runtime);}
const frag=readFileSync('scripts/home-review/path-surface.svgfrag','utf8'), water=readFileSync('scripts/home-review/water-surface.svgfrag','utf8');
const end=(s,k)=>{let depth=0;const re=/<g\b[^>]*>|<\/g>/g;re.lastIndex=k;for(let m;(m=re.exec(s));){depth+=m[0].startsWith('</')?-1:1;if(!depth)return re.lastIndex;}throw Error('unclosed group');};
for(const dir of ['public/pixi-art/home-expansion','public/pixi-art']) for(const n of readdirSync(dir).filter(n=>/^ground-r\d-c\d\.svg$/.test(n))){
 const f=dir+'/'+n;let s=readFileSync(f,'utf8');
 for(const name of ['Home unified paths','Continuous footpaths','Home water union','Lighthouse beach','Lighthouse beach Lit','Lighthouse beach worn edge']) {let i;while((i=s.indexOf('<g data-name="'+name+'"'))>=0)s=s.slice(0,i)+s.slice(end(s,i));}
 s=s.replace('</svg>',frag+water+'</svg>');
 writeFileSync(f,s);
}
console.log('Merged path surface painted across original and expansion ground.');
