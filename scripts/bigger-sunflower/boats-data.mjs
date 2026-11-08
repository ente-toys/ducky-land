// boss 8 Nov ("we should allow them to go on boat in centre"): Sunbob's hand-placed boat data. Every number here is a literal,
// chosen by hand against the water (water-geometry.json) and checked in the close-up proofs (concepts/themes/work/sunbob-check/boats).

// One arched footbridge per crossing (GPT's bridge-<dir>.svg, picked by direction in boats.mjs). a and b are the two landings, on dry
// bank about 40 past the water along the old deck or road line (a north-south deck is drawn upright, so its two landings share
// the mean x of the old line, keeping it on the path at both ends); w is the walk width. 'deck' is the flat plank it replaces.
// original-5 and original-6 are already arched (bridge-nw.svg, bridge-se.svg) and stay; boats pass under them too.
export const BRIDGES = [
  {id: 'original-1', deck: 'jetty-sw.svg', a: [1490, 4340], b: [1490, 4799], w: 112},   // the long south-west deck over the canal bend
  {id: 'original-2', deck: 'jetty-w.svg', a: [342, 2586], b: [606, 2586], w: 104},
  {id: 'original-3', deck: 'jetty-e.svg', a: [7118, 1832], b: [7378, 1832], w: 104},
  {id: 'original-4', deck: 'jetty-s.svg', a: [3630, 4777], b: [3630, 4515], w: 104},
  {id: 'river-crossing-1', deck: 'bigger/river-crossing-1.svg', a: [4117, 91], b: [4385, 109], w: 140},   // main road over Millseed Brook
  {id: 'river-crossing-2', deck: 'bigger/river-crossing-2.svg', a: [-284, 1476], b: [-44, 1336], w: 140},   // main road over Willowcup Run
  {id: 'river-crossing-3', deck: 'bigger/river-crossing-3.svg', a: [3250, 836], b: [3250, 1091], w: 120},
  {id: 'river-crossing-4', deck: 'bigger/river-crossing-4.svg', a: [6732, 475], b: [6732, 755], w: 120},
  {id: 'river-crossing-5', deck: 'bigger/river-crossing-5.svg', a: [7280, 2607], b: [7038, 2512], w: 120},
  {id: 'river-crossing-6', deck: 'bigger/river-crossing-6.svg', a: [4438, 4550], b: [4438, 4276], w: 120},
  {id: 'river-crossing-7', deck: 'bigger/river-crossing-7.svg', a: [2026, 4840], b: [2238, 4661], w: 120},
  {id: 'river-crossing-8', deck: 'bigger/river-crossing-8.svg', a: [357, 3587], b: [598, 3501], w: 120},
];
// the two arched bridges the island already had: boats pass under them, and their deck copy is drawn over a boat beneath
export const KEPT_ARCHES = ['bridge-nw.svg', 'bridge-se.svg'];

// The two river mouths. Each bank is one cubic curve [start, control, control, end] from the brook's own bank out past the coast,
// so the brook flares into a smooth sandy mouth; 'sea' closes the water shape out at sea; tideBow bows the line where
// the brook's water meets the sea's inland. calm: no surf runs inside this box.
export const MOUTHS = [
  {id: 'millseed-mouth', name: 'Millseed Brook mouth',   // north
    left: [[4198, -550], [4180, -640], [4130, -770], [4000, -845]],
    right: [[4380, -550], [4360, -650], [4370, -790], [4470, -880]],
    sea: [[3960, -940], [4510, -960]],
    ripples: [[4290, -680], [4250, -760], [4340, -790]], tideBow: [0, 45],
    calm: [3900, -1060, 4560, -720]},
  {id: 'willowcup-mouth', name: 'Willowcup Run mouth',   // west
    left: [[-780, 1205], [-830, 1214], [-880, 1215], [-940, 1190]],
    right: [[-850, 1410], [-920, 1434], [-1020, 1470], [-1140, 1525]],
    sea: [[-1010, 1130], [-1200, 1500]],
    ripples: [[-880, 1320], [-960, 1360], [-1000, 1290]], tideBow: [45, 10],
    calm: [-1300, 1100, -880, 1580]},
];
