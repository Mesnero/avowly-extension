import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config — primarily for nightly synthetic checks against real LLM
 * platforms. These tests are the early-warning system for adapter breakage
 * (ChatGPT/Claude/etc. changing their DOM).
 *
 * Day-to-day developers don't run these. CI runs them on a schedule.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
