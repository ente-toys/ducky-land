export const FRIEND_RADIUS = 180;

export function nearbyFriend(self, players, friends, dismissed, current) {
  if (!self || !friends) return null;
  const eligible = players.filter(player => player.id !== self.id && player.accountId && player.login &&
    player.accountId !== self.accountId && player.islandId === self.islandId &&
    !friends.has(player.accountId) && !dismissed.has(player.accountId) &&
    Math.hypot(player.x - self.x, player.y - self.y) <= FRIEND_RADIUS);
  return eligible.find(player => player.accountId === current?.accountId) ??
    eligible.sort((a, b) => Math.hypot(a.x - self.x, a.y - self.y) - Math.hypot(b.x - self.x, b.y - self.y))[0] ?? null;
}
