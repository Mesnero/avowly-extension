import { defineBackground } from 'wxt/sandbox';

import { startBackground } from '../background/index.js';

export default defineBackground(() => {
  startBackground();
});
