export function getPlayerKarma(source){
 const balance=source?.room?.karma??source?.karma;
 return Number.isFinite(balance)&&balance>=0?balance:0;
}
