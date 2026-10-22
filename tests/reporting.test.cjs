const test = require("node:test");
const assert = require("node:assert/strict");
const { atoIncomeYearStart, claimSummary, filterTrips, financialYearRange, localCalendarDate, reportingPeriodLabel, reportingSummary } = require("../logic.js");

const trip = (id, date, distance, overrides = {}) => ({ id, date, distance, classification: "work", vehicleRegistration: "TEST", claimMethod: "employer", rateCents: 50, distanceSource: "unknown", ...overrides });

test("financial-year ranges are inclusive calendar dates and use journey starts", () => {
  const range = financialYearRange(2023);
  assert.deepEqual(range, { from: "2023-07-01", to: "2024-06-30", label: "2023–24" });
  const rows = [trip("before", "2023-06-30", 1), trip("first", "2023-07-01", 2), trip("leap", "2024-02-29", 3), trip("last", "2024-06-30", 4, { endDate: "2024-07-02" }), trip("after", "2024-07-01", 5)];
  assert.deepEqual(filterTrips(rows, range).map((row) => row.id), ["first", "leap", "last"]);
  assert.equal(reportingPeriodLabel(range), "FY 2023–24 · 1 Jul 2023 – 30 Jun 2024");
  assert.equal(reportingPeriodLabel({ from: "2024-02-29" }), "29 Feb 2024 – Onwards");
  assert.equal(reportingPeriodLabel(), "All dates");
  for (const invalid of [null, "", "custom", 2025.5, 999, 9999]) assert.equal(financialYearRange(invalid), null);
});

