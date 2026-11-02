# Ducky Land

A small multiplayer island for Ente's Ducky. Everything you see is native Rive; the browser page only runs input,
movement, the camera and the network. Local prototype, nothing deployed.

## Run it

Needs Node 20+ and Python 3.

```sh
npm install
node server.mjs        # realtime server: ws://127.0.0.1:8810/room, health on http://127.0.0.1:8810/health
python3 serve.py       # page: http://127.0.0.1:8800/
```

Open http://127.0.0.1:8800/, pick a name and city, Waddle in. WASD or arrows walk, click walks to a spot,
Q quacks, E dances, Esc opens the menu.

## Backend, where to start

| File | What it does |
| --- | --- |
| `server.mjs` | The realtime server. HTTP `/health`, WebSocket `/room` (max 2 KB per message, a token bucket of 40 kicks spammers). Ticks the bots and the plaza crowd and sends a `snapshot` to every player 12 times a second. Also serves the page files. |
| `server-world.mjs` | Shared world rules: walkable area, collisions, `move()`, bot spawn spots, names, outfits, `SLOTS=16` players, `SPEED=245`, `HZ=12`. Reads `rive/web/world.json`. |
| `rive/web/crowd.js`, `crowd-brain.mjs` | The plaza's social crowd (benches, stalls, fountain ring, dance parties). Runs on the server. |
| `rive/web/network.js` | The client side: connects, sends its state, applies snapshots with 100 ms interpolation (`interpolation.js`), reconciles its own position. |
| `rive/web/game.js` | Client game loop, input, pathfinding, camera, drawing. |

Messages, client to server: `profile` (name, city, outfit), `state` (x, y, facing, turn, action, seq), `emote`,
`activity`, `collect`. Server to client: `welcome`, `snapshot` (players + bots, with `ack` for your last `state`).

Today the client is the authority for its own position: it sends `state` and the server only checks it is walkable.
There is no account, persistence or database yet; the city quack and bread counters live in memory and reset when
the server restarts. Room size is one room, 16 players, topped up with bots to 24.

All positions are flat world coordinates (5800 x 4400). The isometric look is only a drawing projection in
`game.js` (`?view=iso` default, `?view=flat` to see the flat map), so the server never needs to know about it.

## Art and build

- `rive/web/ducky-land.riv` is the built runtime the page loads. It is committed so the game runs without a build.
- `rive/gen.py` generates the Ducky rig (turn, walk, idle, quack, dance) from the official views in `duck-spin/`.
  `pull_rig.py` re-pulls it and rebuilds; needs the Rive CLI.
- Do not run `build.py` without checking with Prag first: it regenerates `rive/web/game.js` from the lane sources and
  would undo the isometric view.
- `incoming/` holds the original work of each build lane; `qa/` and `shots/` are tests and captures.
