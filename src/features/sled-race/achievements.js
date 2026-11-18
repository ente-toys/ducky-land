// Medals earned in one race. `history` (best streak, wins so far) comes from the server for online races.
export const SLED_MEDALS=Object.freeze({
  'first-win':{title:'First win',text:'Won a race.'},
  'clean-win':{title:'Clean run',text:'Won without a single wipeout.'},
  'all-ice':{title:'Ice collector',text:'Hit every ice strip on the course.'},
  'from-last':{title:'Comeback',text:'Won after being in last place.'},
  'five-row':{title:'On a roll',text:'Won 5 races in a row.'},
});

export function raceAchievements({me,course,standings,history={wins:0,streak:0}}){
  if(!me)return [];
  const won=me.place===1&&standings.length>1,earned=[];
  if(won&&history.wins===0)earned.push('first-win');
  if(won&&me.crashes===0)earned.push('clean-win');
  if(course.ice.length&&me.iceHits>=course.ice.length)earned.push('all-ice');
  if(won&&me.wasLast)earned.push('from-last');
  if(won&&history.streak+1>=5&&history.streak<5)earned.push('five-row');
  return earned.map(id=>({id,...SLED_MEDALS[id]}));
}
