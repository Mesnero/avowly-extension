import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/chrome-extension';

import { env } from '../../lib/env.js';

import '../../styles/global.css';

import { Popup } from './Popup.js';

const root = document.getElementById('root');
if (!root) {
  throw new Error('popup root element missing');
}

createRoot(root).render(
  <StrictMode>
    <ClerkProvider publishableKey={env.CLERK_PUBLISHABLE_KEY}>
      <Popup />
    </ClerkProvider>
  </StrictMode>,
);
