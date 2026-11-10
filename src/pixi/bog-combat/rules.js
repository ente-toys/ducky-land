export const DUCK_LENGTH = 48;
const D = DUCK_LENGTH;

// One paint gun. No rounds, role swaps, weapon selection or team-size cap.
export const RULES=Object.freeze({range:10*D,shotSpeed:28*D,shotRadius:6,fireDelay:.38,
  ammoCapacity:12,reloadSeconds:1.6,respawnDelay:3,spawnShield:1.5,inputTimeout:.35,tagPoints:1,tagScore:10,
  surviveSeconds:60,splatSeconds:8,maxSplats:96,maxShots:256});
export const TEAMS=Object.freeze(['privacy','google']);
export const PAINT=Object.freeze({privacy:[0x08c225],google:[0x2788d9,0xfa5452,0xffe23d,0x20c75b]});
export const emptyStats=()=>({tags:0,survives:0,score:0,medals:0,bestStreak:0});
