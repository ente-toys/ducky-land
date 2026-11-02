import {lazy,Suspense} from 'react';
const PixiPage=lazy(()=>import('./pixi/PixiPage.jsx'));
const ThreePage=lazy(()=>import('./three/ThreePage.jsx'));
const AssetCatalog=lazy(()=>import('./three/AssetCatalog.jsx'));
export default function App(){const path=window.location.pathname.replace(/\/$/,'');if(path==='/pixi')return <Suspense fallback={null}><PixiPage/></Suspense>;if(path==='/three/assets')return <Suspense fallback={null}><AssetCatalog/></Suspense>;if(path==='/three')return <Suspense fallback={null}><ThreePage/></Suspense>;return <main className="island-app"><iframe className="island-scene" src="/rive/web/island.html?scene=1&view=flat" title="Ducky Land. Scroll or pinch to zoom, drag to explore, click to walk. WASD moves, Q quacks, E dances, Home shows the island." allow="autoplay"/></main>;}
