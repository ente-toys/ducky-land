import themes from '../../assets/world/themes/index.js';
import bog from '../features/bog-combat/bog-environment.json' with {type:'json'};
import {withSledHill} from '../features/sled-race/hill.js';

// Iceland carries the sled hill island north of it
export default {...themes,bog,snow:withSledHill(themes.snow)};
