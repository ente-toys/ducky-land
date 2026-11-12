import themes from '../../assets/world/themes/index.js';
import bog from './bog-environment.json' with {type:'json'};

// Keep the saved Bog identity and polar anchor. All clients, navigation and
// room authority use the approved island instead of the retired Bog terrain.
export default {...themes,bog};
