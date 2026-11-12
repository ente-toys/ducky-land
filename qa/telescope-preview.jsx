import React from 'react';
import {createRoot} from 'react-dom/client';
import IslandStargaze from '../src/pixi/IslandStargaze.jsx';
import '../src/pixi/pixi.css';
const island={current:{telescopeOptions:()=>({telescope:'preview',at:true}),travelOptions:()=>({}),telescopeAction:()=>true,stopInput(){}}};
createRoot(document.getElementById('root')).render(<><div style={{padding:32,color:'#fff9df',font:'16px system-ui'}}>Telescope preview · sample sky data</div><IslandStargaze island={island} playing offline/></>);
