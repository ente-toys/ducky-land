// Clients pass the game (room.karma); the authority passes its own actor after
// refreshing actor.karma from RoomKarma.balance(account). Never pass a command.
// Entry checks the balance without spending it.
export function getPlayerKarma(source){
 const balance=source?.room?.karma??source?.karma;
 return Number.isFinite(balance)&&balance>=0?balance:0;
}