test("current financial year follows the device calendar at Australian midnight", () => {
  const original = process.env.TZ;
  try {
    for (const [zone, instant] of [["Australia/Brisbane", "2026-06-30T14:01:00Z"], ["Australia/Perth", "2026-06-30T16:01:00Z"], ["Australia/Darwin", "2026-06-30T14:31:00Z"], ["Australia/Adelaide", "2026-06-30T14:31:00Z"], ["Australia/Sydney", "2026-06-30T14:01:00Z"]]) {
      process.env.TZ = zone;
      assert.equal(atoIncomeYearStart(localCalendarDate(new Date(instant))), 2026, zone);
      assert.equal(atoIncomeYearStart(localCalendarDate(new Date(new Date(instant).getTime() - 120000))), 2025, zone);
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});

test("classification breakdown preserves unknown evidence and reconciles money to the cent", () => {
  const rows = [trip("a", "2026-01-01", 1.01), trip("b", "2026-01-02", 1.01), trip("c", "2026-01-03", 1.01), trip("p", "2026-01-04", 10, { classification: "personal" }), trip("u", "2026-01-05", 20, { classification: "unclassified" })];
  const before = structuredClone(rows);
  const summary = reportingSummary(rows, "general");
  assert.equal(summary.estimate, 1.52);
  assert.equal([...summary.contributions.values()].reduce((sum, amount) => sum + Math.round(amount * 100), 0), 152);
  assert.deepEqual(summary.counts, { work: 3, personal: 1, unclassified: 1 });
  assert.deepEqual(summary.classifications, { work: 3.0300000000000002, personal: 10, unclassified: 20 });
  assert.deepEqual(rows, before);
});

test("ATO contributions preserve caps per vehicle/year independent of input order and source", () => {
  const rows = [trip("b", "2026-06-30", 2000, { distanceSource: "manual" }), trip("a", "2025-07-01", 4000), trip("c", "2026-07-01", 6000), trip("d", "2026-01-01", 100, { vehicleRegistration: "OTHER" }), trip("p", "2026-01-01", 10000, { classification: "personal" })];
  const summary = reportingSummary(rows, "ato_cents");
  assert.equal(summary.estimate, claimSummary(rows, "ato_cents").atoCents);
  assert.equal(summary.contributions.get(rows[0]), 880);
  assert.equal(summary.contributions.get(rows[1]), 3520);
  assert.equal(summary.contributions.get(rows[2]), 4550);
  assert.equal(summary.contributions.get(rows[4]), 0);
  assert.equal([...summary.contributions.values()].reduce((sum, amount) => sum + amount, 0), summary.estimate);
  const reverse = reportingSummary([...rows].reverse(), "ato_cents");
  for (const row of rows) assert.equal(reverse.contributions.get(row), summary.contributions.get(row));
  assert.match(summary.note, /selected records/);
  assert.equal(reportingSummary([trip("future", "2099-07-01", 50)], "ato_cents").estimate, null);
});

test("annual logbook estimates are full-year scoped and retain full representative evidence", () => {
  const period = { id: "period", vehicleRegistration: "TEST", vehicleDescription: "Synthetic car", startDate: "2024-07-01", endDate: "2024-09-30", openingOdometer: 0, closingOdometer: 1000 };
  const allTrips = [trip("evidence", "2024-07-01", 400, { claimMethod: "ato_logbook" })];
  const annualRecords = [2024, 2025].map((year) => ({ vehicleRegistration: "TEST", incomeYearStart: year, logbookPeriodId: "period", openingOdometer: 0, closingOdometer: year === 2024 ? 10000 : 20000 }));
  const options = { filters: financialYearRange(2025), periods: [period], annualRecords, allTrips };
  assert.equal(reportingSummary([], "ato_logbook", options).estimate, 8000);
  assert.equal(reportingSummary([], "ato_logbook", { ...options, filters: {} }).estimate, 12000);
  for (const filters of [{ from: "2025-08-01", to: "2026-06-30" }, { from: "2025-07-01" }, { ...options.filters, client: "x" }, { ...options.filters, query: "x" }, { ...options.filters, classification: "personal" }, { ...options.filters, classification: "unclassified" }]) assert.equal(reportingSummary([], "ato_logbook", { ...options, filters }).estimate, null);
  assert.equal(reportingSummary([], "ato_logbook", { ...options, filters: { ...options.filters, classification: "work" } }).estimate, 8000);
  assert.equal(reportingSummary([], "ato_logbook", { ...options, annualRecords: [] }).estimate, null);
  assert.equal(reportingSummary([], "ato_logbook", { ...options, annualRecords: annualRecords.map((r) => ({ ...r, circumstancesChanged: true })) }).estimate, null);
  assert.equal(reportingSummary([], "ato_logbook", { ...options, allTrips: [{ ...allTrips[0], distance: 1500 }] }).estimate, null, "do not report business use above 100%");
  assert.equal(reportingSummary([], "ato_logbook", { ...options, annualRecords: annualRecords.map((r) => ({ ...r, vehicleRegistration: "OTHER" })) }).estimate, null);
  assert.equal(reportingSummary([], "ato_logbook", { ...options, periods: [{ ...period, closingOdometer: 0 }] }).estimate, null);
});

test("report scope separates period exclusions from filters and non-contributing trips", () => {
  const allTrips = [trip("old", "2025-06-30", 10), trip("w", "2025-07-01", 20), trip("p", "2026-01-01", 30, { classification: "personal" }), trip("u", "2026-06-30", 40, { classification: "unclassified" }), trip("next", "2026-07-01", 50)];
  const filters = { ...financialYearRange(2025), classification: "work" };
  const selected = filterTrips(allTrips, filters);
  const summary = reportingSummary(selected, "general", { filters, allTrips });
  assert.equal(summary.scopeNote, "1 of 3 trips in this period included; 2 excluded by trip type, search or client filters. 2 trips outside this period.");
  assert.equal(summary.estimate, 10);
  assert.match(summary.note, /1 of 1 selected trips contribute/);
  const personal = reportingSummary(filterTrips(allTrips, { ...filters, classification: "personal" }), "general");
  assert.equal(personal.estimate, 0);
  assert.match(personal.note, /No Work trips/);
  const mixed = reportingSummary([selected[0], { ...selected[0], id: "record", claimMethod: "record_only" }], "general");
  assert.equal(mixed.estimate, 10);
  assert.match(mixed.note, /1 of 2 selected trips contribute/);
});
