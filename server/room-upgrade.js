export const roomUpgradeRequestIdHeader = 'X-Ducky-Room-Upgrade-Id';

export function isRoomUpgradeRoute(route) {
  return route === '/room' || route === '/bog-room';
}

export function isRoomUpgradeRequestId(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
