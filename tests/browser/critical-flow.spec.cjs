const { test, expect } = require("@playwright/test");
const { readFile } = require("node:fs/promises");

const localDate = "2026-09-10";
const storedStartDate = "2026-08-20";
const storedEndDate = "2026-08-21";

test.beforeEach(async ({ page }) => {
  page.externalRequests = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") await route.continue();
    else if (url.hostname === "travel-log-distance-api.jfsantana0691.workers.dev" && url.pathname === "/distance") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ distanceKm: 18.4 }) });
    }
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
  const baselineTrip = page.locator("article.trip", { hasText: "Fixture baseline" });
  await expect(baselineTrip.locator(".route")).toContainText("From");
  await expect(baselineTrip.locator(".route")).toContainText("Synthetic Depot");
  await expect(baselineTrip.locator(".route")).toContainText("Destination");
  await expect(baselineTrip.locator(".route")).toContainText("Synthetic Office");
  await expect(baselineTrip.locator(".route")).toContainText("via 1 stop");
  await expect(baselineTrip.locator(".trip-distance")).toContainText("25 km");
  await expect(baselineTrip.locator(".trip-distance")).toContainText("Round trip");
  await expect(baselineTrip.locator(".trip-classification")).toHaveText("Unclassified");
  await expect(baselineTrip.locator(".trip-evidence")).toContainText("purpose, client/project, vehicle, notes");
  await expect(baselineTrip).not.toContainText("Notes: —");
  await baselineTrip.locator(".trip-record-details summary").click();
  await expect(baselineTrip.getByRole("heading", { name: "Journey" })).toBeVisible();
  await expect(baselineTrip.getByText("Synthetic Stop", { exact: true })).toBeVisible();
  await expect(baselineTrip.getByText("Not recorded", { exact: true })).toBeVisible();
  await expect(baselineTrip.getByRole("heading", { name: "Work details" })).toBeVisible();
  await expect(baselineTrip.getByRole("heading", { name: "Vehicle" })).toBeVisible();

  await baselineTrip.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("#classification-current")).toContainText("historical trip is Unclassified");
  await page.getByRole("button", { name: "Save trip" }).click();
  await expect(baselineTrip.locator(".trip-classification")).toHaveText("Unclassified");

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
  await expect(page.locator("#trip-form-message")).toContainText("Work or Personal");
  await expect(page.locator("#start-address")).toHaveValue("Preserved synthetic start");
  await expect(page.getByLabel("Work", { exact: true })).toBeFocused();
  await page.getByLabel("Work", { exact: true }).check();
  await page.getByRole("button", { name: "Save trip" }).click();
  await expect(page.locator("#trip-form-message")).toContainText("Distance must be greater than 0");
  await expect(page.locator("#start-address")).toHaveValue("Preserved synthetic start");
  await expect(page.locator("#distance")).toBeFocused();

  await page.locator("#end-address").fill("Synthetic Brisbane End");
  await page.getByRole("button", { name: "Calculate route" }).click();
  await expect(page.locator("#route-tip")).toContainText("Distance calculated");
  await expect(page.locator("#start-address")).toHaveValue("Preserved synthetic start");
  await expect(page.locator("#end-address")).toHaveValue("Synthetic Brisbane End");

  await page.locator("#trip-more-details summary").click();
  await expect(page.locator("#purpose")).toBeVisible();
  await page.locator("#trip-date").fill(storedStartDate);
  await page.locator("#trip-end-date").fill(storedEndDate);
  await page.locator("#distance").fill("24.5");
  await expect(page.locator("#route-tip")).toContainText("Manual distance entered");
  await expect(page.locator("#manual-distance-evidence")).toBeVisible();
  await page.locator("#manual-distance-reason").selectOption("actual_route_differed");
  await page.locator("#manual-distance-note").fill("Synthetic road closure");
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
  await expect(createdTrip.locator(".trip-classification")).toHaveText("Work");
  await createdTrip.locator(".trip-record-details summary").click();
  await expect(createdTrip.getByText("Entered manually", { exact: true })).toBeVisible();
  await expect(createdTrip.getByText("Actual route differed", { exact: true })).toBeVisible();
  await expect(createdTrip.getByText("Synthetic road closure", { exact: true })).toBeVisible();

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
  await expect(page.getByLabel("Work", { exact: true })).toBeChecked();
  await expect(page.locator("#manual-distance-reason")).toHaveValue("copied_from_trip");
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

