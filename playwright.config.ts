import { defineConfig, devices } from "@playwright/test";

const previewBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests",
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: previewBaseUrl ?? "http://127.0.0.1:4321",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  ...(previewBaseUrl
    ? {}
    : {
        webServer: {
          command: "npm run build && npm run preview -- --ignore-lock",
          url: "http://127.0.0.1:4321",
          reuseExistingServer: false,
          timeout: 120_000,
        },
      }),
});
