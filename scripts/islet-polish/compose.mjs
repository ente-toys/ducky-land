import {readFileSync,writeFileSync} from 'node:fs';
const authored={
 'odyssey':{lon:135,lat:-54,region:'Southern passage',reason:'Separate the horse from the Rosybutton-side cluster and give the southern sea a clear landmark.'},
 'tree-and-rowboat':{lon:-33,lat:20,region:'Home passage',reason:'Open a wider channel beside Home while keeping a recognisable nearby stop.'},
 'broken-shipwreck':{lon:-42,lat:54,region:'Northern passage',reason:'Bring the larger wreck into the open northern Home/Campfire passage.'},
 '04-small-mountain':{lon:-117,lat:11,region:'Campfire',reason:'Keep the waterfall as the quieter western stop.'},
 '05-lighthouse-rock':{lon:33,lat:-22,region:'Home southern passage',reason:'Put the lighthouse on the open Home-side sailing approach rather than on the Sunbob centre line.'},
 '06-palm-treasure':{lon:89,lat:-50,region:'Pagepond southern passage',reason:'Pair the southern treasure route with the horse, separated by open water.'},
 '07-pink-blossom':{lon:-123,lat:-49,region:'Rosybutton southern passage',reason:'Release the dense western Rosybutton cluster and create a loose southern pair with the volcano.'},
 '08-snow-igloo':{lon:14,lat:61,region:'Iceland',reason:'Retain the clear cold-water stepping stone below Iceland.'},
 '09-spooky-purple':{lon:-29,lat:-55,region:'Bog',reason:'Keep a quiet isolated arrival on the northern edge of Bog water.'},
 '11-volcano':{lon:-90,lat:-37,region:'Bellovo southern passage',reason:'Give the Bellovo/Rosybutton passage a second, unequal landmark.'},
 '12-coral-atoll':{lon:151,lat:-7,region:'Fair passage',reason:'Offset the coral lagoon from the vertical Fair/Pagepond alignment.'},
};
const docks={
 'odyssey':{foot:[480,705],heading:84},
 'tree-and-rowboat':{foot:[413.313,697.354],heading:28},
 'broken-shipwreck':{foot:[555,426],heading:-90},
 '04-small-mountain':{foot:[735,548],heading:-36},
 '05-lighthouse-rock':{foot:[305,620],heading:-150},
 '06-palm-treasure':{foot:[665,516],heading:-59},
 '07-pink-blossom':{foot:[265,515],heading:-128},
 '08-snow-igloo':{foot:[510,350],heading:-90},
 '09-spooky-purple':{foot:[560,696],heading:90},
 '11-volcano':{foot:[781,595],heading:-15},
 '12-coral-atoll':{foot:[745,425],heading:-68},
};
for(const [art,dock]of Object.entries(docks))authored[art].dockApproach=dock;
const path='src/pixi/islets-data.json',data=JSON.parse(readFileSync(path));
for(const i of data.placements){const p=authored[i.art];i.lon=p.lon*Math.PI/180;i.lat=p.lat*Math.PI/180;}
writeFileSync(path,JSON.stringify(data,null,2)+'\n');
writeFileSync('scripts/world-layout/islet-composition.json',JSON.stringify(authored,null,2)+'\n');
