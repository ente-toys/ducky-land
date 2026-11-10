import {getPlayerKarma} from './karma.js';
export const KARMA_REQUIRED=5;
export const BOG_ISLAND='isle-249';
export function dockArrival(travel,status){return status==='playing'&&travel?.islandId===BOG_ISLAND&&travel.mode==='walking';}
export function canEnterBog(karma=getPlayerKarma()){return Number.isFinite(karma)&&karma>=KARMA_REQUIRED;}
export function bogLandingNotice(islandId,karma=getPlayerKarma()){
 return islandId===BOG_ISLAND&&!canEnterBog(karma)
  ? `You need ${KARMA_REQUIRED} karma to land on Booquack Bog (you have ${Number.isFinite(karma)?karma:0})` : null;
}
export function teamCounts(players){const counts={privacy:0,google:0};for(const p of players)if(!p.bot&&p.team in counts)counts[p.team]++;return counts;}
export function suggestedTeam(counts){return counts.privacy===counts.google?null:counts.privacy<counts.google?'privacy':'google';}
