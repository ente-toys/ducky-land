// boss 8 Nov, Sunbob's inner island (inside the ring canal). Every number is a literal, placed by hand and checked in the proofs
// (concepts/themes/work/sunbob-check/boats). centre.mjs applies it.

// The inner island keeps three buildings: the red barn, the windmill and the honey stall. The flower stall goes, and so do the two
// stone pads that held the market and the farm stand (drawn in the original ground tiles as ten-market-0 and ten-market-1, and
// their inlay decals).
// tree-73 stood on the north landing of the river-crossing-3 bridge and hid the whole arch; the fence and field fill the bank there.
export const REMOVE_PROPS = ['stall-flowers', 'tree-73'];
// moved by hand: the cattails by the old south jetty stood on the new arched deck there, and (below) every tree, lamp, bench,
// bush, rock and planter that stood on the sunflower fence's line, each moved straight inland off it
export const MOVE_PROPS = {'bigger-canal-reeds': [3745, 4740],
  // boss 8 Nov ("two solid layers, no gaps except the bridges"): everything that stood on the fence line, moved inland by hand
  'close-activity-1-lamp-2': [764, 2811],
  'ten-underplant-25': [790, 3252],
  'ten-underplant-36': [1331, 3982],
  'close-activity-3-lamp-2': [1999, 4321],
  'ten-underplant-69': [2834, 4496],
  'close-activity-3-lamp-0': [2914, 4494],
  'coast-rock-52': [6501, 3289],
  'tree-125': [7180, 860],
  'ten-underplant-47': [7090, 850],
  'tree-122': [4427, 969],
  'ten-underplant-45': [4374, 1076],
  'bush-141': [1932, 1905],
  'tree-nod-1': [1189, 1904],
  'sunflower-banner-47': [769, 2913],
  'ten-underplant-24': [786, 3138],
  'close-activity-1-planter-1': [805, 3338],
  'fence-48': [1290, 3820],
  'tree-116': [1384, 4030],
  'bush-136': [2956, 4405],
  'close-activity-3-bench-0': [3046, 4422],
  'ten-underplant-20': [3861, 4231],
  'ten-underplant-18': [3926, 4232],
  'tree-97': [3995, 4198],
  'ten-underplant-13': [4338, 4084],
  'ten-underplant-77': [6578, 3020],
  'ten-underplant-17': [6598, 2947],
  'tree-120': [6611, 2209],
  'tree-98': [6941, 1598],
  'bush-128': [6127, 1095],
  'tree-109': [5372, 923],
  'ten-underplant-46': [4360, 985],
  'tree-nod-3': [3964, 1165], 'tree-nod-4': [3300, 4280],
  'bush-139': [3140, 1500],
  'tree-113': [1788, 1747]};
// sleeping Duckies moved a little inland off the fence line: {pose: {index in world.sleepSpots[pose]: [x, y, flip]}}
export const SLEEP_MOVES = {
  nod: {0: ['tree-88', 0, false], 2: ['bigger-shelter-6', 0, false], 3: ['bigger-shelter-19', 0, true], 7: ['bigger-clover-tree-2', 0, true]},
  hammock: {0: [2230, 2236, false], 1: [6828, 2007, true], 3: [1139, 2441, false]},
  rock: {1: [1050, 2180, true], 4: [1727, 4728, true]},
  leaf: {1: [3062, 5147, true], 2: [5169, 4347, false], 4: [5518, 993, true], 5: [649, 4082, true]},
  book: {2: [1480, 1930, true], 4: [3286, 1247, true]},
  chair: {0: [5405, 3605, true]},
  wing: {1: [4983, 1610, false], 3: [3760, 4900, false], 4: [7365, 2314, true], 5: [6137, 1220, false]},
  box: {0: [456, 3812, false]},
};
// The plaza (GPT's oval redraw): its step rings (centre/back.svg) are a deck, drawn above the ground, and their new art fills the
// whole oval, so the floor paving and the sunflower petal inlay (ground decals) were hidden under it. They are lifted to decks,
// drawn right after the step rings in this order, so the plaza reads as GPT's preview: rings, then floor, then the inlay.
export const LIFT_FLATS = ['centre-decal-floor', 'close-sunflower-rosette'];
export const REMOVE_FLATS = ['close-market-inlays', 'close-farm-inlays'];
// boss 8 Nov (live game): the original tiles also carry the old plaza's crazy-paving stones (<g clip-path="url(#plaza)">) under
// the plaza's paving decal. Wherever a paving tile was still streaming in, the game showed them as hard-edged rectangles, so they
// are cut too and the ground under the paving is the plaza's plain cream oval.
// The three striped lawns (West meadow, Windmill green, South green) are now sunflower fields: their stripes go too.
export const REMOVE_GROUND_GROUPS = ['<g id="ten-market-0"', '<g id="ten-market-1"', '<g clip-path="url(#plaza)">',
  '<g clip-path="url(#grass)">\n<ellipse cx="1180"', '<g clip-path="url(#grass)">\n<ellipse cx="5700"', '<g clip-path="url(#grass)">\n<ellipse cx="2430"'];

