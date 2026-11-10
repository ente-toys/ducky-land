import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
import {artResolution} from '../../src/pixi/art-resolution.js';
import {tileResolution,tileInView,GROUND_BUDGET_BYTES} from '../../src/pixi/ground-stream.js';
import {FAIR_ART_BUDGET_BYTES,FAIR_KITE_RESOLUTION} from '../../src/pixi/fair-raster.js';
import {homeArtwork,homeLayers} from '../globe-perf/snapshot.mjs';
import {layers,planned,allocation} from './model.mjs';
import sizes from '../../src/pixi/art-source-sizes.json' with {type:'json'};
import tiled from '../../src/pixi/large-art-tiles.json' with {type:'json'};
import poses from '../../src/pixi/sleep-poses.json' with {type:'json'};
const out=process.env.CRISP_OUT??'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/fair-review/fix/crisp',base=JSON.parse(readFileSync(out+'/baseline.json')),art=base.art,entries=layers(art),tiles=planned(art),MiB=n=>n/1048576;
const oldR=new Map(base.requests.map(([src,v])=>[src,v.before])),actualSizes={...base.actualSizes},homeR=new Map(),homeSources=homeArtwork();
for(const p of homeSources)homeR.set(p.src,Math.max(homeR.get(p.src)??0,artResolution(p,p.resolution??1)));
const group=({kind,p})=>kind==='ground'?'ground, grass and baked paths':kind==='decks'?'bridge decks':kind==='flats'?'flat decals':/lamp/.test(p.src)?'lamp posts':/banner/.test(p.src)?'banners':/carousel|teacup-ride|swing-ride|ferris-wheel/.test(p.src)?'rides':/\/tree-/.test(p.src)?'trees':/\/bush-/.test(p.src)?'bushes':/bench/.test(p.src)?'benches':'other standing art';
const records=entries.map(l=>{const {p,src,kind}=l,[w,h]=actualSizes[src],scale=Math.max(p.width/w,p.height/h)*(p.scale??1),requested=kind==='ground'?null:oldR.get(src),homeFirst=kind==='ground'?null:homeR.get(src)??requested;
 return {id:p.id??p.src,kind,group:group(l),src,sourceSize:[w,h],placedSize:[p.width*(p.scale??1),p.height*(p.scale??1)],spriteScale:scale,requestedResolution:requested,expectedHomeFirstResolution:homeFirst,before:Object.fromEntries([.6,1.8].map(z=>[z,(kind==='ground'?tileResolution({...p,src},z,2):homeFirst)/(scale*z*2)])),after:Object.fromEntries([.6,1.8].map(z=>[z,tileResolution({screenResolution:true,resolution:4},z,2)/(z*2)]))};});
