export {prepareIsland,islandReady} from './rendering/pixi/art/whole-svg-loader.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import PixiPage from './app/PixiPage.jsx';
import './index.css';

const Page = import.meta.env.DEV && new URLSearchParams(location.search).has('arena')
  ? (await import('./features/bog-combat/BogReview.jsx')).default : PixiPage;
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
);