// What fills the freed ground: the centre's own trees and sunflower field rows (detail/field-row-short.svg, the same pieces,
// scales and flip as the centre fields). [src, x, y, scale, flip]
// superseded by FIELDS below (boss 8 Nov: the freed pads are now part of whole sunflower fields)
export const FILL = [];

// The sunflower fence (boss 8 Nov: "two solid layers all the way round the inner island's bank, no gaps except at the bridges"):
// two rows of single field flowers, 55 and 120 inside the inner island's shore (the old coast), every 62 along the line, the
// second row half a step on. Where the north path runs on the bank itself (x 2050-3000) both rows close up toward the water
// (down to 5 outside and 35 inside the shore) so the fence runs on between path and river. Points run clockwise from the
// north-west.
export const FENCE = {
  src: 'detail/field-flower.svg', scale: .5, step: 62,
  rows: [
    [
      [1782, 1393], [1640, 1439], [1503, 1502], [1372, 1574], [1245, 1654], [1120, 1737], [1010, 1838], [926, 1962], [852, 2092], [789, 2229], [729, 2366], [680, 2508],
      [633, 2650], [593, 2795], [573, 2943], [565, 3093], [573, 3243], [602, 3390], [661, 3527], [736, 3657], [829, 3775], [930, 3885], [1042, 3985], [1158, 4081],
      [1282, 4164], [1410, 4243], [1544, 4309], [1683, 4368], [1821, 4426], [1958, 4487], [2095, 4549], [2233, 4608], [2376, 4651], [2523, 4681], [2672, 4697], [2822, 4688],
      [2968, 4655], [3112, 4614], [3257, 4574], [3401, 4533], [3546, 4493], [3691, 4457], [3838, 4424], [3984, 4392], [4126, 4343], [4267, 4293], [4408, 4242], [4554, 4206],
      [4700, 4169], [4845, 4131], [4988, 4087], [5127, 4031], [5258, 3959], [5386, 3881], [5510, 3795], [5646, 3735], [5792, 3700], [5940, 3673], [6088, 3650], [6238, 3637],
      [6387, 3624], [6534, 3598], [6634, 3498], [6670, 3352], [6703, 3206], [6740, 3060], [6801, 2924], [6881, 2797], [6951, 2665], [6993, 2521], [7018, 2373], [7035, 2224],
      [7050, 2074], [7065, 1925], [7085, 1777], [7113, 1629], [7146, 1483], [7182, 1337], [7230, 1195], [7280, 1054], [7324, 910], [7364, 766], [7403, 621], [7402, 488],
      [7266, 553], [7134, 623], [6999, 689], [6860, 746], [6721, 802], [6579, 850], [6433, 882], [6284, 899], [6134, 899], [5985, 888], [5836, 869], [5689, 837],
      [5545, 798], [5403, 748], [5259, 709], [5109, 696], [4959, 689], [4810, 696], [4661, 718], [4516, 755], [4373, 801], [4232, 853], [4097, 917], [3963, 985],
      [3824, 1040], [3680, 1082], [3532, 1110], [3383, 1127], [3234, 1136], [3085, 1151], [2937, 1178], [2795, 1225], [2646, 1261], [2507, 1297], [2374, 1324], [2226, 1355],
      [2077, 1344], [1928, 1356], [1782, 1393]],
    [
      [1807, 1453], [1663, 1500], [1526, 1563], [1394, 1637], [1266, 1717], [1142, 1802], [1037, 1909], [957, 2037], [887, 2171], [824, 2308], [769, 2449], [720, 2592],
      [677, 2736], [644, 2883], [633, 3034], [633, 3184], [655, 3334], [706, 3475], [780, 3607], [873, 3725], [974, 3837], [1087, 3938], [1203, 4034], [1329, 4117],
      [1458, 4195], [1595, 4260], [1734, 4319], [1873, 4378], [2010, 4439], [2148, 4502], [2288, 4558], [2434, 4596], [2582, 4625], [2732, 4631], [2882, 4611], [3027, 4570],
      [3172, 4530], [3318, 4489], [3463, 4448], [3609, 4409], [3756, 4376], [3904, 4343], [4049, 4302], [4191, 4251], [4333, 4200], [4478, 4158], [4624, 4121], [4771, 4085],
      [4916, 4043], [5058, 3991], [5192, 3922], [5322, 3846], [5446, 3760], [5579, 3689], [5724, 3650], [5872, 3619], [6021, 3594], [6171, 3578], [6321, 3564], [6471, 3550],
      [6578, 3460], [6612, 3313], [6645, 3166], [6685, 3020], [6749, 2884], [6830, 2756], [6897, 2622], [6935, 2476], [6959, 2327], [6975, 2177], [6990, 2026], [7005, 1876],
      [7028, 1727], [7056, 1579], [7092, 1432], [7129, 1286], [7179, 1143], [7229, 1001], [7270, 856], [7309, 710], [7323, 597], [7189, 668], [7055, 737], [6915, 793],
      [6775, 850], [6633, 901], [6487, 938], [6338, 960], [6187, 963], [6036, 961], [5887, 941], [5738, 914], [5591, 882], [5448, 832], [5305, 785], [5155, 765],
      [5005, 754], [4854, 758], [4704, 776], [4557, 810], [4414, 856], [4271, 907], [4135, 971], [4000, 1040], [3861, 1096], [3716, 1139], [3568, 1169], [3419, 1189],
      [3268, 1199], [3118, 1210], [2966, 1227], [2806, 1239], [2656, 1279], [2528, 1330], [2401, 1351], [2260, 1363], [2104, 1409], [1953, 1418], [1807, 1453]],
  ],
  // the only openings, by hand: [x, y, r] where each bridge's deck and its path cross the two rows (14 bridges on the ring)
  gaps: [
      [1595, 1460, 120], [1641, 1510, 120], [5201, 3991, 120], [5172, 3932, 120], [1490, 4282, 120], [1490, 4210, 120], [654, 2586, 120], [722, 2586, 120],
      [7078, 1832, 120], [7012, 1832, 120], [3630, 4472, 120], [3630, 4404, 120], [3250, 1135, 120], [3250, 1200, 120], [6732, 798, 120], [6732, 865, 120],
      [6997, 2496, 120], [6936, 2472, 120], [4438, 4235, 120], [4438, 4170, 120], [2283, 4623, 120], [2343, 4572, 120], [643, 3485, 120], [702, 3464, 120],
      [7067, 1908, 130], [6993, 1997, 130], [1576, 4323, 130], [1637, 4278, 130], [4972, 4092, 108], [4861, 4059, 108], [3204, 1139, 100], [3190, 1205, 100],
      [6611, 839, 100], [6520, 930, 100]],
};

