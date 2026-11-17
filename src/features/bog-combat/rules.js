export const DUCK_LENGTH = 48;
const D = DUCK_LENGTH;

export const RULES=Object.freeze({moveSpeed:1.5,range:10*D,shotSpeed:28*D,shotRadius:6,fireDelay:.08,
  ammoCapacity:48,reloadSeconds:1.6,paintTopUpDelay:1.5,paintTopUpEvery:.4,respawnDelay:3,lives:5,hitsPerHeart:10,spawnShield:7,inputTimeout:.35,tagPoints:1,tagScore:10,
  aimCone:14*Math.PI/180,dodgeDistance:1.5*D,dodgeSeconds:.25,dodgeCooldown:2.5,dodgeInvulnerable:.15,
  pickupRadius:32,pickupRespawn:20,hitShieldSeconds:8,
  surviveSeconds:60,splatSeconds:8,maxSplats:96,maxShots:512});
export const TEAMS=Object.freeze(['karma','evil']);
export const PAINT=Object.freeze({karma:[0x08c225],evil:[0x2788d9,0xfa5452,0xffe23d,0x20c75b]});
export const emptyStats=()=>({tags:0,survives:0,score:0,medals:0,bestStreak:0});

export const BOG_BOT_NAMES=Object.freeze(['Puddles','Waddles','Biscuit','Pickle','Noodle','Maple','Pip','Pebble','Clover','Mochi','Sunny','Button','Peaches','Sprout','Toffee','Mango','Dumpling','Bubbles','Waffle','Poppy','Nibbles','Tater','Honey','Daisy','Olive','Pumpkin','Bean','Churro','Peanut','Ducky']);
