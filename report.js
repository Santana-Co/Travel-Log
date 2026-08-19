const payloadText = sessionStorage.getItem("travel-log-print-report");
sessionStorage.removeItem("travel-log-print-report");
const $ = (selector) => document.querySelector(selector);
const { atoRateForDate, claimAmount, claimSummary, totalDistance } = TravelLogLogic;
const formatKm = (value) => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} km`;
const formatMoney = (value) => new Intl.NumberFormat(undefined, { style: "currency", currency: "AUD" }).format(value);
const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const escapeHtml = (value) => { const node = document.createElement("span"); node.textContent = value ?? ""; return node.innerHTML; };

if (!payloadText) {
  $("#report-content").hidden = true;
  $("#report-message").hidden = false;
  $("#report-message").textContent = "This report has expired. Return to Travel Log and choose Print / Save PDF again.";
} else {
  try {
    const report = JSON.parse(payloadText);
    const trips = Array.isArray(report.trips) ? report.trips : [];
    const distances = trips.reduce((sum, trip) => sum + totalDistance(trip), 0);
    const claims = claimSummary(trips);
    const dates = trips.map((trip) => trip.date).sort();
    const period = report.filters?.from || report.filters?.to ? `${report.filters.from ? formatDate(report.filters.from) : "Beginning"} – ${report.filters.to ? formatDate(report.filters.to) : "Present"}` : `${formatDate(dates[0])} – ${formatDate(dates.at(-1))}`;
    $("#report-owner").textContent = [report.user?.name, report.user?.email].filter(Boolean).join(" · ");
    $("#report-period").textContent = period;
    $("#generated-date").textContent = new Date(report.generatedAt).toLocaleString();
    $("#report-trip-count").textContent = trips.length;
    $("#report-distance").textContent = formatKm(distances);
    $("#report-claim").textContent = formatMoney(claims.total);
    $("#claim-summary-note").textContent = `ATO cents/km: ${formatMoney(claims.atoCents)} · Employer reimbursements: ${formatMoney(claims.employer)}${claims.cappedKilometres ? ` · ${formatKm(claims.cappedKilometres)} excluded above the annual ATO cap` : ""}`;
    const appliedFilters = [report.filters?.client && `Client/project: ${report.filters.client}`, report.filters?.search && `Search: ${report.filters.search}`].filter(Boolean);
    $("#filter-summary").textContent = appliedFilters.length ? `Applied filters · ${appliedFilters.join(" · ")}` : "";
    $("#report-rows").innerHTML = trips.map((trip) => {
      const route = [trip.start, ...(trip.stops || []), trip.end].join(" → ");
      const work = [trip.purpose, trip.clientProject].filter(Boolean).join(" · ") || "—";
      const vehicle = [trip.vehicle, trip.vehicleRegistration].filter(Boolean).join(" · ") || "—";
      const odometer = trip.odometerStart !== "" && trip.odometerStart !== null && trip.odometerStart !== undefined ? `${trip.odometerStart}–${trip.odometerEnd}` : "—";
      const rate = trip.claimMethod === "ato_cents" ? atoRateForDate(trip.date) : trip.rateCents;
      const journeyDates = trip.endDate && trip.endDate !== trip.date ? `${formatDate(trip.date)} – ${formatDate(trip.endDate)}` : formatDate(trip.date);
      return `<tr><td>${escapeHtml(journeyDates)}</td><td>${escapeHtml(work)}</td><td>${escapeHtml(route)}</td><td>${escapeHtml(vehicle)}</td><td>${escapeHtml(odometer)}</td><td>${escapeHtml(formatKm(totalDistance(trip)))}</td><td>${escapeHtml(trip.claimMethod || "record_only")}</td><td>${rate ? `${escapeHtml(rate)}¢/km` : "—"}</td><td>${claimAmount(trip) ? escapeHtml(formatMoney(claimAmount(trip))) : "—"}</td></tr>`;
    }).join("");
  } catch {
    $("#report-content").hidden = true;
    $("#report-message").hidden = false;
    $("#report-message").textContent = "The report could not be prepared. Return to Travel Log and try again.";
  }
}

$("#print-button").addEventListener("click", () => window.print());
$("#close-report").addEventListener("click", () => window.close());
