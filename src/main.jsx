import React from 'react';
import { createRoot } from 'react-dom/client';
import PixiPage from './pixi/PixiPage.jsx';
import './index.css';

// Normal entry sails to Bog. Keep the direct arena URL as a dev-only shortcut.
const Page = import.meta.env.DEV && new URLSearchParams(location.search).has('arena')
  ? (await import('./pixi/BogReview.jsx')).default : PixiPage;
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
);
