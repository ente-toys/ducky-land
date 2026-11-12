export function tightenPlan(P) {
 const homes={
  butterbill:[[110,135],[230,128],[342,239],[122,340],[247,342]],
  lanternleaf:[[643,128],[746,106],[852,106],[960,158],[962,250],[604,255]],
  clovercrust:[[1235,183],[1378,188],[1500,226],[1486,353],[1312,358]],
  petalpatch:[[157,751],[57,819],[266,752],[111,972],[185,1051],[331,1033]],
  reedwhistle:[[1140,982],[1255,936],[1397,973],[1167,1124],[1290,1124],[1372,1070]]
 };
 for(const c of P.communities)c.homes=c.homes.map((p,i)=>[...homes[c.id][i],p[2]]);
 for(const c of P.communities){c.green[2]*=.71;c.green[3]*=.68;}
}
export function villageRoads() {
 const main=[[303,322],[410,327],[441,311],[583,302],[650,300],[705,267],[716,246],[750,246],[777,230],[797,244],[969,294],[1113,300],
 [1200,376],[1229,416],[1262.2134297974476,454.15351855108963],[1262.2,469],[1284,470],[1295,500],[1325,529],[1374,543],[1373,580],[1310,620],
 [1260,666],[1199,793],[1202,871],[1190,930],[1194,984],[1254,1028],[1132,1060],[999,1030],
 [926.3604450187465,999.4421745983524],[875,966],[765,980],[650,944],[577,912],
 [457,931],[351,939],[294,942],[263,917],[227,901],[174,885],[174,861],[219,823],[214,780],[213,735],[270,705],
 [295,676],[330,540],[299,434],[303,322]];
 const roads=[{id:'village-loop',kind:'main',p:main,w:23}];
 const lane=(id,p,w=10)=>roads.push({id,kind:'lane',p,w});
 lane('bakery-square',[[303,322],[263,291],[208,266]],15);
 lane('bakery-doors',[[110,153],[177,171],[192,217],[208,266],[183,316],[170,359],[122,359]],10);
 lane('bakery-north',[[230,146],[315,160],[391,204],[393,264],[342,258]],10);
 lane('bakery-south',[[247,360],[299,361],[304,312],[263,291]],10);
 lane('garden-west',[[604,273],[650,287],[699,246],[689,229],[650,186],[643,146]],10);
 lane('garden-north',[[797,244],[797,195],[746,128]],10);
 lane('garden-east',[[797,195],[852,128]],9);
 lane('garden-porches',[[969,294],[962,272],[915,238],[960,180]],10);
 lane('farm-square',[[1113,300],[1143,294],[1252,309],[1391,301],[1430,311],[1518,323],[1547,359],[1547,382],[1486,373]],15);
 lane('farm-north',[[1235,201],[1281,237],[1320,247],[1330,286],[1391,301]],10);
 lane('farm-east',[[1378,210],[1431,250],[1500,248]],10);
 lane('farm-south',[[1312,376],[1404,376],[1430,335],[1391,301]],10);
 lane('makers-square',[[222,864],[174,861],[102,888],[111,994]],14);
 lane('makers-north',[[157,773],[174,807],[174,861],[57,841]],10);
 lane('makers-east',[[174,807],[235,799],[266,774]],9);
 lane('makers-south',[[185,1073],[213,1026],[277,939]],10);
 lane('makers-south-east',[[213,1026],[273,1060],[331,1055]],9);
 lane('fishing-west',[[1140,1004],[1191,1021],[1254,1028],[1255,958]],10);
 lane('fishing-east',[[1254,1028],[1315,1041],[1351,1038],[1397,995]],10);
 lane('fishing-porches',[[1167,1146],[1198,1102],[1254,1028]],10);
 lane('fishing-south',[[1198,1102],[1237,1151],[1290,1146]],9);
 lane('fishing-east-porch',[[1315,1041],[1312,1089],[1372,1089]],9);
 lane('heart-west',[[330,540],[419,593],[488,632]],21);
 lane('heart-makers',[[695,905],[650,916],[577,912]],16);
 lane('heart-reed',[[876,875],[876,895],[875,936],[875,966]],16);
 lane('heart-east',[[1045,804],[1063,770],[1078,727]],18);
 lane('quay-pier',[[1254,1028],[1166,1076],[1058,1110],[1010,1162],[946,1152],[894,1157],[874,1187],
 [834.8988261373296,1193.4478416726026],[760,1183],[699,1164]],13);
 lane('west-orchard',[[303,322],[215,397],[137,474]],9);
 lane('willow-green',[[1260,666],[1345,708],[1435,746]],9);
 lane('seedshare',[[969,294],[1015,261],[1047,231]],9);
 return roads;
}
export function sharedGardens({E,svg,custom,kit,reuse,plant,bench,flowers,at}) {
 const sizes={butterbill:[.93,1.08,.83,1.04,.89],lanternleaf:[1.04,.90,1.09,.87,.95,.93],
 clovercrust:[.90,1.08,.86,1.02,.95],petalpatch:[.87,.97,1.05,.86,.93,.83],reedwhistle:[.87,1.07,.89,.95,.86,.91]};
 for(const c of E.communities)for(const[i,id]of c.homes.entries()){
  const p=E.props.find(p=>p.id===id),s=sizes[c.id][i];p.scale=s;
  p.footprint.rx*=s;p.footprint.ry*=s;p.footprint.y=p.y-45*s;
  p.houseVariant.householdScale=s;
 }
 const shifts=[['butterbill','bakery',-54,8],['butterbill','cafe',9,-1],
 ['lanternleaf','garden-workbench',-123,-15],['lanternleaf','garden-wheelbarrow',-134,2],
 ['clovercrust','windmill',-4,-2],['clovercrust','glasshouse',100,-23],
 ['clovercrust','stall-fruit',-7,0],['clovercrust','stall-bread',-7,0],
 ['clovercrust','raised-bed-1179',-60,10],['clovercrust','raised-bed-1208',-63,12],['clovercrust','raised-bed-1254',-64,16],
 ['petalpatch','pottery-bench',-10,20],['petalpatch','easel',-4,16],
 ['reedwhistle','boat-mender',102,1],['reedwhistle','net-rack',-82,22]];
 for(const[z,name,dx,dy]of shifts)for(const p of E.props.filter(p=>p.zone===z&&p.asset===name)){
  p.x+=dx/.18;p.y+=dy/.18;if(p.footprint){p.footprint.x+=dx/.18;p.footprint.y+=dy/.18;}
 }
 svg('shared-well',330,300,`<ellipse cx="166" cy="267" rx="132" ry="28" fill="#7d9e3a" stroke="none" opacity=".25"/><ellipse cx="165" cy="194" rx="105" ry="43" fill="#a89967"/><path d="M60 194V246Q165 296 270 246V194" fill="#d9cc99"/><path d="M63 224Q165 267 267 224 M113 209V258 M208 210V258" fill="none" stroke="#a89967" stroke-width="6"/><ellipse cx="165" cy="194" rx="105" ry="40" fill="#fff0c7"/><ellipse cx="165" cy="194" rx="78" ry="25" fill="#6ec9de"/><path d="M70 195V50 M260 195V50 M69 92H260" fill="none" stroke="#c88941" stroke-width="13"/><path d="M32 66L165 6L299 66L278 84L165 36L52 84Z" fill="#df7050"/><path d="M165 93V182" fill="none" stroke="#885931" stroke-width="4"/><path d="M145 173H187L181 205H151Z" fill="#c88941"/>`);
 custom('shared-well',813,234,330,300,'lanternleaf',[85,29,15],.72);
 kit('bucket',836,229,.10,'lanternleaf',[17,14,6]);
 const quayHerbs=E.props.find(p=>p.zone==='reedwhistle'&&p.asset==='herb-box'&&Math.abs(p.x-(1328-278)/.18)<1);
 quayHerbs.x=(1425-278)/.18;quayHerbs.y=(1048-204)/.18;quayHerbs.footprint.x=quayHerbs.x;quayHerbs.footprint.y=quayHerbs.y-12;
 bench(313,294,'butterbill');flowers(309,280,'butterbill');
 bench(1403,328,'clovercrust');flowers(1444,317,'clovercrust');
 bench(138,930,'petalpatch');flowers(53,900,'petalpatch');
 bench(1331,1083,'reedwhistle');flowers(1326,1091,'reedwhistle');
 for(const[x,y]of [[32,107],[69,81],[112,69],[390,54],[454,36]])reuse('apple-tree-1589',x,y,'butterbill',[31,22,9]);
 for(const[x,y]of [[546,78],[573,48],[608,22],[925,22],[990,48]])plant('tree-4',x,y,'lanternleaf',1.08);
 for(const[x,y]of [[686,36],[721,42],[754,33]])reuse('raised-bed-1179',x,y,'lanternleaf',[115,28,15]);
 for(const[x,y]of [[1184,57],[1221,38],[1462,54],[1500,70],[1559,107]])reuse('apple-tree-1589',x,y,'clovercrust',[31,22,9]);
 for(const[x,y]of [[1517,401],[1560,378],[1600,344]])reuse('raised-bed-1179',x,y,'clovercrust',[115,28,15]);
 for(const[x,y]of [[-50,721],[-51,781],[-34,935],[27,1044],[74,1092]])plant('tree-4',x,y,'petalpatch',1.03);
 for(const[x,y]of [[-6,705],[22,691],[53,702]])custom('herb-box',x,y,260,125,'petalpatch',[95,25,12],.9);
 for(const[x,y]of [[1540,930],[1550,972],[1490,1025],[1450,1060]])plant('tree-4',x,y,'reedwhistle',1.06);
 for(const[z,x,y]of [['butterbill',182,335],['lanternleaf',799,112],['lanternleaf',901,132],
 ['clovercrust',1302,180],['petalpatch',124,1022],['reedwhistle',1202,952],['reedwhistle',1356,954]]){
  plant('bush-2',x,y,z,1.18);flowers(x+12,y+4,z);
 }
 E.version='dense';
}
export function gardenGround(curve) {
 let g='';
 for(const [cx,cy,rx,ry]of [[87,79,85,37],[719,26,74,42],[1502,390,96,37],[-5,703,63,33],
 [1492,1112,64,70],[379,88,48,39]]){
  g+=`<path d="${curve([[cx-rx,cy],[cx-rx*.5,cy-ry],[cx+rx*.5,cy-ry*.8],[cx+rx,cy],[cx+rx*.4,cy+ry],[cx-rx*.7,cy+ry*.6]])}" fill="#b1c944" opacity=".46"/>`;
 }
 for(const [x,y,w]of [[658,20,109],[1485,383,98],[-34,690,84]]){
  g+=`<path d="M${x},${y}q${w*.4}-10 ${w} -4l9 29q-${w*.5} 12 -${w+6} 3Z" fill="#a27b40" stroke="#b1c944" stroke-width="3"/>`;
  for(const dy of [7,15,23])g+=`<path d="M${x+5},${y+dy}q${w*.4}-7 ${w-8} -3" fill="none" stroke="#e0b66e" stroke-width="1.2"/>`;
 }
 return g;
}
