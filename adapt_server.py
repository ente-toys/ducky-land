"""Adapt the multiplayer session's socket authority to this island and port."""
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parent
src=(ROOT/'incoming/multiplayer/server.mjs').read_text()
src=src.replace("import { CITIES, NAMES, SLOTS, SPEED, HZ, rnd, pick, outfit, randomSpot, walkable, move } from './rive/web/world.js';", "import { CITIES, NAMES, SLOTS, SPEED, HZ, rnd, pick, outfit, randomSpot, walkable, move } from './server-world.mjs';\nimport { createIslandBrain, CROWD_ACTION } from './rive/web/crowd.js';")
src=src.replace("const players = new Map(), bots = new Map();", "const players = new Map(), bots = new Map();\nconst {brain,ox,oy}=createIslandBrain(world,walkable);\nbrain.updatePlayer=()=>{const p=players.values().next().value;if(p){brain.player.x=p.x-ox;brain.player.y=p.y-oy;}};")
src=src.replace("from './server-world.mjs';", "from './server-world.mjs';\nimport { world } from './server-world.mjs';")
src=src.replace("'bot', 'ack'", "'bot', 'ack', 'turn', 'activity'")
src=src.replace("10 - players.size", "24 - players.size")
src=src.replace("'http://127.0.0.1:8804', 'http://localhost:8804'", "'http://127.0.0.1:8800', 'http://localhost:8800'")
src=src.replace("const [x, y] = randomSpot();\n  const player", "const [x,y]=world.zones.plaza.spawn;\n  const params=new URL(req.url,'http://localhost').searchParams;\n  const clean=(params.get('name')||'ducky').replace(/[\\u0000-\\u001f\\u007f]/g,'').trim().slice(0,18)||'ducky';\n  const n=(key,max,fallback=0)=>{const v=Number(params.get(key));return Number.isInteger(v)&&v>=0&&v<=max?v:fallback;};\n  const player")
src=src.replace("name: `${pick(NAMES)}_${id.slice(0, 3)}`, city: Math.floor(rnd(0, 4)), ...outfit(),", "name:clean, city:n('city',8,1),cap:n('cap',13,8),shades:n('shades',3),acc:n('acc',7),shoes:n('shoes',10),turn:0,activity:null,")
src=src.replace("quacks[CITIES[player.city]]++;", "quacks[CITIES[player.city]]++;\n        brain.pose(brain.player,'quack',1.3);")
src=src.replace("else if (now >= player.until) { player.action = 3; player.until = now + 6000; }", "else if (now >= player.until) { player.action = 3; player.until = now + 6000; brain.startParty(brain.player); }")
src=src.replace("!walkable(m.x, m.y)", "!(walkable(m.x,m.y)||(player.activity==='race'&&((m.x-4140)/660)**2+((m.y-1520)/350)**2<=1.3))")
src=src.replace("player.lastState = now; player.ack = m.seq; player.facing = m.facing;", "player.lastState = now; player.ack = m.seq; player.facing = m.facing;\n      if(Number.isFinite(m.turn))player.turn=Math.max(-180,Math.min(180,m.turn));")
src=src.replace("['quack', 'dance'].includes(m.action)", "['quack', 'dance', 'heart', 'laugh', 'wave', 'sleep', 'angry', 'party'].includes(m.action)")
src=src.replace("} else if (player.action === 3)", "} else if(!['quack','dance'].includes(m.action)){player.action={heart:4,laugh:5,wave:6,sleep:7,angry:8,party:9}[m.action];player.until=now+2300;} else if (player.action === 3)")
anchor="    if (m.type === 'state') {"
replacement="""    if(m.type==='profile') {
      for(const [key,max]of Object.entries({cap:13,shades:3,acc:7,shoes:10,city:8}))if(Number.isInteger(m[key])&&m[key]>=0&&m[key]<=max)player[key]=m[key];
      if(typeof m.name==='string')player.name=m.name.replace(/[\\u0000-\\u001f\\u007f]/g,'').trim().slice(0,18)||player.name;
    } else if(m.type==='activity') {
      if(m.kind==='race'&&Math.hypot(player.x-4155,player.y-2070)<450){player.activity='race';player.x=4140;player.y=1745;player.lastState=now;}
      else if(m.kind==='bread'&&Math.hypot(player.x-1390,player.y-1780)<650){player.activity='bread';player.collected=new Set();}
      else if(m.kind==='end'){if(player.activity==='race')[player.x,player.y]=world.zones['race-lake'].spawn;player.activity=null;}
    } else if(m.type==='collect'&&player.activity==='bread'&&Number.isInteger(m.id)&&m.id>=0&&m.id<12&&!player.collected.has(m.id)){
      player.collected.add(m.id);cityBread[CITIES[player.city]]+=10;
    } else if (m.type === 'state') {"""
src=src.replace(anchor,replacement)
src=src.replace("let botId = 0, tick = 0;", "let botId = 0, tick = 0;\nconst cityBread=Object.fromEntries(CITIES.map(c=>[c,0]));")
src=src.replace("bots: [...bots.values()].map(wire), quacks", "bots: [...bots.values()].map(wire).concat(brain.ducks.slice(1).map(d=>({...d,id:'social-'+d.id,bot:true,x:d.x+ox,y:d.y+oy,action:CROWD_ACTION[d.action]??0,turn:Math.atan2(d.vx||0,(d.vy||0)/1.65)*180/Math.PI}))), quacks, cityBread")
src=src.replace("  broadcast();\n}, 1000 / HZ);", "  brain.update(dt);\n  broadcast();\n}, 1000 / HZ);")
src=src.replace("realtime.listen(8803", "realtime.listen(Number(process.env.DUCKY_WS_PORT)||8810")
src=src.replace("page.listen(8804, HOST, () => console.log('Ducky Land: http://127.0.0.1:8804/'));", "// Static island is served by Python on 8800.")
src=src.replace("ws://127.0.0.1:8803/room", "ws://127.0.0.1:8810/room")
src=src.replace("const [x,y]=world.zones.plaza.spawn;", "let [x,y]=world.zones.plaza.spawn;if(players.size){const a=players.size*2.399963,r=140+Math.floor(players.size/6)*40,nx=x+Math.cos(a)*r,ny=y+Math.sin(a)*r*.65;if(walkable(nx,ny)){x=nx;y=ny;}}")
src=src.replace("bots: bots.size, capacity: SLOTS", "bots: bots.size+brain.ducks.length-1, capacity: SLOTS")
(ROOT/'server.mjs').write_text(src)
# Copy the registry-installed server dependency into our own workspace.
module=ROOT.parent/'codex-multiplayer/node_modules/ws'
shutil.copytree(module,ROOT/'node_modules/ws',dirs_exist_ok=True)
print('Adapted local socket authority to island geometry, identity, social crowd and port 8810.')
