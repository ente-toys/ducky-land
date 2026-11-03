import React from 'react';
import { createRoot } from 'react-dom/client';
import PixiPage from './pixi/PixiPage.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PixiPage />
  </React.StrictMode>,
);
