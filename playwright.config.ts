import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  use: { baseURL: 'http://localhost:5174', ...devices['Pixel 7'] },
  webServer: { command: 'npx vite --port 5174 --strictPort', port: 5174, reuseExistingServer: true, timeout: 60_000 },
});
