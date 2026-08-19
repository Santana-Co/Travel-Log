(function exposeTravelLogLogic(root) {
  function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
  function totalDistance(trip) { return number(trip.distance) * (trip.roundTrip ? 2 : 1); }
  function claimAmount(trip) { return totalDistance(trip) * number(trip.rateCents) / 100; }

  function filterTrips(trips, filters = {}) {
    const query = String(filters.query || "").toLowerCase().trim();
    const client = String(filters.client || "").toLowerCase().trim();
    const from = String(filters.from || "");
    const to = String(filters.to || "");
    return trips.filter((trip) => {
      const searchable = `${trip.start || ""} ${(trip.stops || []).join(" ")} ${trip.end || ""} ${trip.purpose || ""} ${trip.clientProject || ""} ${trip.vehicle || ""} ${trip.notes || ""}`.toLowerCase();
      return (!query || searchable.includes(query)) && (!client || String(trip.clientProject || "").toLowerCase().includes(client)) && (!from || trip.date >= from) && (!to || trip.date <= to);
    });
  }

  function filterError(from, to) { return from && to && from > to ? "The From date must be before or the same as the To date." : ""; }

  function validateTrip(trip) {
    const date = String(trip.date || "");
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return "Enter a valid trip date.";
    if (!Number.isFinite(Number(trip.distance)) || Number(trip.distance) <= 0 || Number(trip.distance) > 100000) return "Distance must be greater than 0 and no more than 100,000 km.";
    if (typeof trip.start !== "string" || trip.start.trim().length < 3 || trip.start.length > 250) return "Starting address must be between 3 and 250 characters.";
    if (typeof trip.end !== "string" || trip.end.trim().length < 3 || trip.end.length > 250) return "Ending address must be between 3 and 250 characters.";
    if (!Array.isArray(trip.stops) || trip.stops.length > 8 || trip.stops.some((stop) => typeof stop !== "string" || stop.trim().length < 3 || stop.length > 250)) return "Use no more than 8 valid stop addresses.";
    if (String(trip.purpose || "").length > 80) return "Trip purpose is too long.";
    if (String(trip.clientProject || "").length > 120) return "Client or project is too long.";
    if (String(trip.vehicle || "").length > 120) return "Vehicle is too long.";
    if (String(trip.notes || "").length > 2000) return "Notes must be no more than 2,000 characters.";
    if (!Number.isFinite(Number(trip.rateCents)) || Number(trip.rateCents) < 0 || Number(trip.rateCents) > 1000) return "Reimbursement rate must be between 0 and 1,000 cents per kilometre.";
    return "";
  }

  function csvCell(value) {
    let text = String(value ?? "");
    if (/^[\t\r\n ]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  const api = { claimAmount, csvCell, filterError, filterTrips, totalDistance, validateTrip };
  root.TravelLogLogic = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
