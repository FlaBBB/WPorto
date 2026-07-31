import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:4321",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://127.0.0.1:4321",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
