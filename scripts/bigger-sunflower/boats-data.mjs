
export const BRIDGES = [
  {id: 'original-1', deck: 'jetty-sw.svg', a: [1490, 4340], b: [1490, 4799], w: 112},
  {id: 'original-2', deck: 'jetty-w.svg', a: [342, 2586], b: [606, 2586], w: 104},
  {id: 'original-3', deck: 'jetty-e.svg', a: [7118, 1832], b: [7378, 1832], w: 104},
  {id: 'original-4', deck: 'jetty-s.svg', a: [3630, 4777], b: [3630, 4515], w: 104},
  {id: 'river-crossing-1', deck: 'bigger/river-crossing-1.svg', a: [4117, 91], b: [4385, 109], w: 140},
  {id: 'river-crossing-2', deck: 'bigger/river-crossing-2.svg', a: [-284, 1476], b: [-44, 1336], w: 140},
  {id: 'river-crossing-3', deck: 'bigger/river-crossing-3.svg', a: [3250, 836], b: [3250, 1091], w: 120},
  {id: 'river-crossing-4', deck: 'bigger/river-crossing-4.svg', a: [6732, 475], b: [6732, 755], w: 120},
  {id: 'river-crossing-5', deck: 'bigger/river-crossing-5.svg', a: [7280, 2607], b: [7038, 2512], w: 120},
  {id: 'river-crossing-6', deck: 'bigger/river-crossing-6.svg', a: [4438, 4550], b: [4438, 4276], w: 120},
  {id: 'river-crossing-7', deck: 'bigger/river-crossing-7.svg', a: [2026, 4840], b: [2238, 4661], w: 120},
  {id: 'river-crossing-8', deck: 'bigger/river-crossing-8.svg', a: [357, 3587], b: [598, 3501], w: 120},
];
export const KEPT_ARCHES = ['bridge-nw.svg', 'bridge-se.svg'];

export const MOUTHS = [
  {id: 'millseed-mouth', name: 'Millseed Brook mouth',
    left: [[4198, -550], [4180, -640], [4130, -770], [4000, -845]],
    right: [[4380, -550], [4360, -650], [4370, -790], [4470, -880]],
    sea: [[3960, -940], [4510, -960]],
    ripples: [[4290, -680], [4250, -760], [4340, -790]], tideBow: [0, 45],
    calm: [3900, -1060, 4560, -720]},
  {id: 'willowcup-mouth', name: 'Willowcup Run mouth',
    left: [[-780, 1205], [-830, 1214], [-880, 1215], [-940, 1190]],
    right: [[-850, 1410], [-920, 1434], [-1020, 1470], [-1140, 1525]],
    sea: [[-1010, 1130], [-1200, 1500]],
    ripples: [[-880, 1320], [-960, 1360], [-1000, 1290]], tideBow: [45, 10],
    calm: [-1300, 1100, -880, 1580]},
];
