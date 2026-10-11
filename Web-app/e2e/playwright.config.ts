import { join, resolve } from 'node:path';
import { defineConfig } from 'playwright/test';

const webDirectory = resolve(__dirname, '..');
const serverDirectory = resolve(webDirectory, '..', 'server');

export default defineConfig({
  testDir: resolve(__dirname, 'src'),
  testMatch: '**/*.e2e-spec.ts',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: resolve(webDirectory, 'coverage', 'playwright'),
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4200',
    browserName: 'chromium',
    permissions: ['camera', 'microphone'],
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
    }
  },
  webServer: [
    {
      name: 'Angular',
      command: 'npm start -- --host 127.0.0.1 --port 4200',
      cwd: webDirectory,
      url: 'http://127.0.0.1:4200/',
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      name: 'Signaling',
      command: `node --import tsx "${join('src', 'index.ts')}"`,
      cwd: serverDirectory,
      port: 8000,
      reuseExistingServer: false,
      timeout: 30_000
    }
  ]
});
