const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    timezoneId: "Australia/Brisbane",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/browser/server.cjs",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: false,
  },
});
