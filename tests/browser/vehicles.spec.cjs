const { test, expect } = require("@playwright/test");
const { readFile } = require("node:fs/promises");

test.beforeEach(async ({ page, context }) => {
  page.errors = [];
  page.externalRequests = [];
  page.on("pageerror", (error) => page.errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") page.errors.push(message.text()); });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") return route.continue();
    page.externalRequests.push(url.origin);
    return route.abort("blockedbyclient");
  });
  await page.clock.setFixedTime(new Date("2026-09-09T14:30:00.000Z"));
});

test.afterEach(async ({ page }) => {
  expect(page.externalRequests).toEqual([]);
  expect(page.errors).toEqual([]);
});

async function openVehicles(page) {
  await page.locator("#account-button").click();
  await page.locator("#manage-vehicles").click();
  await expect(page.locator("#vehicles-dialog")).toBeVisible();
}
async function saveVehicle(page, label, registration) {
  await page.locator("#vehicle-profile-label").fill(label);
  await page.locator("#vehicle-profile-registration").fill(registration);
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(page.locator("#vehicle-profile-message")).toContainText("Vehicle saved");
  await expect(page.locator("#vehicle-list")).toContainText(label);
}
async function closeVehicles(page) {
  await page.locator("#close-vehicles").click();
  await page.locator("#close-account").click();
}
async function downloadText(page, selector) {
  const pending = page.waitForEvent("download");
  await page.locator(selector).click();
  return readFile(await (await pending).path(), "utf8");
}

