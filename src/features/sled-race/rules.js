// Snow island sled race: every tuning number in one place. Distances are course units (a tube is about 1 wide).
export const SLED=Object.freeze({
  // lobby
  maxSeats:6,minHumans:3,waitSeconds:45,shortWait:10,fullCountdown:5,botCountdown:3,botFillTo:4,practiceBots:3,
  finishGrace:20,resultsSeconds:8,idleKick:true,
  // course
  trackWidth:12,lanes:6,courseLength:656,
  // racing
  startSpeed:10,cruiseSpeed:14,rampUpSeconds:5,
  steerSpeed:7.5,steerAccel:28,steerFriction:9,
  tuckSpeed:.15,tuckSteer:.7,
  boostSpeed:.4,boostSeconds:1.5,
  crashSeconds:1.2,bankSpeed:.85,bankBounce:2,crashResume:.6,recoverSeconds:1.5,
  catchUpGap:2,catchUpSpeed:.05,
  slipDistance:3.2,slipWidth:1.2,slipDelay:1,slipSpeed:.08,
  jumpSeconds:.6,hopCooldown:0,landSideSpeed:3,landLoss:.25,
  racerRadius:.45,
  // network
  hz:60,broadcastEvery:3,inputTimeout:.5,
});

export const SLED_ISLAND='isle-55';
export const SLED_ZONE='sledHill';
// the race pop-up shows at the tube rental stall; the race can be watched from anywhere on the hill island's plaza
export const SLED_ZONE_RADIUS=300;
export const SLED_WATCH_RADIUS=3400;

export const BOT_NAMES=Object.freeze(['Frostbite','Pinecone','Snowdrop','Mittens','Flurry','Icicle','Puffin','Slushy','Avalanche','Toboggan']);
export const BOT_STYLES=Object.freeze({
  careful:{look:14,reaction:[.22,.3],miss:.04,iceChase:.25,tuck:.35,hop:.3},
  daredevil:{look:16,reaction:[.15,.22],miss:.12,iceChase:1,tuck:.85,hop:.8},
  wobbly:{look:11,reaction:[.28,.35],miss:.2,iceChase:.4,tuck:.25,hop:.4},
});
// red, blue, green first: the colours of the first three racers
export const TUBE_COLOURS=Object.freeze([0xe5483f,0x2f8fe8,0x3dbb5a,0xffc531,0x9a6be0,0xff8a2a]);
