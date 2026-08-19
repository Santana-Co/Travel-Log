(function exposeTravelLogLogic(root) {
  function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
  function odometerDistance(trip) {
    const start = Number(trip.odometerStart);
    const end = Number(trip.odometerEnd);
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? end - start : 0;
  }
  function totalDistance(trip) { return odometerDistance(trip) || number(trip.distance) * (trip.roundTrip ? 2 : 1); }
  function atoIncomeYear(date) {
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(date || ""));
    if (!match) return "";
    const year = Number(match[1]);
    const start = Number(match[2]) >= 7 ? year : year - 1;
    return `${start}–${String(start + 1).slice(-2)}`;
  }
  function atoRateForDate(date) {
    const year = atoIncomeYear(date);
    if (year === "2026–27") return 91;
    if (year === "2025–26" || year === "2024–25") return 88;
    return null;
  }
  function claimAmount(trip) {
    if (trip.claimMethod === "ato_logbook" || trip.claimMethod === "record_only") return 0;
    const rate = trip.claimMethod === "ato_cents" ? atoRateForDate(trip.date) : number(trip.rateCents);
    return totalDistance(trip) * number(rate) / 100;
  }
  function claimSummary(trips) {
    let employer = 0;
    let atoCents = 0;
    let cappedKilometres = 0;
    const groups = new Map();
    trips.forEach((trip) => {
      const method = trip.claimMethod || (number(trip.rateCents) > 0 ? "employer" : "record_only");
      if (method === "employer") employer += claimAmount(trip);
      if (trip.claimMethod !== "ato_cents") return;
      const key = `${atoIncomeYear(trip.date)}|${String(trip.vehicleRegistration || "unassigned").toUpperCase()}`;
      const group = groups.get(key) || { kilometres: 0, rate: atoRateForDate(trip.date) || 0 };
      group.kilometres += totalDistance(trip);
      groups.set(key, group);
    });
    groups.forEach((group) => {
      const eligible = Math.min(group.kilometres, 5000);
      cappedKilometres += Math.max(0, group.kilometres - eligible);
      atoCents += eligible * group.rate / 100;
    });
    return { atoCents, cappedKilometres, employer, total: atoCents + employer };
  }
  function logbookSummary(period, trips) {
    const totalKilometres = Math.max(0, number(period.closingOdometer) - number(period.openingOdometer));
    const businessKilometres = trips.filter((trip) => trip.claimMethod === "ato_logbook" && String(trip.vehicleRegistration || "").toUpperCase() === String(period.vehicleRegistration || "").toUpperCase() && trip.date >= period.startDate && trip.date <= period.endDate).reduce((sum, trip) => sum + totalDistance(trip), 0);
    return { businessKilometres, totalKilometres, businessUsePercent: totalKilometres ? businessKilometres / totalKilometres * 100 : 0 };
  }

  function filterTrips(trips, filters = {}) {
    const query = String(filters.query || "").toLowerCase().trim();
    const client = String(filters.client || "").toLowerCase().trim();
    const from = String(filters.from || "");
    const to = String(filters.to || "");
    return trips.filter((trip) => {
      const searchable = `${trip.start || ""} ${(trip.stops || []).join(" ")} ${trip.end || ""} ${trip.purpose || ""} ${trip.clientProject || ""} ${trip.vehicle || ""} ${trip.vehicleRegistration || ""} ${trip.notes || ""}`.toLowerCase();
      return (!query || searchable.includes(query)) && (!client || String(trip.clientProject || "").toLowerCase().includes(client)) && (!from || trip.date >= from) && (!to || trip.date <= to);
    });
  }

  function filterError(from, to) { return from && to && from > to ? "The From date must be before or the same as the To date." : ""; }

  function validateTrip(trip) {
    const date = String(trip.date || "");
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return "Enter a valid trip date.";
    if (trip.endDate && (trip.endDate < date || !/^\d{4}-\d{2}-\d{2}$/.test(trip.endDate))) return "Journey end date cannot be before its start date.";
    if (!Number.isFinite(Number(trip.distance)) || Number(trip.distance) <= 0 || Number(trip.distance) > 100000) return "Distance must be greater than 0 and no more than 100,000 km.";
    if (typeof trip.start !== "string" || trip.start.trim().length < 3 || trip.start.length > 250) return "Starting address must be between 3 and 250 characters.";
    if (typeof trip.end !== "string" || trip.end.trim().length < 3 || trip.end.length > 250) return "Ending address must be between 3 and 250 characters.";
    if (!Array.isArray(trip.stops) || trip.stops.length > 8 || trip.stops.some((stop) => typeof stop !== "string" || stop.trim().length < 3 || stop.length > 250)) return "Use no more than 8 valid stop addresses.";
    if (String(trip.purpose || "").length > 80) return "Trip purpose is too long.";
    if (String(trip.clientProject || "").length > 120) return "Client or project is too long.";
    if (String(trip.vehicle || "").length > 120) return "Vehicle is too long.";
    if (String(trip.vehicleRegistration || "").length > 20) return "Vehicle registration is too long.";
    if (String(trip.notes || "").length > 2000) return "Notes must be no more than 2,000 characters.";
    if (!Number.isFinite(Number(trip.rateCents)) || Number(trip.rateCents) < 0 || Number(trip.rateCents) > 1000) return "Reimbursement rate must be between 0 and 1,000 cents per kilometre.";
    const method = trip.claimMethod || "record_only";
    if (!["record_only", "employer", "ato_cents", "ato_logbook"].includes(method)) return "Choose a valid claim method.";
    if ((method === "ato_cents" || method === "ato_logbook") && !String(trip.vehicleRegistration || "").trim()) return "Enter the vehicle registration for ATO records.";
    if ((method === "ato_cents" || method === "ato_logbook") && !String(trip.purpose || "").trim()) return "Choose the work purpose for ATO records.";
    if (method === "ato_cents" && atoRateForDate(trip.date) === null) return "The app does not have an ATO cents-per-kilometre rate for this income year.";
    const hasOdometerStart = trip.odometerStart !== "" && trip.odometerStart !== null && trip.odometerStart !== undefined;
    const hasOdometerEnd = trip.odometerEnd !== "" && trip.odometerEnd !== null && trip.odometerEnd !== undefined;
    if (hasOdometerStart !== hasOdometerEnd) return "Enter both the starting and ending odometer readings.";
    if (hasOdometerStart && (!Number.isFinite(Number(trip.odometerStart)) || !Number.isFinite(Number(trip.odometerEnd)) || Number(trip.odometerStart) < 0 || Number(trip.odometerEnd) <= Number(trip.odometerStart))) return "Ending odometer must be greater than starting odometer.";
    if (method === "ato_logbook" && !hasOdometerStart) return "ATO logbook trips need starting and ending odometer readings.";
    return "";
  }

  function validateLogbookPeriod(period) {
    if (!String(period.vehicleRegistration || "").trim()) return "Enter the vehicle registration.";
    if (!String(period.vehicleDescription || "").trim()) return "Enter the vehicle make and model.";
    if (!period.startDate || !period.endDate || period.endDate < period.startDate) return "Enter a valid logbook start and end date.";
    const days = Math.floor((new Date(`${period.endDate}T00:00:00Z`) - new Date(`${period.startDate}T00:00:00Z`)) / 86400000) + 1;
    if (!Number.isFinite(days) || days < 84) return "An ATO logbook period must cover at least 12 continuous weeks (84 days).";
    if (!Number.isFinite(Number(period.openingOdometer)) || !Number.isFinite(Number(period.closingOdometer)) || Number(period.openingOdometer) < 0 || Number(period.closingOdometer) <= Number(period.openingOdometer)) return "Closing odometer must be greater than opening odometer.";
    return "";
  }

  function csvCell(value) {
    let text = String(value ?? "");
    if (/^[\t\r\n ]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  const api = { atoIncomeYear, atoRateForDate, claimAmount, claimSummary, csvCell, filterError, filterTrips, logbookSummary, odometerDistance, totalDistance, validateLogbookPeriod, validateTrip };
  root.TravelLogLogic = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