const groups={};for(const r of records){const g=groups[r.group]??={count:0,beforeDefault:[Infinity,0],beforeMax:[Infinity,0],afterDefault:[Infinity,0],afterMax:[Infinity,0]};g.count++;for(const [key,val]of [['beforeDefault',r.before[.6]],['beforeMax',r.before[1.8]],['afterDefault',r.after[.6]],['afterMax',r.after[1.8]]]){g[key][0]=Math.min(g[key][0],val);g[key][1]=Math.max(g[key][1],val);}}
const sleep=Object.fromEntries(Object.entries(poses.poses).map(([name,p])=>{const scale=p.k*.81*(.88*.24*3)/3/poses.F;return [name,{scale,resolution:1,defaultDensity:1/(scale*1.2),maxDensity:1/(scale*3.6)}]}));
const home=[];for(const [kind,ps]of Object.entries(homeLayers()))for(const p of ps){let size=sizes[p.src];if(!size){const m=await sharp(p.src.startsWith('/assets/')?p.src.slice(1):'public'+p.src).metadata();size=[m.width,m.height];}const scale=Math.max(p.width/size[0],p.height/size[1])*(p.scale??1),r=homeR.get(p.src)??1;home.push({id:p.id??p.asset??p.src,kind,src:p.src,spriteScale:scale,resolution:r,densityDefault:(kind==='tiles'?tileResolution(p,.6,2):r)/(scale*1.2),densityMax:(kind==='tiles'?tileResolution(p,1.8,2):r)/(scale*3.6)});}
const views=[];for(const [width,height]of [[1000,600],[1400,1000],[1985,1180],[2560,1440]])for(const zoom of [Math.min(width/1500,height/1000),1.8]){
 const camera={x:3500,y:2400,zoom},newA=allocation(tiles,camera,width,height);let beforeGroundBytes=0;for(const p of art.ground.tiles){const src=p.src.startsWith('/')?p.src:'/pixi-art/themes/fair/'+p.src;if(!tileInView(p,camera,width,height))continue;const r=tileResolution({...p,src},zoom,2),size=actualSizes[src];beforeGroundBytes+=Math.ceil(size[0]*r)*Math.ceil(size[1]*r)*4;}
 views.push({width,height,zoom,beforeGroundMiB:MiB(beforeGroundBytes),beforeFixedFairArtMiB:MiB(base.beforeBytes),beforeSubtotalMiB:MiB(beforeGroundBytes+base.beforeBytes),afterGroundMiB:MiB(newA.ground),afterArtMiB:MiB(newA.art),afterSubtotalMiB:MiB(newA.ground+newA.art),afterMinDensity:Math.min(...newA.visible.map(t=>t.resolution/(2*zoom)))});
}
const sourceBytes=async(src,r)=>{const m=await sharp('public'+src).metadata();return Math.ceil(m.width*r)*Math.ceil(m.height*r)*4;};
const {KITE_ASSETS}=await import('../../src/pixi/home-kites.js');let kiteBefore=0,kiteAfter=0;for(const src of KITE_ASSETS){kiteBefore+=await sourceBytes(src,2);kiteAfter+=await sourceBytes(src,FAIR_KITE_RESOLUTION);}
let homePermanent=0;const groundHome=new Set(homeSources.filter(p=>p.kind==='ground').map(p=>p.src));for(const [src,r]of homeR){if(groundHome.has(src))continue;let size=sizes[src];if(!size){const m=await sharp(src.startsWith('/assets/')?src.slice(1):'public'+src).metadata();size=[m.width,m.height];}homePermanent+=Math.ceil(size[0]*r)*Math.ceil(size[1]*r)*4;}
let fairUnique=0;for(const [src,p]of base.requests)if(!homeR.has(src))fairUnique+=Math.ceil(p.size[0]*p.before)*Math.ceil(p.size[1]*p.before)*4;
const centres=[{x:3500,y:2700},...entries.map(({p})=>({x:p.x,y:p.y-p.height*(p.scale??1)/2}))],worst={ground:0,art:0,combined:0};
for(const [w,h]of [[1000,600],[1400,1000],[1985,1180],[2560,1440]])for(const z of [Math.min(w/1500,h/1000),1.8])for(const c of centres){const a=allocation(tiles,{...c,zoom:z},w,h);worst.ground=Math.max(worst.ground,MiB(a.ground));worst.art=Math.max(worst.art,MiB(a.art));worst.combined=Math.max(worst.combined,MiB(a.ground+a.art));}
const report={method:'Calculated RGBA8 decoded/upload allocations, not GPU/driver measurements. Fair art counts pool reservations conservatively, including shared bridge-over copies.',defaultCamera:'viewport dependent: min(CSS width/1500, CSS height/1000). Reference 1000x600 CSS = 0.6, DPR 2. Constructor 0.6 is overwritten by resize.',maxZoom:1.8,dpr:2,groups,sleep,records,home,views,memory:{beforeFixedFairArtMiB:MiB(base.beforeBytes),beforeFairIncrementalExcludingHomeSharedMiB:MiB(fairUnique),homePermanentMiB:MiB(homePermanent),homePermanentAfterMiB:MiB(homePermanent),kiteFairBeforeMiB:MiB(kiteBefore),kiteFairAfterMiB:MiB(kiteAfter),sharedGroundBudgetMiB:MiB(GROUND_BUDGET_BYTES),fairArtBudgetMiB:MiB(FAIR_ART_BUDGET_BYTES),worstSampledMiB:worst},legacyFairLargeArtEntries:Object.keys(tiled.fair??{}).length,largestNewTexturePixels:[514,514]};
writeFileSync(out+'/audit.json',JSON.stringify(report,null,2)+'\n');
const fmt=n=>n.toFixed(3),range=a=>Math.abs(a[0]-a[1])<.0005?fmt(a[0]):a.map(fmt).join(' to ');
const rows=Object.entries(groups).map(([name,g])=>`| ${name} (${g.count}) | ${range(g.beforeDefault)} | ${range(g.beforeMax)} | ${range(g.afterDefault)} | ${range(g.afterMax)} |`).join('\n');
const viewRows=views.map(v=>`| ${v.width}x${v.height}, z=${fmt(v.zoom)} | ${v.beforeSubtotalMiB.toFixed(2)} | ${v.afterGroundMiB.toFixed(2)} + ${v.afterArtMiB.toFixed(2)} = ${v.afterSubtotalMiB.toFixed(2)} | ${fmt(v.afterMinDensity)} |`).join('\n');
const homeCategory=(re)=>home.filter(p=>re.test(p.src));const hd=(re,k)=>range([Math.min(...homeCategory(re).map(p=>p[k])),Math.max(...homeCategory(re).map(p=>p[k]))]);
const text=`# Fair crispness diagnosis and fix

Working tree only. No commit, push or publish. Layout, paths, bridges, benches, plants, counts and SVG artwork are unchanged.

## Why SVG art was soft

SVG is decoded once into a bitmap by Pixi's loadSVG parser. Rendering a vector source does not keep its edges vector at draw time. Effective density is raster resolution / (maximum absolute sprite-axis scale * camera zoom * DPR). Below 1.0 means magnification of already-rasterised pixels. Sprite scale includes width/source-width, height/source-height and placement.scale, rather than placement.scale alone.

The normal zoom is viewport dependent: engine.resize uses min(CSS width/1500, CSS height/1000); the constructor's 0.6 is temporary. At 1000x600 CSS and DPR 2, normal zoom is 0.6; maximum zoom is 1.8. The attached WebP is 2000x1257 physical pixels including browser chrome, so it cannot establish the original CSS game viewport or exact camera zoom. Evidence uses 1000x600 CSS, DPR 2, normal zoom 0.6, the same central Fair patch. Additional 1400x1000, 1985x1180 and 2560x1440 CSS defaults are audited and tested.

| Fair layer | Before default 0.6 | Before max 1.8 | After default 0.6 | After max 1.8 |
| --- | ---: | ---: | ---: | ---: |
${rows}
| sleeping Duckies, all 8 poses | ${range([Math.min(...Object.values(sleep).map(p=>p.defaultDensity)),Math.max(...Object.values(sleep).map(p=>p.defaultDensity))])} | ${range([Math.min(...Object.values(sleep).map(p=>p.maxDensity)),Math.max(...Object.values(sleep).map(p=>p.maxDensity))])} | unchanged | unchanged |
| kites, including stake | 1.667 minimum | 0.556 minimum | 3.021 minimum | 1.007 minimum |

The central lamps have intrinsic boxes about 29x82, placed around 125x354 world units, scale 4.322x. Banners use 41x93 at about 176x399, scale 4.3x. Rides use about 240x229 at 1032x985, scale 4.3x. Their 2x bitmap is drastically undersampled even at normal zoom. Example lamp resolution 2 / (4.322 * 0.6 * 2) = 0.386; at maximum zoom it is 0.129. Many outer hamlet props request only 1.5x despite 1.7 to 2.1x placement scales.

Grass and paths are in the ground SVG tiles, not a separate path deck. Central ground is capped at 1x, outer ground at 0.8x. GroundPool takes min(authored cap, screen demand), so its demand logic could never recover those missing pixels. The 12 decks in this manifest are the existing river bridges. large-art-tiles.json has ${Object.keys(tiled.fair??{}).length} entries for Fair at this baseline, so pre-generated 1.5x decorative tiles were not the cause. No legacy tile files needed regeneration. The fix crops original SVGs lazily at runtime and needs no duplicated SVG tile files.

Before figures use expected Home-first leases for shared URLs, since the engine's lease cache is keyed by URL and Home loads first. Per-entry requested resolution, source dimensions, actual placement scale and expected shared resolution are in crisp/audit.json. Fair-only centre artwork is unaffected by that cache ambiguity. Independent Fair crop keys also prevent a prior Home lease from limiting the new requested resolution.

## Sampling, texture limits and bakes

engine renderer resolution remains min(devicePixelRatio,2), autoDensity true. It was already correct for the boss's DPR-2 display. Pixi ImageSource uses linear filtering, autoGenerateMipmaps false. Linear filtering smooths an enlarged low-resolution bitmap; nearest filtering would expose bigger pixels, not restore detail. No setting change is needed. No RenderTexture or cacheAsTexture bake sits between Fair's visible ground/props and the scene at play zoom. Globe snapshots are overview-only. Sleeper cacheAsTexture applies only to intentionally faint contact shadows, not the Ducky figure.

The SVG parser does not apply a silent MAX_TEXTURE_SIZE resolution clamp. Actual device MAX_TEXTURE_SIZE could not be queried here. New ground crop textures are at most 514x514, other art at most 386x386, safely below even a 4096 texture limit. The unchanged low-resolution globe/terrain fallback is a loading/overview placeholder, not a steady-state detail layer. Full browser upload validation is still required, as described below.

## Fix and memory

Fair ground is cropped into at most 128.5-world-unit pieces; props/decks/flats use at most 96.5. The original complete SVG and viewBox are nested unchanged under the crop viewport. Alpha-only bounds discard transparent gutters with a 2-world-unit safety pad. Half a world unit of overlap prevents independently antialiased crop seams. Alpha crop plans are 74.3 KiB of metadata; regenerate with node scripts/fair-crisp/bounds.mjs after Fair art/dimension changes.

Each visible crop rasterises at ceil(zoom * DPR * 16)/16, up to 4.0. Scale is now 1 world unit per logical texture unit. At normal zoom 0.6 the requested 1.25x gives 1.042 texels/device-pixel; at 1.8 the requested 3.625x gives 1.007. Resolutions also reach the density floor at every other tested viewport default. Standing containers retain authored position, anchor, mirror, depth sorting, wind and collision records. Kites use a Fair-only 3.625x lease; sleepers were already sufficiently sampled at rest.

Naively rasterising all Fair art at maximum zoom would require about 824.20 MiB. Previously Fair's fixed non-ground texture set alone was ${MiB(base.beforeBytes).toFixed(2)} MiB, or ${MiB(fairUnique).toFixed(2)} MiB incremental after Home-shared URLs. Now only visible art crops stay leased. Home and every other island retain the original paths and resolution policy. Shared code adds opt-in stream loader/relative-position/resolution support; existing resolution defaults are unchanged. It also fixes a shared accounting bug: a replacement must reserve both its old live texture and its pending decode, rather than subtracting the old bytes early. Zoom/pan tests exercise the resulting hard caps and retain the sampling floor.

The existing shared Home/neighbor ground pool stays at **128 MiB**, including pending decodes. Fair's other art is bounded by **80 MiB**, replacing its previous 88.30 MiB fixed set. The 80 MiB pool plus the independent 8.04 MiB Fair kite textures remain below 88.30 MiB, including when Home retains its original shared kites. Kites are separate: ${MiB(kiteBefore).toFixed(2)} to ${MiB(kiteAfter).toFixed(2)} MiB for a standalone Fair set; Home's original kite lease is unchanged. Home permanent authored textures stay ${MiB(homePermanent).toFixed(2)} MiB before and after. The memory figures below exclude unchanged Ducky/outfit caches, terrain/globe previews, Graphics atlases, framebuffers and driver overhead. They are texture allocation calculations, not measured total GPU usage.

| Reference view at x=3500, y=2400 | Before ground + fixed Fair art MiB | After ground + streamed Fair art MiB | After minimum density |
| --- | ---: | ---: | ---: |
${viewRows}

Across all ${centres.length} art/ground-centred camera samples at default and maximum zoom for four viewports, worst separate reservations were ${worst.ground.toFixed(2)} MiB ground and ${worst.art.toFixed(2)} MiB Fair art. Worst simultaneous sum was ${worst.combined.toFixed(2)} MiB. These are below each unchanged/reallocated cap, without budget-driven resolution reduction. The 128 MiB cap enforced by existing shared-ground tests is unchanged. Fair-owned art plus sharp kites fit below its former 88.30 MiB standalone allocation. Shared Home URLs previously avoided 11.18 MiB of duplicate standalone accounting; the new independent crop leases can therefore add at most 10.92 MiB to the theoretical unique-texture envelope when both independent caps are simultaneously saturated. The sampled simultaneous ground/art maximum is substantially below the previous 128 MiB ground cap plus 77.12 MiB incremental Fair art. There is no claim that a sum of two independent pool caps is measured live GPU residency. Shared-source estimates and steady-state reference-view sums should not be confused with driver resident/peak GPU readings.

## Home comparison

Home's native plants request resolution 5 and benches request 0.9/1.4, unlike Fair's enlarged miniature centre kit. At the same default 0.6 and maximum 1.8: Home trees ${hd(/\/plants\/tree-/, 'densityDefault')} / ${hd(/\/plants\/tree-/, 'densityMax')}; Home bushes ${hd(/\/plants\/bush-/, 'densityDefault')} / ${hd(/\/plants\/bush-/, 'densityMax')}; Home benches ${hd(/bench/, 'densityDefault')} / ${hd(/bench/, 'densityMax')}. Home's approved grass can also hit its existing 1x cap; that does not justify retaining Fair's additional 4.3x magnification of centre assets. Full Home layer numbers are in crisp/audit.json. No Home art, placement, style, zoom, source lease or sampling default changes in this fix.

## Evidence and validation

crisp/before.png and crisp/after.png are 2000x1200 device-pixel software renders of exactly the same static patch. Camera x=3500, y=2400, zoom=0.6 includes the boss's area around x=3500, y=2700. Left/right comparison: crisp/side-by-side.png. Maximum-zoom counterparts use the same camera and zoom=1.8. Rasterisation occurs at the production resolution before linearly sampling the bitmaps, rather than directly rendering vectors at output size. Layout, art and rest poses are identical. The before image uses the saved baseline manifest/resolutions; the after image uses the production Fair crop planner. Sleeping figures are kept at rest in both.

These are **software texture proofs, not browser/WebGL screenshots**. Local listen(127.0.0.1:5328) returned EPERM; headless Chromium launch was also denied. This session cannot verify the actual Mac Chrome MAX_TEXTURE_SIZE, driver allocations, frame time or browser appearance. No browser/GPU result is claimed. Reproduction: node scripts/fair-crisp/evidence.mjs, node scripts/fair-crisp/audit.mjs. Source-sized SVG cropping and real ImageSource raster dimensions/lease disposal are exercised in non-socket tests with the native canvas adapter.

Validation: npx vite build --configLoader native passed (10.69 s). The full non-socket suite passed 413/413 tests, including 9 new Fair crispness tests. Command: node --test --test-skip-pattern='two actual socket clients' $(rg --files qa -g '*.test.mjs' | rg -v '/multiplayer.test.mjs$'). The socket/Miniflare multiplayer file (22 tests) and the one actual-socket network test are deliberately excluded; the two non-socket network tests still run. git diff --check passed. Build and test logs are retained in crisp/build.log and crisp/tests.log.
`;
writeFileSync(out+'/../CRISP.md',text);console.log(JSON.stringify({groups,memory:report.memory,views},null,2));
