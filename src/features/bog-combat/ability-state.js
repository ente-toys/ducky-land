export const ABILITY_TIMERS=Object.freeze({dodgeLeft:'dodgeUntil',dodgeProtectLeft:'dodgeProtectedUntil',
  dodgeCooldownLeft:'dodgeReadyAt',speedLeft:'speedUntil',hitShieldLeft:'hitShieldUntil',bushRevealLeft:'bushRevealUntil'});
export function saveAbilityTimers(p,time){
  const saved={};for(const [left,until]of Object.entries(ABILITY_TIMERS))saved[left]=Math.max(0,(p[until]??0)-time);
  return saved;
}
