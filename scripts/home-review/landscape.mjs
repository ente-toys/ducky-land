import {readFileSync,writeFileSync} from 'node:fs';
const F='src/pixi/home-expansion.json',E=JSON.parse(readFileSync(F));
const move=(id,x,y)=>{const p=E.props.find(p=>p.id===id);if(!p)throw Error(id);if(p.footprint){p.footprint.x+=x-p.x;p.footprint.y+=y-p.y;}p.x=x;p.y=y;if(p.z!==undefined)p.z=y;};
for(const [id,x,y] of [
 ['bigger-community-509',6360,2970],['hamlet-lanternleaf-bench-east',3200,-330],
 ['hamlet-petalpatch-birch-east',-210,3950],['hamlet-petalpatch-birch-northeast',-280,3390],
 ['hamlet-petalpatch-tulip-easel',-537.1,3922.2],
 ['hamlet-reedwhistle-fish-basket-a',3600,5420],['hamlet-reedwhistle-fish-basket-b',3640,5440],
 ['hamlet-butterbill-south-west-lamp',-1075,725],['hamlet-butterbill-west-lane-pot',-850,750],
 ['bigger-community-440',2245,290],['grow-bush-4',4050,430],['grow-tree-5',4800,410],
 ['bigger-community-472',730,4160],['bigger-community-476',-50,2670],['grow-bush-1',370,1670]
]) {if(E.props.some(p=>p.id===id))move(id,x,y);else E.reviewProps={...E.reviewProps,[id]:{x,y}};}
const add=(id,kind,x,y,k=1)=>{const sizes={'tree-1':[260,360],'tree-2':[180,360],'tree-3':[300,380],'tree-4':[200,280],'tree-5':[150,380],'bush-1':[130,100],'bush-2':[168,110],'bush-3':[116,104],'bush-4':[140,100],'flower-1':[48,36],'flower-2':[48,36],'flower-3':[44,36]};const [width,height]=sizes[kind];E.props.push({id:'review-'+id,name:kind,asset:kind,src:'/pixi-art/plants/'+kind+'.svg',x,y,width,height,scale:k,anchor:{x:.5,y:1},resolution:1.5,zone:'authored-commons'});};
E.props=E.props.filter(p=>!String(p.id).startsWith('review-'));
for(const v of [
 ['willow-oak','tree-3',6280,2820,1.12],['willow-round','tree-1',6490,2790,1.1],['willow-birch','tree-5',6660,2870,1.1],['willow-under-a','bush-2',6200,2860,1.15],['willow-under-b','bush-4',6710,2920,1.2],['willow-edge-a','flower-1',6160,2920,1.5],['willow-edge-b','flower-2',6750,2980,1.5],
 ['coast-oak','tree-3',6970,2310,1.1],['coast-round','tree-1',7160,2330,1.0],['coast-birch','tree-5',7300,2420,1.1],['coast-under','bush-2',6900,2370,1.2],['coast-low','bush-4',7350,2460,1.2],['coast-flowers','flower-3',6870,2440,1.5],
 ['pear-west','tree-1',620,-560,1.1],['pear-back','tree-3',820,-670,1.1],['pear-east','tree-2',1130,-640,1.1],['pear-low','bush-2',570,-480,1.15],['pear-flowers','flower-1',1200,-500,1.5],
 ['hay-oak','tree-3',2360,5100,1.1],['hay-birch','tree-5',2520,5120,1.0],['hay-low','bush-4',2230,5140,1.1],['hay-flowers','flower-2',2170,5195,1.5],
 ['south-under-a','bush-2',2730,3860,1.2],['south-under-b','bush-4',2860,3890,1.2],['south-flowers','flower-1',2660,3910,1.6],
 ['dune-a','bush-3',4340,2570,.8],['dune-b','bush-1',4400,2430,.75],['dune-c','bush-4',4870,3270,.7],['dune-d','flower-3',4750,3300,1.2]
])add(...v);
const copy=(id,source,x,y,k)=>{const q=E.props.find(p=>p.id===source);if(!q)throw Error(source);const p=structuredClone(q);p.id='review-'+id;delete p.communityRole;if(p.footprint){p.footprint.x+=x-p.x;p.footprint.y+=y-p.y;}p.x=x;p.y=y;p.z=y;p.scale=k??p.scale;E.props.push(p);};
copy('hay-work','hamlet-clovercrust-hay',2280,5320,.8);
for(const p of E.props){if(/sand-specks|grass-tuft|sand-detail|grass-detail/.test(p.asset+' '+p.id))delete p.footprint;
 if(p.communityRole==='home'||p.communityRole==='workplace'&&/barn|bakery/.test(p.id)){p.shadowSize=[p.width*.34,Math.min(24,p.width*.055)];p.shadowOffset=[0,-8];}
}
E.groundDecals=E.groundDecals.filter((d,i)=>!(d.x>6000&&d.x<7500&&d.y>2500&&d.y<3750&&i%3===0));
writeFileSync(F,JSON.stringify(E,null,2)+'\n');
