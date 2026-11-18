// The legacy object's name is part of its storage identity. Never rename it.
export const worldName = (env) => env.ISLAND_ROOM_NAME || 'main-island';
export const worldStub = (env, world) => env.ISLAND.get(env.ISLAND.idFromName(world));
export function simulationStub(env, world, owner) {
  const namespace = owner === 'sea' ? env.SEA_SIM : env.ISLAND_SIM;
  const key = JSON.stringify([world, owner]);
  const stub = namespace.get(namespace.idFromName(key));
  return {
    fetch(input) {
      const request = new Request(input);
      request.headers.set('X-Simulation-Key', key);
      return stub.fetch(request);
    },
  };
}
export function presenceStub(env, world) {
  return env.WORLD_PRESENCE.get(env.WORLD_PRESENCE.idFromName(JSON.stringify([world, 'presence'])));
}
export function internalPost(stub, path, data) {
  return stub.fetch(
    new Request('https://island.internal' + path, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data),
    })
  );
}