// boss 8 Nov ("flood the centre with sunflowers"): every wedge of land between the plaza's radial paths is ONE solid sunflower
// field, edge to edge, up to the paths (30 off their edge), the plaza ring and the fence. The outlines are fixed here; centre.mjs
// lays the centre field's own row piece (detail/field-row-short.svg, scale .5, flipped as the centre fields) in staggered rows
// across each one at the old fields' density. Three clearings stay open: the barn and windmill yard, the pond, and the beach
// with the honey stall. Each field keeps one scarecrow (an existing one by id, or a new one at [x, y]).
export const FIELD_ROWS = {src: 'detail/field-row-short.svg', scale: .5, stepX: 230, stepY: 62, reach: 120};
export const FIELDS = [
  // 1: north of the pond
  {scarecrow: [1561, 1710], poly: [
      [1030, 2421], [980, 2218], [1042, 2051], [1199, 1916], [1444, 1834], [1678, 1828], [1913, 1892], [2109, 2039], [2183, 2222], [2283, 2214], [2083, 1970], [1909, 1803],
      [1564, 1577], [1146, 1836], [995, 2025], [809, 2426]]},
  // 2: west, the old meadow and garden
  {scarecrow: 'scarecrow-265', poly: [
      [683, 2826], [664, 3213], [697, 3376], [760, 3518], [860, 3666], [1079, 3894], [1249, 4031], [1516, 4190], [2001, 3978], [2716, 3612], [2974, 3418], [3158, 3187],
      [2948, 3051], [2811, 2916], [2727, 2766], [2695, 2583], [2318, 2498], [2147, 2504], [1964, 2611], [1812, 2665], [718, 2714]]},
  // 3: south-west, the old south green
  {scarecrow: [2752, 4124], poly: [
      [1867, 4325], [1866, 4343], [2262, 4518], [2462, 4575], [2663, 4602], [2856, 4587], [3477, 4405], [2829, 3860], [2115, 4222]]},
  // 4: south of the plaza
  {scarecrow: 'scarecrow-309', poly: [
      [3433, 3275], [3243, 3529], [3032, 3730], [3580, 4187], [3728, 4348], [3978, 4296], [4356, 4159], [4388, 4074], [4433, 4042], [4513, 4044], [4572, 4101], [4655, 4080],
      [4478, 3875], [4275, 3290], [3851, 3328]]},
  // 5: south-east, by the beach path
  {scarecrow: [4766, 3631], poly: [
      [5050, 3957], [4973, 3724], [4873, 3555], [4563, 3202], [4498, 3223], [4643, 3692], [4725, 3832], [4876, 3943], [4997, 3982]]},
  // 6: east, by the market
  {scarecrow: [6590, 2815], poly: [
      [6600, 3000], [6628, 3085], [6677, 2956], [6861, 2635], [6880, 2566], [6818, 2534], [6775, 2477], [6567, 2612], [6240, 2677]]},
  // 7: east of the plaza
  {scarecrow: [5166, 2983], poly: [
      [4805, 3062], [5168, 3479], [5300, 3150], [5778, 2657], [5302, 2611], [5063, 2635], [4993, 2851]]},
  // 8: north-east, beyond the barn
  {scarecrow: 'scarecrow-337', poly: [
      [6450, 1300], [6212, 1587], [6382, 1638], [6567, 1731], [6836, 1973], [6984, 1796], [7095, 1294], [7291, 660], [6679, 920], [6527, 1051], [6473, 1051], [6399, 985],
      [6363, 989]]},
  // 9: north, by the bridge
  {scarecrow: [4192, 1095], poly: [
      [3425, 1221], [3422, 1241], [3810, 1351], [3902, 1295], [4087, 1234], [4307, 1240], [4377, 910], [4221, 961], [3890, 1120]]},
  // 10: north of the plaza, the old farm gate
  {scarecrow: [4290, 1743], poly: [
      [4342, 1523], [4136, 1500], [3970, 1571], [3872, 1736], [3890, 1885], [4223, 1919], [4511, 1998], [4673, 1802], [4878, 1663], [4700, 1650], [4350, 1550]]},
  // 11: east, the old windmill green
  {scarecrow: [5675, 2034], poly: [
      [4992, 2364], [5304, 2341], [5993, 2405], [6374, 2385], [6554, 2309], [6681, 2158], [6572, 2021], [6449, 1923], [6298, 1847], [5968, 1765], [5925, 1726], [5901, 1650],
      [5184, 1650], [5177, 1734], [5145, 1782], [4892, 1916], [4722, 2095], [4894, 2238]]},
  // 12: north-west, the big field
  {scarecrow: 'scarecrow-225', poly: [
      [2786, 2327], [2948, 2165], [3130, 2052], [3349, 1965], [3610, 1906], [3606, 1690], [3655, 1537], [3266, 1448], [2825, 1454], [2502, 1510], [2360, 1556], [2122, 1679],
      [2336, 1915], [2608, 2275]]}
];
// Inside the fields only these stay: the scarecrows above and three tree clumps where a field meets the river fence. Every other
// tree, bush, bench, lamp, rock, flower, the striped lawns and the old patchy field rows inside a field go.
export const FIELD_KEEP = ['tree-116', 'tree-121', 'tree-66', 'tree-98', 'tree-nod-4', 'tree-111'];
