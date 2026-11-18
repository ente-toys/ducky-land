// Dev only (?sled): a new course every round (or ?seed=), you against the practice bots.
import {useMemo, useState} from 'react';
import SledRace from './SledRace.jsx';
import {buildCourse} from './course.js';
import {raceSeed} from './lobby.js';
import {botRoster} from './bots.js';
import {SLED} from './rules.js';
import {randomOutfit} from '../../gameplay/outfits.js';

export default function SledReview() {
  const [round, setRound] = useState(0);
  const [seed] = useState(() => Number(new URLSearchParams(location.search).get('seed')) || raceSeed());
  const course = useMemo(() => buildCourse(seed + round), [seed, round]);
  const racers = useMemo(() => [{id: 'me', name: 'You', colour: 0, outfit: randomOutfit()},
    ...botRoster(SLED.practiceBots, {seed: seed + round}).map((b, i) => ({...b, colour: i + 1, outfit: randomOutfit()}))], [seed, round]);
  return <SledRace key={round} course={course} racers={racers} me="me" onAgain={() => setRound(r => r + 1)} onLeave={() => setRound(r => r + 1)}/>;
}