test("Personal filtering and Unclassified duplication require deliberate intent", async ({ page }) => {
  await page.goto("/");
  const historicalTrip = page.locator("article.trip", { hasText: "Fixture baseline" });
  await historicalTrip.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.locator("#trip-context-message")).toContainText("Choose Work or Personal");
  await page.getByRole("button", { name: "Save trip" }).click();
  await expect(page.locator("#trip-form-message")).toContainText("Work or Personal");
  await page.getByLabel("Personal", { exact: true }).check();
  await page.getByRole("button", { name: "Save trip" }).click();
  await expect(page.locator("article.trip", { hasText: "Fixture baseline" })).toHaveCount(2);

  const personalTrip = page.locator("article.trip", { hasText: "Fixture baseline" }).filter({ has: page.locator(".trip-classification", { hasText: "Personal" }) });
  await personalTrip.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.getByLabel("Personal", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Save trip" }).click();
  await expect(page.locator("article.trip", { hasText: "Fixture baseline" })).toHaveCount(3);

  await page.locator("#filter-classification").selectOption("personal");
  await expect(page.locator("article.trip")).toHaveCount(2);
  await expect(page.locator("article.trip .trip-classification")).toHaveText(["Personal", "Personal"]);
  await page.locator("#filter-classification").selectOption("unclassified");
  await expect(page.locator("article.trip")).toHaveCount(1);
  await expect(page.locator("article.trip .trip-classification")).toHaveText("Unclassified");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator("article.trip")).toHaveCount(3);
  expect(page.externalRequests).toEqual([]);
});

test("route calculation and odometer recording persist the method that established distance", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "+ Add trip" }).click();
  await page.getByLabel("Work", { exact: true }).check();
  await page.locator("#start-address").fill("Synthetic route start");
  await page.locator("#end-address").fill("Synthetic route end");
  await page.getByRole("button", { name: "Calculate route" }).click();
  await expect(page.locator("#distance")).toHaveValue("18.4");
  await expect(page.locator("#manual-distance-evidence")).toBeHidden();
  await page.getByRole("button", { name: "Save trip" }).click();
  const routeTrip = page.locator("article.trip", { hasText: "Synthetic route start" });
  await routeTrip.locator(".trip-record-details summary").click();
  await expect(routeTrip.getByText("Route calculated", { exact: true })).toBeVisible();

  await routeTrip.getByRole("button", { name: "Edit" }).click();
  await page.locator("#client-project").fill("Unrelated edit");
  await page.getByRole("button", { name: "Save trip" }).click();
  const editedRouteTrip = page.locator("article.trip", { hasText: "Unrelated edit" });
  await editedRouteTrip.locator(".trip-record-details summary").click();
  await expect(editedRouteTrip.getByText("Route calculated", { exact: true })).toBeVisible();

  await editedRouteTrip.getByRole("button", { name: "Edit" }).click();
  await page.locator("#distance").fill("19.2");
  await page.locator("#manual-distance-reason").selectOption("corrected_record");
  await page.getByRole("button", { name: "Save trip" }).click();
  const manualTrip = page.locator("article.trip", { hasText: "Unrelated edit" });
  await manualTrip.locator(".trip-record-details summary").click();
  await expect(manualTrip.getByText("Entered manually", { exact: true })).toBeVisible();
  await expect(manualTrip.getByText("Corrected from another record", { exact: true })).toBeVisible();
  expect(page.externalRequests).toEqual([]);

  await page.goto("/?mode=ato_logbook");
  await page.getByRole("button", { name: "+ Add trip" }).click();
  await page.getByLabel("Work", { exact: true }).check();
  await page.locator("#start-address").fill("Synthetic odometer start");
  await page.locator("#end-address").fill("Synthetic odometer end");
  await page.locator("#distance").fill("10");
  await page.locator("#purpose").selectOption({ label: "Client visit" });
  await page.locator("#vehicle-registration").fill("ODO123");
  await page.locator("#odometer-start").fill("1000");
  await page.locator("#odometer-end").fill("1012");
  await page.getByRole("button", { name: "Save trip" }).click();
  await expect(page.locator("#trip-form-message")).toHaveText("");
  await expect(page.locator("#trip-dialog")).not.toBeVisible();
  const odometerTrip = page.locator("article.trip", { hasText: "Synthetic odometer start" });
  await odometerTrip.locator(".trip-record-details summary").click();
  await expect(odometerTrip.getByText("From odometer", { exact: true })).toBeVisible();
  await expect(odometerTrip.locator(".trip-distance")).toContainText("12 km");
  expect(page.externalRequests).toEqual([]);
});

