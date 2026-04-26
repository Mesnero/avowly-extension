import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../../styles/global.css';

import { Popup } from './Popup.js';

const root = document.getElementById('root');
if (!root) {
  throw new Error('popup root element missing');
}

createRoot(root).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
