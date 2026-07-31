import { defineConfig, devices } from "@playwright/test";

const previewBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: previewBaseUrl ?? "http://127.0.0.1:4321",
    ...devices["Desktop Chrome"],
  },
  ...(previewBaseUrl
    ? {}
    : {
        webServer: {
          command: "npm run build && npm run preview",
          url: "http://127.0.0.1:4321",
          reuseExistingServer: false,
          timeout: 120_000,
        },
      }),
});
