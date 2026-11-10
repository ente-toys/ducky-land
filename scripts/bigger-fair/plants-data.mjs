// Authored world-space feet and heights, in small nested groves with low skirts.
// No random/scatter pass. Open gaps separate each grove and leave coast views.
// [Home model, x, y, scale]. The NE hill, south rest place and kite pockets
// remain unplanted, for the separate life/feature composition.
export const OUTER_PLANTING = {
 'northwest-coast': [
  ['tree-3',-910,-690,.92],['tree-1',-660,-785,.86],['tree-5',-420,-830,.9],
  ['tree-4',-800,-530,.88],['tree-4',-530,-590,.8],
  ['bush-4',-1040,-620,1.05],['bush-1',-940,-485,1.05],['bush-2',-755,-440,1],
  ['bush-3',-570,-475,.95],['bush-1',-355,-620,.9],
 ],
 'north-coast-west': [
  ['tree-1',180,-915,.92],['tree-3',430,-920,.88],['tree-5',670,-965,.9],
  ['tree-4',300,-750,.78],['tree-4',580,-770,.82],
  ['bush-1',55,-840,1],['bush-4',180,-720,1.05],['bush-2',430,-745,.95],
  ['bush-3',655,-735,1],['bush-4',800,-870,.9],
 ],
 'north-coast-pond': [
  ['tree-3',1150,-990,.96],['tree-1',1410,-1040,.9],['tree-5',1660,-1070,.94],
  ['tree-4',1280,-830,.8],['tree-2',1540,-855,.82],
  ['bush-4',990,-890,1.1],['bush-1',1115,-760,1],['bush-3',1350,-815,.96],
  ['bush-2',1575,-825,1],['bush-4',1800,-950,1],
 ],
 'north-coast-gap': [
  ['tree-5',2070,-1100,.84],['tree-3',2270,-1120,.88],['tree-4',2140,-955,.84],
  ['bush-1',1935,-1000,.95],['bush-4',2050,-875,1],['bush-3',2290,-940,1],
 ],
 'cloudpop-northwest-border': [
  ['tree-3',3140,-1180,.78],['tree-2',3370,-1180,.68],['tree-4',3580,-1130,.78],
  ['bush-1',2990,-1110,.9],['bush-4',3170,-1060,.86],
  ['bush-3',3400,-1070,.9],['bush-2',3650,-1110,.88],
 ],
 'cloudpop-northeast-border': [
  ['tree-1',4760,-1100,.8],['tree-5',5000,-1090,.75],['tree-4',5220,-1080,.75],
  ['bush-1',4590,-1100,.85],['bush-4',4820,-1090,.86],
  ['bush-3',5080,-1090,.8],['bush-2',5400,-1080,.85],
 ],
 'north-coast-east': [
  ['tree-3',7060,-820,.9],['tree-1',7300,-790,.9],['tree-5',7530,-710,.95],
  ['tree-4',7140,-640,.82],['tree-2',7410,-590,.86],
  ['bush-4',6900,-960,1],['bush-1',7080,-975,1.1],['bush-3',7300,-960,.98],
  ['bush-2',7510,-900,1],['bush-4',7680,-570,.95],
 ],
 'west-meadow': [
  ['tree-3',260,0,.96],['tree-5',500,160,.9],['tree-1',300,260,.88],
  ['tree-4',50,60,.8],['tree-4',140,230,.8],
  ['bush-4',90,-100,1],['bush-1',500,370,1],['bush-3',300,430,.95],
  ['bush-2',450,510,.95],
 ],
 'west-coast-shoulder': [
  ['tree-5',-1540,-335,.9],['tree-1',-1330,-465,.84],['tree-4',-1425,-190,.86],
  ['bush-4',-1640,-200,1],['bush-3',-1530,-90,.9],['bush-1',-1270,-315,.95],
 ],
 'southwest-meadow': [
  ['tree-1',-200,4620,.9],['tree-5',-30,4450,.9],['tree-3',-270,4810,.84],
  ['bush-1',0,4650,1],['bush-4',-440,4750,1],['bush-2',-320,4580,.95],
  ['bush-3',-165,4730,.95],
 ],
 'sugarspoon-east': [
  ['tree-3',4700,5130,.92],['tree-5',4940,5180,.9],['tree-1',5180,5160,.88],
  ['tree-4',4795,5320,.82],['tree-4',5060,5330,.78],
  ['bush-4',4530,5230,1],['bush-1',4650,5300,1],['bush-3',4890,5310,.95],
  ['bush-2',5170,5310,1],['bush-4',5350,5230,.95],
 ],
 'south-coast-east': [
  ['tree-5',6030,5600,.9],['tree-3',6260,5600,.9],['tree-1',6500,5680,.84],
  ['tree-4',6180,5710,.78],['tree-4',6420,5700,.8],
  ['bush-4',5870,5690,1],['bush-1',6030,5670,.95],['bush-3',6310,5670,.95],
  ['bush-2',6565,5650,1],['bush-4',6740,5640,1],
 ],
 'southeast-coast': [
  ['tree-3',7940,5130,.85],['tree-5',7990,4940,.86],['tree-1',8170,4750,.84],
  ['tree-4',7890,5240,.78],['tree-4',8140,5090,.8],
  ['bush-1',7760,5280,1],['bush-4',7750,5360,.95],['bush-3',7990,5210,.95],
  ['bush-2',8190,5040,.95],['bush-4',8350,4860,.9],
 ],
};

// Whole visible bases are kept outside these reserved feature/flight envelopes.
export const PLANT_RESERVES = [
 {name:'NE hill and entrance',x0:7070,y0:800,x1:7960,y1:1530},
 {name:'south picnic and entrance',x0:4520,y0:4160,x1:5460,y1:4930},
 {name:'NW kite pocket',x0:-940,y0:370,x1:-350,y1:900},
 {name:'SW kite pocket',x0:-1140,y0:3600,x1:-560,y1:4160},
 {name:'SE kite pocket',x0:5420,y0:4260,x1:5980,y1:4700},
];
