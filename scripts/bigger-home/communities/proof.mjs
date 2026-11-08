import sharp from 'sharp';import {readFileSync,writeFileSync} from 'node:fs';
const O='../concepts/themes/world-map/bigger';
const label=(w,text)=>Buffer.from(`<svg width="${w}" height="50"><rect width="100%" height="100%" fill="#fff0c7"/><text x="24" y="33" font-family="Arial" font-size="23" fill="#39472d">${text}</text></svg>`);
await sharp({create:{width:3400,height:1450,channels:4,background:'#6ec9de'}}).composite([
 {input:label(1800,'LABELLED PLAN / five lived-in Home communities'),left:0,top:0},{input:O+'/home-communities.png',left:0,top:50},
 {input:label(1600,'BUILT HOME / production SVG art and placements'),left:1800,top:0},{input:O+'/home-built.png',left:1800,top:150}
]).png().toFile(O+'/home-vs-communities.png');
await sharp({create:{width:3600,height:1050,channels:4,background:'#fff0c7'}}).composite([
 {input:label(800,'CURSOR CAMP / visual reference only'),left:0,top:0},{input:O+'/../cursor-camp-paths-ref.jpg',left:0,top:190},
 {input:label(1400,'HOME ROAD JUNCTION / 0.8 pixels per world unit'),left:800,top:0},{input:O+'/home-community-crops/road-junction.png',left:800,top:50},
 {input:label(1400,'HOME VILLAGE LANE / 0.8 pixels per world unit'),left:2200,top:0},{input:O+'/home-community-crops/village-lane.png',left:2200,top:50}
]).png().toFile(O+'/home-paths-vs-reference.png');
console.log('Community and road comparison proofs saved.');
