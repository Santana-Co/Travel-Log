const assert = require("node:assert/strict");
const test = require("node:test");
const logic = require("../logic.js");

test("saved vehicle selection copies values and rejects archived/invalid profiles", () => {
  const profile = { label: " 2022 Synthetic RAV4 ", registration: " test123 ", archived: false };
  const snapshot = logic.vehicleSnapshot(profile);
  assert.deepEqual(snapshot, { vehicle: "2022 Synthetic RAV4", vehicleRegistration: "TEST123" });
  profile.label = "Renamed";
  profile.registration = "CHANGED";
  profile.archived = true;
  assert.equal(snapshot.vehicle, "2022 Synthetic RAV4");
  assert.equal(snapshot.vehicleRegistration, "TEST123");
  assert.equal(logic.vehicleSnapshot(profile), null);
  assert.equal(logic.vehicleSnapshot(null), null);
  assert.equal(logic.vehicleSnapshot({ label: " " }), null);
  assert.equal(logic.vehicleSnapshot({ label: "Manual equivalent" }).vehicleRegistration, "");
  assert.match(logic.validateVehicleProfile({ label: "a".repeat(121) }), /description/);
  assert.match(logic.validateVehicleProfile({ label: "Valid", registration: "X".repeat(21) }), /Registration/);
});

test("logbook matching remains based on recorded registration, never profile labels", () => {
  const period = { vehicleRegistration: "TEST123", startDate: "2026-07-01", endDate: "2026-09-30", openingOdometer: 0, closingOdometer: 100 };
  const trip = { date: "2026-08-01", classification: "work", claimMethod: "ato_logbook", vehicle: "Same name", vehicleRegistration: "TEST123", distance: 10, odometerStart: 10, odometerEnd: 20 };
  const records = [trip, { ...trip, vehicleRegistration: "OTHER", odometerEnd: 90 }, { ...trip, classification: "personal" }];
  assert.equal(logic.logbookSummary(period, records).businessKilometres, 10);
  trip.vehicle = "Deliberately renamed snapshot";
  assert.equal(logic.logbookSummary(period, records).businessKilometres, 10);
});

test("saved vehicle convenience does not relax ATO registration requirements or merge names", () => {
  const base = { date: "2026-08-01", endDate: "2026-08-01", start: "Synthetic start", end: "Synthetic end", stops: [], purpose: "Client visit", classification: "work", distance: 3000, rateCents: 0, claimMethod: "ato_cents", ...logic.vehicleSnapshot({ label: "Shared label", registration: "" }) };
  assert.match(logic.validateTrip(base), /registration/);
  const first = { ...base, vehicleRegistration: "FIRST" };
  const second = { ...base, vehicleRegistration: "SECOND" };
  assert.equal(logic.validateTrip(first), "");
  assert.equal(logic.claimSummary([first, second], "ato_cents").cappedKilometres, 0);
  assert.equal(logic.claimSummary([first, { ...second, vehicleRegistration: "FIRST" }], "ato_cents").cappedKilometres, 1000);
});
