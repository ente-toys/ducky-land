// Standalone review uses the production React dialog and canvas renderer, with local fixture data.
import React, {useRef} from 'react';
import {createRoot} from 'react-dom/client';
import IslandStargaze from '../../src/pixi/IslandStargaze.jsx';
function Preview() {
  const island = useRef({
    telescopeOptions:() => ({telescope:true,at:true}),
    telescopeAction:() => true,
    travelOptions:() => ({}),
    stopInput() {},
  });
  return <IslandStargaze island={island} offline/>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
const opening = setInterval(() => {
  const button = document.querySelector('.pixi-travel-action');
  if (button) {button.click(); clearInterval(opening);}
},100);
