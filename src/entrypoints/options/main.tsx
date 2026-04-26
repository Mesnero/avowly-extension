import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../../styles/global.css';

import { Options } from './Options.js';

const root = document.getElementById('root');
if (!root) {
  throw new Error('options root element missing');
}

createRoot(root).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
