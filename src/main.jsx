export {prepareIsland,islandReady} from './rendering/pixi/art/whole-svg-loader.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import LandingGate from './landing/Landing.jsx';
import './index.css';

const devPage = import.meta.env.DEV && new URLSearchParams(location.search);
const Page = devPage?.has('arena') ? (await import('./features/bog-combat/BogReview.jsx')).default
  : devPage?.has('sled') ? (await import('./features/sled-race/SledReview.jsx')).default : LandingGate;
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
);