test("CSV, account JSON, and printable reports represent Unclassified trips honestly", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.locator("#total-distance")).toHaveText("25 km");
  await expect(page.locator("#claim-total")).toHaveText("A$0.00");

  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const csv = await csvDownload;
  const csvText = await readFile(await csv.path(), "utf8");
  expect(csvText).toContain('"Classification"');
  expect(csvText).toContain('"unclassified"');
  expect(csvText).toContain('"Distance source"');
  expect(csvText).toContain('"unknown"');

  await page.getByRole("button", { name: "Open account settings" }).click();
  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my data" }).click();
  const json = await jsonDownload;
  const accountExport = JSON.parse(await readFile(await json.path(), "utf8"));
  expect(accountExport.trips[0].classification).toBe("unclassified");
  expect(accountExport.trips[0].distanceSource).toBe("unknown");
  await page.locator("#close-account").click();

  const reportPagePromise = context.waitForEvent("page");
  await page.getByRole("button", { name: "Print / Save PDF" }).click();
  const reportPage = await reportPagePromise;
  await reportPage.waitForLoadState();
  await expect(reportPage.getByRole("columnheader", { name: "Trip type" })).toBeVisible();
  await expect(reportPage.getByRole("columnheader", { name: "Distance evidence" })).toBeVisible();
  await expect(reportPage.getByRole("cell", { name: "Unclassified" })).toBeVisible();
  await expect(reportPage.getByRole("cell", { name: "Not recorded" })).toBeVisible();
  await reportPage.close();
  expect(page.externalRequests).toEqual([]);
});

test("first-trip essentials remain usable at a representative mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "+ Add trip" }).click();
  await expect(page.locator("#trip-dialog")).toBeVisible();
  await expect(page.locator("#trip-date")).toHaveValue(localDate);
  await expect(page.getByLabel("Work", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Personal", { exact: true })).toBeVisible();
  await expect(page.locator("#start-address")).toBeVisible();
  await expect(page.locator("#end-address")).toBeVisible();
  await expect(page.locator("#distance")).toBeVisible();
  await page.locator("#distance").fill("12");
  await expect(page.locator("#manual-distance-evidence")).toBeVisible();
  await expect(page.getByRole("button", { name: "Calculate route" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save trip" })).toBeVisible();
  await expect(page.locator("#purpose")).not.toBeVisible();
  const saveButtonBounds = await page.getByRole("button", { name: "Save trip" }).boundingBox();
  expect(saveButtonBounds.y + saveButtonBounds.height).toBeLessThanOrEqual(844);
  const layout = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  await page.getByRole("button", { name: "Cancel" }).click();
  const card = page.locator("article.trip", { hasText: "Fixture baseline" });
  await expect(card).toBeVisible();
  const cardLayout = await card.evaluate((element) => ({ right: element.getBoundingClientRect().right, viewportWidth: innerWidth }));
  expect(cardLayout.right).toBeLessThanOrEqual(cardLayout.viewportWidth);
  const actions = card.locator(".trip-actions .text-button");
  await expect(actions).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    const bounds = await actions.nth(index).boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
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

test("schema version 4 blocks application data loading", async ({ page }) => {
  await page.goto("/?schema=4");
  await expect(page.locator("#compatibility-dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Travel Log needs a moment" })).toBeVisible();
  await expect(page.locator("#app-view")).toBeHidden();
  await expect(page.locator("#compatibility-message")).toContainText("database update has not finished");
  const reads = await page.evaluate(() => window.__travelLogFixture.reads);
  expect(reads.profiles || 0).toBe(0);
  expect(reads.trips || 0).toBe(0);
  expect(page.externalRequests).toEqual([]);
});
