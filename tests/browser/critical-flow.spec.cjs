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
  await expect(page.getByRole("heading", { name: "Trip essentials" })).toBeVisible();
  await expect(page.locator("#start-address")).toBeVisible();
  await expect(page.locator("#end-address")).toBeVisible();
  await expect(page.locator("#distance")).toBeVisible();
  await expect(page.locator("#trip-more-details")).not.toHaveAttribute("open", "");
  await expect(page.locator("#purpose")).not.toBeVisible();
  await expect(page.locator("#trip-date")).toHaveValue(localDate);
  await expect(page.locator("#trip-end-date")).toHaveValue(localDate);
  await page.locator("#start-address").fill("Preserved synthetic start");
  await page.getByRole("button", { name: "Save trip" }).click();
  await expect(page.locator("#trip-form-message")).toContainText("Distance must be greater than 0");
  await expect(page.locator("#start-address")).toHaveValue("Preserved synthetic start");
  await expect(page.locator("#distance")).toBeFocused();

  await page.locator("#end-address").fill("Synthetic Brisbane End");
  await page.getByRole("button", { name: "Calculate route" }).click();
  await expect(page.locator("#route-tip")).toContainText("enter the one-way distance manually");
  await expect(page.locator("#start-address")).toHaveValue("Preserved synthetic start");
  await expect(page.locator("#end-address")).toHaveValue("Synthetic Brisbane End");

  await page.locator("#trip-more-details summary").click();
  await expect(page.locator("#purpose")).toBeVisible();
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
  await expect(page.locator("#trip-more-details")).toHaveAttribute("open", "");
  await expect(page.locator("#trip-context-message")).toContainText("today's local date");
  await expect(page.locator("#trip-context-message")).toContainText("odometer readings have been left blank");
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

test("first-trip essentials remain usable at a representative mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "+ Add trip" }).click();
  await expect(page.locator("#trip-dialog")).toBeVisible();
  await expect(page.locator("#trip-date")).toHaveValue(localDate);
  await expect(page.locator("#start-address")).toBeVisible();
  await expect(page.locator("#end-address")).toBeVisible();
  await expect(page.locator("#distance")).toBeVisible();
  await expect(page.getByRole("button", { name: "Calculate route" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save trip" })).toBeVisible();
  await expect(page.locator("#purpose")).not.toBeVisible();
  const saveButtonBounds = await page.getByRole("button", { name: "Save trip" }).boundingBox();
  expect(saveButtonBounds.y + saveButtonBounds.height).toBeLessThanOrEqual(844);
  const layout = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(page.externalRequests).toEqual([]);
});

test("mode-specific required fields are revealed for an ATO logbook trip", async ({ page }) => {
  await page.goto("/?mode=ato_logbook");
  await page.getByRole("button", { name: "+ Add trip" }).click();
  await expect(page.locator("#trip-more-details")).toHaveAttribute("open", "");
  await expect(page.locator("#purpose")).toBeVisible();
  await expect(page.locator("#vehicle-registration")).toBeVisible();
  await expect(page.locator("#odometer-start")).toBeVisible();
  await expect(page.locator("#odometer-end")).toBeVisible();
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