for (const mobile of [false, true]) test(`vehicle snapshots survive profile edits, archival and duplication (${mobile ? "mobile" : "desktop"})`, async ({ page }) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#trip-list")).toContainText("Synthetic Depot");
  const original = await page.evaluate(() => structuredClone(window.__travelLogFixture.trips[0]));
  await openVehicles(page);
  await expect(page.locator("#vehicle-list")).toContainText("No saved vehicles");
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(page.locator("#vehicle-profile-label")).toBeFocused();
  await expect(page.locator("#vehicle-profile-message")).toContainText("1–120");
  await saveVehicle(page, "2022 Synthetic RAV4", "test123");
  const id = await page.evaluate(() => window.__travelLogFixture.vehicles[0].id);
  expect(await page.evaluate(() => window.__travelLogFixture.trips[0])).toEqual(original);
  await closeVehicles(page);

  await page.getByRole("button", { name: "+ Add trip" }).click();
  await expect(page.locator("#trip-date")).toHaveValue("2026-09-10");
  await page.getByLabel("Work", { exact: true }).check();
  await page.locator("#start-address").fill("Synthetic vehicle depot");
  await page.locator("#end-address").fill("Synthetic vehicle destination");
  await page.locator("#distance").fill("12");
  await page.locator("#manual-distance-reason").selectOption("employer_provided");
  await page.locator("#trip-more-details summary").click();
  await page.locator("#saved-vehicle").selectOption(id);
  await expect(page.locator("#vehicle")).toHaveValue("2022 Synthetic RAV4");
  await expect(page.locator("#vehicle-registration")).toHaveValue("TEST123");
  await page.getByRole("button", { name: "Save trip", exact: true }).click();
  let card = page.locator("article.trip", { hasText: "Synthetic vehicle depot" });
  await expect(card).toHaveCount(1);
  const tripId = await page.evaluate(() => window.__travelLogFixture.trips.find((trip) => trip.start_address === "Synthetic vehicle depot").id);

  await openVehicles(page);
  await page.getByRole("button", { name: "Edit 2022 Synthetic RAV4", exact: true }).click();
  await saveVehicle(page, "Family synthetic car", "NEW123");
  const stored = await page.evaluate((id) => window.__travelLogFixture.trips.find((trip) => trip.id === id), tripId);
  expect(stored.vehicle).toBe("2022 Synthetic RAV4");
  expect(stored.vehicle_registration).toBe("TEST123");
  await closeVehicles(page);
  const beforeReselectionCsv = await downloadText(page, "#export-button");
  expect(beforeReselectionCsv).toContain("2022 Synthetic RAV4");
  expect(beforeReselectionCsv).not.toContain("Family synthetic car");

  // The duplicate uses recorded values even while the renamed profile is active.
  await card.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.locator("#vehicle")).toHaveValue("2022 Synthetic RAV4");
  await expect(page.locator("#saved-vehicle")).toHaveValue("");
  await expect(page.locator("#trip-context-message")).toContainText("not today's saved profile");
  await page.locator("#cancel-button").click();

  await card.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("#vehicle")).toHaveValue("2022 Synthetic RAV4");
  await expect(page.locator("#vehicle-registration")).toHaveValue("TEST123");
  await page.locator("#notes").fill("Unrelated snapshot edit");
  await page.getByRole("button", { name: "Save trip", exact: true }).click();
  expect(await page.evaluate((id) => window.__travelLogFixture.trips.find((trip) => trip.id === id).vehicle, tripId)).toBe("2022 Synthetic RAV4");
  await card.getByRole("button", { name: "Edit" }).click();
  await page.locator("#saved-vehicle").selectOption(id);
  await expect(page.locator("#vehicle")).toHaveValue("Family synthetic car");
  await page.getByRole("button", { name: "Save trip", exact: true }).click();
  expect(await page.evaluate((id) => window.__travelLogFixture.trips.find((trip) => trip.id === id).vehicle_registration, tripId)).toBe("NEW123");

  await openVehicles(page);
  await page.getByRole("button", { name: "Archive Family synthetic car", exact: true }).click();
  await expect(page.locator("#vehicle-profile-message")).toContainText("Vehicle archived");
  await expect(page.locator("#vehicle-list")).toContainText("Archived");
  if (mobile) {
    expect(await page.locator("#vehicles-dialog").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.locator("#close-vehicles").evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(24);
  }
  await closeVehicles(page);
  await card.locator(".trip-record-details summary").click();
  await expect(card.getByText("Family synthetic car", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.locator("#trip-date")).toHaveValue("2026-09-10");
  await expect(page.locator("#vehicle")).toHaveValue("Family synthetic car");
  await expect(page.locator(`#saved-vehicle option[value="${id}"]`)).toHaveCount(0);
  await expect(page.locator("#manual-distance-reason")).toHaveValue("copied_from_trip");
  await expect(page.locator("#odometer-start")).toHaveValue("");
  await page.getByRole("button", { name: "Save trip", exact: true }).click();
  await expect(card).toHaveCount(2);
  expect(await page.evaluate((id) => window.__travelLogFixture.trips.filter((trip) => trip.id !== id && trip.start_address === "Synthetic vehicle depot")[0].vehicle_registration, tripId)).toBe("NEW123");

  // CSV/print read trip snapshots; JSON also includes archived convenience profiles.
  const csv = await downloadText(page, "#export-button");
  expect(csv).toContain("Family synthetic car");
  expect(csv).toContain("Synthetic Ute");
  expect(csv).toContain("TEST123");
  await page.locator("#account-button").click();
  const account = JSON.parse(await downloadText(page, "#download-data"));
  expect(account.vehicles).toHaveLength(1);
  expect(account.vehicles[0]).toMatchObject({ id, archived: true, label: "Family synthetic car" });
  expect(account.trips.find((trip) => trip.id === original.id)).toMatchObject({ vehicle: "Synthetic Ute", vehicleRegistration: "TEST123" });
  await page.locator("#close-account").click();
  const popup = page.waitForEvent("popup");
  await page.locator("#print-report").click();
  const report = await popup;
  await expect(report.locator("body")).toContainText("Family synthetic car");
  await expect(report.locator("body")).toContainText("Synthetic Ute");
  await report.close();

  // A pre-profile historical record remains editable without a saved-vehicle match.
  const historical = page.locator("article.trip", { hasText: "Fixture baseline" });
  await historical.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("#vehicle")).toHaveValue("Synthetic Ute");
  await expect(page.locator("#saved-vehicle")).toHaveValue("");
  await page.locator("#vehicle").fill("Manual synthetic car");
  await page.locator("#vehicle-registration").fill("MANUAL");
  await page.getByRole("button", { name: "Save trip", exact: true }).click();
  expect(await page.evaluate((id) => window.__travelLogFixture.trips.find((trip) => trip.id === id).vehicle, original.id)).toBe("Manual synthetic car");

  await openVehicles(page);
  await page.getByRole("button", { name: "Restore Family synthetic car", exact: true }).click();
  await expect(page.locator("#vehicle-profile-message")).toContainText("Vehicle restored");
  await closeVehicles(page);
  await page.getByRole("button", { name: "+ Add trip" }).click();
  await page.locator("#trip-more-details summary").click();
  await page.locator("#saved-vehicle").selectOption(id);
  await expect(page.locator("#vehicle-registration")).toHaveValue("NEW123");
  if (mobile) expect(await page.locator("#trip-dialog").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test("vehicle validation/save recovery and ATO logbook registration remain explicit", async ({ page }) => {
  await page.goto("/?mode=ato_logbook");
  await openVehicles(page);
  await page.evaluate(() => { window.__travelLogFixture.failVehicleWrite = true; });
  await page.locator("#vehicle-profile-label").fill("Synthetic odometer car");
  await page.locator("#vehicle-profile-registration").fill("ODO123");
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(page.locator("#vehicle-profile-message")).toContainText("Synthetic save failure");
  await expect(page.locator("#vehicle-profile-label")).toHaveValue("Synthetic odometer car");
  await page.evaluate(() => { window.__travelLogFixture.failVehicleWrite = false; });
  await saveVehicle(page, "Synthetic odometer car", "ODO123");
  const id = await page.evaluate(() => window.__travelLogFixture.vehicles[0].id);
  await closeVehicles(page);
  await page.getByRole("button", { name: "+ Add trip" }).click();
  await page.getByLabel("Work", { exact: true }).check();
  await page.locator("#saved-vehicle").selectOption(id);
  await page.locator("#start-address").fill("Synthetic odometer start");
  await page.locator("#end-address").fill("Synthetic odometer end");
  await page.locator("#distance").fill("10");
  await page.locator("#purpose").selectOption("Client visit");
  await page.locator("#odometer-start").fill("1000");
  await page.locator("#odometer-end").fill("1010");
  await page.locator("#vehicle-registration").fill("UNMATCHED");
  await page.getByRole("button", { name: "Save trip", exact: true }).click();
  await expect(page.locator("#trip-form-message")).toContainText("matching 12-week logbook");
  await page.locator("#saved-vehicle").selectOption(id);
  await page.getByRole("button", { name: "Save trip", exact: true }).click();
  const card = page.locator("article.trip", { hasText: "Synthetic odometer start" });
  await expect(card).toContainText("10 km");
  expect(await page.evaluate(() => window.__travelLogFixture.trips.find((trip) => trip.start_address === "Synthetic odometer start"))).toMatchObject({ vehicle_registration: "ODO123", distance_source: "odometer", odometer_start: 1000, odometer_end: 1010 });
  await card.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.locator("#vehicle-registration")).toHaveValue("ODO123");
  await expect(page.locator("#odometer-start")).toHaveValue("");
  await expect(page.locator("#odometer-end")).toHaveValue("");
});

test("manage vehicles from trip entry preserves input and supports registration-free general travel", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "+ Add trip" }).click();
  await page.getByLabel("Personal", { exact: true }).check();
  await page.locator("#start-address").fill("Synthetic retained start");
  await page.locator("#end-address").fill("Synthetic retained end");
  await page.locator("#distance").fill("5");
  await page.locator("#manual-distance-reason").selectOption("other");
  await page.locator("#trip-more-details summary").click();
  await page.locator("#trip-manage-vehicles").click();
  await saveVehicle(page, "Synthetic registration-free vehicle", "");
  const id = await page.evaluate(() => window.__travelLogFixture.vehicles[0].id);
  await page.locator("#close-vehicles").click();
  await expect(page.locator("#trip-manage-vehicles")).toBeFocused();
  await expect(page.locator("#trip-dialog")).toBeVisible();
  await expect(page.locator("#start-address")).toHaveValue("Synthetic retained start");
  await page.locator("#saved-vehicle").selectOption(id);
  await page.getByRole("button", { name: "Save trip", exact: true }).click();
  await expect(page.locator("article.trip", { hasText: "Synthetic retained start" })).toHaveCount(1);
  expect(await page.evaluate(() => window.__travelLogFixture.trips.find((trip) => trip.start_address === "Synthetic retained start"))).toMatchObject({ classification: "personal", vehicle: "Synthetic registration-free vehicle", vehicle_registration: null });
});
