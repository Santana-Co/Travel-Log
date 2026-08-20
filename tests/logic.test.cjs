const assert = require("node:assert/strict");
const test = require("node:test");
const { atoCentsRates, atoIncomeYear, atoRateForDate, claimAmount, claimSummary, csvCell, filterError, filterTrips, logbookAnnualSummary, logbookSummary, logbookValidityEnd, normalizeRecordingMode, recordingModeForTrip, totalDistance, validateAnnualOdometerRecord, validateLogbookPeriod, validateTrip } = require("../logic.js");

const validTrip = { date: "2026-08-19", distance: 50, start: "Brisbane office", stops: [], end: "Gold Coast office", roundTrip: true, purpose: "Client visit", clientProject: "Project A", vehicle: "Car", rateCents: 88, notes: "" };

test("calculates round-trip distance and claim", () => {
  assert.equal(totalDistance(validTrip), 100);
  assert.equal(claimAmount(validTrip), 88);
});

test("applies current ATO rates, odometer distance, and the annual 5,000 km cap", () => {
  assert.equal(atoIncomeYear("2026-08-20"), "2026–27");
  assert.equal(atoRateForDate("2026-08-20"), 91);
  assert.equal(atoRateForDate("2025-08-20"), 88);
  assert.equal(totalDistance({ ...validTrip, odometerStart: 1000, odometerEnd: 1062.5 }), 62.5);
  const atoTrips = [{ ...validTrip, roundTrip: false, distance: 3000, claimMethod: "ato_cents", vehicleRegistration: "123ABC", date: "2026-08-20" }, { ...validTrip, roundTrip: false, distance: 2500, claimMethod: "ato_cents", vehicleRegistration: "123ABC", date: "2027-01-20" }];
  assert.deepEqual(claimSummary(atoTrips), { atoCents: 4550, cappedKilometres: 500, employer: 0, total: 4550 });
});

test("selects historical ATO rates from the trip date and stops at unpublished years", () => {
  assert.equal(Object.isFrozen(atoCentsRates), true);
  assert.equal(atoRateForDate("2015-07-01"), 66);
  assert.equal(atoRateForDate("2018-07-01"), 68);
  assert.equal(atoRateForDate("2020-07-01"), 72);
  assert.equal(atoRateForDate("2022-07-01"), 78);
  assert.equal(atoRateForDate("2023-07-01"), 85);
  assert.equal(atoRateForDate("2024-07-01"), 88);
  assert.equal(atoRateForDate("2026-06-30"), 88);
  assert.equal(atoRateForDate("2026-07-01"), 91);
  assert.equal(atoRateForDate("2027-06-30"), 91);
  assert.equal(atoRateForDate("2027-07-01"), null);
});

test("uses the selected ATO cents mode for trips created under an earlier workflow", () => {
  const earlierTrips = [
    { ...validTrip, roundTrip: false, distance: 100, claimMethod: "record_only", vehicleRegistration: "123ABC", date: "2026-08-20" },
    { ...validTrip, roundTrip: false, distance: 50, claimMethod: "employer", vehicleRegistration: "123ABC", date: "2026-08-21" },
  ];
  assert.equal(claimAmount(earlierTrips[0], "ato_cents"), 91);
  assert.deepEqual(claimSummary(earlierTrips, "ato_cents"), { atoCents: 136.5, cappedKilometres: 0, employer: 0, total: 136.5 });
});

test("calculates and validates a 12-week ATO logbook period", () => {
  const period = { vehicleRegistration: "123ABC", vehicleDescription: "Toyota Hilux", startDate: "2026-07-01", endDate: "2026-09-22", openingOdometer: 10000, closingOdometer: 12000 };
  assert.equal(validateLogbookPeriod(period), "");
  assert.match(validateLogbookPeriod({ ...period, endDate: "2026-08-01" }), /12 continuous weeks/i);
  assert.deepEqual(logbookSummary(period, [{ ...validTrip, date: "2026-08-20", claimMethod: "ato_logbook", vehicleRegistration: "123ABC", odometerStart: 10100, odometerEnd: 10200 }]), { businessKilometres: 100, totalKilometres: 2000, businessUsePercent: 5 });
});

