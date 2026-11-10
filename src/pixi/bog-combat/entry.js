// Disabled until the boss sets the requirement. No gate screen while zero.
export const KARMA_REQUIRED=0;
export const BOG_ISLAND='isle-249';
export function dockArrival(travel,status){return status==='playing'&&travel?.islandId===BOG_ISLAND&&travel.mode==='walking';}
export function canEnterBog(karma=0){return KARMA_REQUIRED===0||karma>=KARMA_REQUIRED;}
export function teamCounts(players){const counts={privacy:0,google:0};for(const p of players)if(!p.bot&&p.team in counts)counts[p.team]++;return counts;}
export function suggestedTeam(counts){return counts.privacy===counts.google?null:counts.privacy<counts.google?'privacy':'google';}
