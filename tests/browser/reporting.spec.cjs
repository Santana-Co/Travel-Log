const { test, expect } = require("@playwright/test");
const { readFile } = require("node:fs/promises");

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context, page }) => {
  context.externalRequests = [];
  context.browserErrors = [];
  context.on("page", (opened) => {
    opened.on("pageerror", (error) => context.browserErrors.push(error.message));
    opened.on("console", (message) => { if (message.type() === "error") context.browserErrors.push(message.text()); });
  });
  page.on("pageerror", (error) => context.browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") context.browserErrors.push(message.text()); });
  // Context-wide: also covers the printable popup's first request. No live fallthrough.
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:4173") return route.continue();
    context.externalRequests.push(url.origin);
    await route.abort("blockedbyclient");
  });
  await page.clock.setFixedTime(new Date("2026-06-30T14:01:00Z"));
});
test.afterEach(async ({ context }) => {
  expect(context.externalRequests).toEqual([]);
  expect(context.browserErrors).toEqual([]);
});

async function csvRows(page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const text = await readFile(await (await pending).path(), "utf8");
  // Fixture fields have no line breaks; support quoted commas and escaped quotes.
  const lines = text.replace(/^\uFEFF/, "").split("\r\n").map((line) => [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((match) => match[1].replaceAll('""', '"')));
  return lines.slice(1).map((values) => Object.fromEntries(lines[0].map((header, i) => [header, values[i]])));
}
async function printReport(page) {
  const pending = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Print / Save PDF" }).click();
  const report = await pending;
  await expect(report.locator("#report-content")).toBeVisible();
  return report;
}
const contribution = "Contribution to report estimate (AUD, after cap)";

for (const [mode, amount] of [["general", "3,000.00"], ["ato_cents", "4,400.00"]]) {
  test(`FY reporting reconciles dashboard, CSV and print in ${mode}`, async ({ page }) => {
    await page.goto(`/?reporting&mode=${mode}`);
    await expect(page.locator("#trip-count")).toHaveText("7");
    const fy = page.getByRole("combobox", { name: "Financial year", exact: true });
    await expect(fy.locator('option[value="2026"]')).toHaveText("FY 2026–27 (current)");
    await fy.selectOption("2025");
    await expect(page.locator("#filter-from")).toHaveValue("2025-07-01");
    await expect(page.locator("#filter-to")).toHaveValue("2026-06-30");
    await expect(page.locator("#reporting-period")).toHaveText("FY 2025–26 · 1 Jul 2025 – 30 Jun 2026");
    await expect(page.locator("#trip-count")).toHaveText("4");
    await expect(page.locator("#total-distance")).toHaveText("6,150 km");
    await expect(page.locator("#work-distance")).toHaveText("6,000 km");
    await expect(page.locator("#claim-total")).toHaveText(`A$${amount}`);
    await expect(page.locator("#classification-summary")).toHaveText("Work: 2 trips · 6,000 km | Personal: 1 trip · 100 km | Unclassified: 1 trip · 50 km");
    await expect(page.locator("#report-inclusion")).toContainText("4 of 4 trips in this period included; 0 excluded");
    await expect(page.locator("#report-inclusion")).toContainText("3 trips outside this period");
    await expect(page.locator("#ato-cap-message")).toContainText("2 of 4 selected trips contribute");
    const rows = await csvRows(page);
    expect(rows.map((row) => row["Journey starts"]).sort()).toEqual(["2025-07-01", "2026-02-01", "2026-02-02", "2026-06-30"]);
    expect(rows.every((row) => row["Financial year (journey start)"] === "2025–26")).toBe(true);
    expect(rows.reduce((sum, row) => sum + Math.round(Number(row[contribution]) * 100), 0)).toBe(Number(amount.replaceAll(",", "")) * 100);
    expect(rows.find((row) => row["Classification"] === "personal")[contribution]).toBe("0.00");
    const manual = rows.find((row) => row["Distance source"] === "manual");
    expect(manual["Manual distance reason"]).toBe("actual_route_differed");
    expect(manual["Manual distance note"]).toBe("Synthetic detour evidence");
    expect(manual["Journey ends"]).toBe("2026-07-02");
    const report = await printReport(page);
    await expect(report.locator("#report-period")).toHaveText(await page.locator("#reporting-period").textContent());
    await expect(report.locator("#report-distance")).toHaveText("6,150 km");
    await expect(report.locator("#report-claim")).toHaveText(`A$${amount}`);
    await expect(report.locator("#report-inclusion")).toHaveText(await page.locator("#report-inclusion").textContent());
    await expect(report.locator("#report-rows")).toContainText("Not recorded");
    await expect(report.locator("#report-rows")).toContainText("Synthetic detour evidence");
    const printed = await report.locator("#report-rows tr td:last-child").allTextContents();
    expect(printed.reduce((sum, value) => sum + Math.round(Number(value.replace(/[^0-9.]/g, "")) * 100), 0)).toBe(Number(amount.replaceAll(",", "")) * 100);
    await report.close();

    await page.locator("#filter-classification").selectOption("work");
    await expect(page.locator("#trip-count")).toHaveText("2");
    await expect(page.locator("#report-inclusion")).toContainText("2 excluded by trip type");
    expect((await csvRows(page)).every((row) => row.Classification === "work")).toBe(true);
    for (const type of ["personal", "unclassified"]) {
      await page.locator("#filter-classification").selectOption(type);
      await expect(page.locator("#trip-count")).toHaveText("1");
      await expect(page.locator("#claim-total")).toHaveText("A$0.00");
      await expect(page.locator("#ato-cap-message")).toContainText("No Work trips");
      expect((await csvRows(page))[0].Classification).toBe(type);
    }
    // Account portability stays complete even with restrictive report filters.
    await page.getByRole("button", { name: "Open account settings" }).click();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download my data" }).click();
    const backup = JSON.parse(await readFile(await (await pending).path(), "utf8"));
    expect(backup.trips).toHaveLength(7);
    await page.locator("#close-account").click();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(fy).toHaveValue("all");
    expect(await csvRows(page)).toHaveLength(7);
    await page.locator("#filter-from").fill("2026-06-30");
    await page.locator("#filter-to").fill("2026-07-01");
    await expect(fy).toHaveValue("custom");
    await expect(page.locator("#trip-count")).toHaveText("2");
    expect((await csvRows(page)).map((row) => row["Journey starts"]).sort()).toEqual(["2026-06-30", "2026-07-01"]);
    const custom = await printReport(page);
    await expect(custom.locator("#report-period")).toHaveText("30 Jun 2026 – 1 Jul 2026");
    await expect(custom.locator("#report-claim")).toHaveText(await page.locator("#claim-total").textContent());
    await custom.close();
  });
}

test("FY reporting mobile selectors and empty states are clear without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?reporting");
  const fy = page.getByRole("combobox", { name: "Financial year", exact: true });
  await expect(fy).toBeVisible();
  const bounds = await fy.boundingBox();
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(bounds.y + bounds.height).toBeLessThan(844);
  await fy.selectOption("2024");
  await expect(page.locator("#trip-count")).toHaveText("1");
  await page.locator("#filter-client").fill("no matching synthetic client");
  await expect(page.locator("#report-empty-message")).toContainText("No trips match FY 2024–25");
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.locator("#filter-from").fill("2027-07-01");
  await page.locator("#filter-to").fill("2028-06-30");
  await expect(page.locator("#report-empty-message")).toContainText("No trips match FY 2027–28");
  await page.locator("#filter-to").fill("2027-07-31");
  await expect(page.locator("#report-empty-message")).toContainText("1 Jul 2027 – 31 Jul 2027");
  await page.locator("#filter-to").fill("2027-06-30");
  await expect(page.locator("#filter-message")).toContainText("From date must be before");
  await expect(page.getByRole("button", { name: "Print / Save PDF" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await fy.selectOption("2025");
  const report = await printReport(page);
  await expect(report.locator("#report-period")).toContainText("FY 2025–26");
  expect(await report.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("reporting-mobile.png"), fullPage: true });
  await report.close();
});

test("FY reporting annual logbooks use supported full-year evidence only", async ({ page }) => {
  await page.goto("/?reporting&mode=ato_logbook");
  await page.getByRole("combobox", { name: "Financial year", exact: true }).selectOption("2026");
  await expect(page.locator("#claim-total")).toHaveText("4,000 km");
  await expect(page.locator("#ato-cap-message")).toContainText("1 valid annual odometer record");
  const report = await printReport(page);
  await expect(report.locator("#report-claim")).toHaveText("4,000 km");
  await report.close();
  expect((await csvRows(page)).every((row) => row[contribution] === "")).toBe(true);
  await page.getByRole("combobox", { name: "Financial year", exact: true }).selectOption("2025");
  await expect(page.locator("#claim-total")).toHaveText("8,000 km");
  await page.locator("#filter-classification").selectOption("personal");
  await expect(page.locator("#claim-total")).toHaveText("Unavailable");
  await expect(page.locator("#ato-cap-message")).toContainText("Personal or Unclassified filters");
  await page.locator("#filter-classification").selectOption("work");
  await expect(page.locator("#claim-total")).toHaveText("8,000 km");
  await page.locator("#filter-from").fill("2025-08-01");
  await expect(page.locator("#claim-total")).toHaveText("Unavailable");
  await expect(page.locator("#ato-cap-message")).toContainText("partial years");
  await page.getByRole("combobox", { name: "Financial year", exact: true }).selectOption("2023");
  await expect(page.locator("#claim-total")).toHaveText("Unavailable");
  await expect(page.locator("#ato-cap-message")).toContainText("No valid annual odometer records");
});