test("applies a representative logbook percentage to valid annual odometer totals", () => {
  const period = { id: "period-1", vehicleRegistration: "123ABC", vehicleDescription: "Toyota Hilux", startDate: "2026-07-01", endDate: "2026-09-22", openingOdometer: 10000, closingOdometer: 11000 };
  const logbookTrips = [{ ...validTrip, date: "2026-08-20", claimMethod: "ato_logbook", vehicleRegistration: "123ABC", odometerStart: 10100, odometerEnd: 10700 }];
  const annual = { incomeYearStart: 2026, openingOdometer: 10000, closingOdometer: 30000, circumstancesChanged: false };
  assert.equal(logbookValidityEnd(period), "2031-06-30");
  assert.deepEqual(logbookAnnualSummary(annual, period, logbookTrips), { businessUsePercent: 60, estimatedBusinessKilometres: 12000, isValid: true, totalKilometres: 20000, validUntil: "2031-06-30" });
  assert.equal(logbookAnnualSummary({ ...annual, incomeYearStart: 2025 }, period, logbookTrips).isValid, false);
  assert.equal(logbookAnnualSummary({ ...annual, incomeYearStart: 2031 }, period, logbookTrips).isValid, false);
  assert.equal(logbookAnnualSummary({ ...annual, circumstancesChanged: true }, period, logbookTrips).isValid, false);
});

test("validates annual financial-year odometer records", () => {
  const annual = { vehicleRegistration: "123ABC", incomeYearStart: 2026, openingOdometer: 10000, closingOdometer: 30000, notes: "Representative use continued" };
  assert.equal(validateAnnualOdometerRecord(annual), "");
  assert.match(validateAnnualOdometerRecord({ ...annual, closingOdometer: 9000 }), /closing odometer/i);
  assert.match(validateAnnualOdometerRecord({ ...annual, incomeYearStart: 1999 }), /financial year/i);
});

test("normalizes profile recording modes and preserves each trip's original workflow", () => {
  assert.equal(normalizeRecordingMode(), "general");
  assert.equal(normalizeRecordingMode("unsupported"), "general");
  assert.equal(normalizeRecordingMode("ato_cents"), "ato_cents");
  assert.equal(normalizeRecordingMode("ato_logbook"), "ato_logbook");
  assert.equal(recordingModeForTrip({ claimMethod: "employer" }), "general");
  assert.equal(recordingModeForTrip({ claimMethod: "ato_cents" }), "ato_cents");
  assert.equal(recordingModeForTrip({ claimMethod: "ato_logbook" }), "ato_logbook");
});

test("filters across date, client and text fields", () => {
  const trips = [validTrip, { ...validTrip, date: "2026-07-01", clientProject: "Project B", purpose: "Training" }];
  assert.equal(filterTrips(trips, { from: "2026-08-01", to: "2026-08-31" }).length, 1);
  assert.equal(filterTrips(trips, { client: "project b" }).length, 1);
  assert.equal(filterTrips(trips, { query: "training" }).length, 1);
});

test("validates filter ranges and trip bounds", () => {
  assert.match(filterError("2026-09-01", "2026-08-01"), /From date/);
  assert.equal(validateTrip(validTrip), "");
  assert.match(validateTrip({ ...validTrip, distance: 0 }), /Distance/);
  assert.match(validateTrip({ ...validTrip, stops: Array(9).fill("Valid stop") }), /8/);
  assert.match(validateTrip({ ...validTrip, rateCents: 1001 }), /rate/);
  assert.match(validateTrip({ ...validTrip, date: "2026-02-30" }), /valid trip date/i);
  assert.match(validateTrip({ ...validTrip, claimMethod: "ato_logbook", vehicleRegistration: "123ABC" }), /odometer/i);
});

test("neutralizes spreadsheet formulas in CSV cells", () => {
  for (const value of ["=1+1", "+cmd", "-2+3", "@SUM(A1:A2)", "  =HYPERLINK(\"bad\")"]) {
    assert.ok(csvCell(value).startsWith('"\''), value);
  }
  assert.equal(csvCell('Client "A"'), '"Client ""A"""');
  assert.ok(csvCell("\n@SUM(A1:A2)").startsWith('"\''));
});
