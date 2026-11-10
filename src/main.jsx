import React from 'react';
import { createRoot } from 'react-dom/client';
import PixiPage from './pixi/PixiPage.jsx';
import './index.css';

// Bog stays outside the normal world roster. The dev arena URL opens the Home engine.
const Page = import.meta.env.DEV && new URLSearchParams(location.search).has('arena')
  ? (await import('./pixi/BogReview.jsx')).default : PixiPage;
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
);
