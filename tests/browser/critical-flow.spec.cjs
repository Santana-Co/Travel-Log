const { test, expect } = require("@playwright/test");

const localDate = "2026-09-10";
const storedStartDate = "2026-08-20";
const storedEndDate = "2026-08-21";

test.beforeEach(async ({ page }) => {
  page.externalRequests = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") await route.continue();
    else {
      page.externalRequests.push(route.request().url());
      await route.abort("blockedbyclient");
    }
  });
  await page.clock.setFixedTime(new Date("2026-09-09T14:30:00.000Z"));
});

test("authenticated trip CRUD and duplication use real browser orchestration", async ({ page }) => {
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });

  await page.goto("/");
  await expect(page.locator("#app-view")).toBeVisible();
  await expect(page.locator("#auth-view")).toBeHidden();
  await expect(page.locator("#compatibility-dialog")).not.toBeVisible();
  await expect(page.locator("#account-name")).toHaveText("Browser Test User");
  await expect(page.locator("#trip-list")).toContainText("Synthetic Depot");

  await page.getByRole("button", { name: "+ Add trip" }).click();
  await expect(page.locator("#trip-date")).toHaveValue(localDate);
  await expect(page.locator("#trip-end-date")).toHaveValue(localDate);
  await page.locator("#trip-date").fill(storedStartDate);
  await page.locator("#trip-end-date").fill(storedEndDate);
  await page.locator("#distance").fill("24.5");
  await page.locator("#purpose").selectOption({ label: "Client visit" });
  await page.locator("#client-project").fill("Synthetic client alpha");
  await page.locator("#start-address").fill("Synthetic Brisbane Start");
  await page.locator("#end-address").fill("Synthetic Brisbane End");
  await page.locator("#notes").fill("Created by browser fixture");
  await page.getByRole("button", { name: "Save trip" }).click();

  let createdTrip = page.locator("article.trip", { hasText: "Synthetic client alpha" });
  await expect(createdTrip).toHaveCount(1);
  await expect(createdTrip).toContainText("Synthetic Brisbane Start");
  await expect(createdTrip).toContainText("Synthetic Brisbane End");
  await expect(createdTrip).toContainText("24.5 km");
  await expect(createdTrip).toContainText("Created by browser fixture");

  await createdTrip.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("#trip-date")).toHaveValue(storedStartDate);
  await expect(page.locator("#trip-end-date")).toHaveValue(storedEndDate);
  await page.locator("#client-project").fill("Synthetic client updated");
  await page.getByRole("button", { name: "Save trip" }).click();
  const updatedTrip = page.locator("article.trip", { hasText: "Synthetic client updated" });
  await expect(updatedTrip).toHaveCount(1);

  await updatedTrip.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.locator("#trip-date")).toHaveValue(localDate);
  await expect(page.locator("#trip-end-date")).toHaveValue(localDate);
  await expect(page.locator("#client-project")).toHaveValue("Synthetic client updated");
  await expect(page.locator("#start-address")).toHaveValue("Synthetic Brisbane Start");
  await page.getByRole("button", { name: "Save trip" }).click();
  await expect(page.locator("article.trip", { hasText: "Synthetic client updated" })).toHaveCount(2);

  page.on("dialog", (dialog) => dialog.accept());
  for (let remaining = 2; remaining > 0; remaining -= 1) {
    const matches = page.locator("article.trip", { hasText: "Synthetic client updated" });
    await matches.first().getByRole("button", { name: "Delete" }).click();
    await expect(matches).toHaveCount(remaining - 1);
  }
  await expect(page.locator("#trip-list")).not.toContainText("Synthetic client updated");
  await expect(page.locator("#trip-list")).toContainText("Fixture baseline");
  expect(browserErrors).toEqual([]);
  expect(page.externalRequests).toEqual([]);
});

test("schema version 2 blocks application data loading", async ({ page }) => {
  await page.goto("/?schema=2");
  await expect(page.locator("#compatibility-dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Travel Log needs a moment" })).toBeVisible();
  await expect(page.locator("#app-view")).toBeHidden();
  await expect(page.locator("#compatibility-message")).toContainText("database update has not finished");
  const reads = await page.evaluate(() => window.__travelLogFixture.reads);
  expect(reads.profiles || 0).toBe(0);
  expect(reads.trips || 0).toBe(0);
  expect(page.externalRequests).toEqual([]);
});
