import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/entrypoints/**',
        'src/**/__tests__/fixtures/**',
        // Adapter scaffolding (registry currently empty, base is types-only).
        // Coverage lands when the first platform adapter ships with its
        // own happy-dom fixture suite.
        'src/adapters/base.ts',
        'src/adapters/registry.ts',
        // Content bootstrap depends on the live chrome content-script
        // environment and the registered adapter. Covered by the
        // synthetic Playwright spec (e2e/) once the first adapter exists.
        'src/content/bootstrap.ts',
        // Build-time env loader. Reads import.meta.env, which only exists
        // under Vite/wxt — covered indirectly through every other module
        // that imports from it.
        'src/lib/env.ts',
        // Service-worker bootstrap (startBackground + onSyncTick). Wires
        // chrome.runtime/alarm listeners; behavior is meaningful only in
        // the actual SW environment. handleMessage is exported and unit-
        // tested separately.
        'src/background/index.ts',
      ],
      // Thresholds at scaffold time. Ratchet up as feature code lands per
      // ai-guides/01-principles.md ("Wallet, payouts, consent, sales = 95%.
      // Other code = 80%.").
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
