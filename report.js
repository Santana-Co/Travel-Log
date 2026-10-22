const payloadText = sessionStorage.getItem("travel-log-print-report");
sessionStorage.removeItem("travel-log-print-report");
const $ = (selector) => document.querySelector(selector);
const { atoRateForDate, distanceSourceLabel, manualDistanceReasonLabel, normalizeRecordingMode, normalizeTripClassification, totalDistance } = TravelLogLogic;
const { reportingPeriodLabel, reportingSummary } = TravelLogLogic;
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
    const recordingMode = normalizeRecordingMode(report.recordingMode);
    const summary = reportingSummary(trips, recordingMode, { filters: report.filters, periods: report.logbookPeriods, annualRecords: report.annualOdometerRecords, allTrips: report.logbookTrips });
    const period = reportingPeriodLabel(report.filters);
    $("#report-owner").textContent = [report.user?.name, report.user?.email].filter(Boolean).join(" · ");
    $("#report-period").textContent = period;
    $("#generated-date").textContent = new Date(report.generatedAt).toLocaleString();
    $("#report-trip-count").textContent = trips.length;
    $("#report-distance").textContent = formatKm(summary.total);
    $("#report-inclusion").textContent = summary.scopeNote;
    $("#report-claim-label").textContent = summary.label;
    $("#report-claim").textContent = summary.estimate === null ? "Unavailable" : summary.unit === "km" ? formatKm(summary.estimate) : formatMoney(summary.estimate);
    $("#claim-summary-note").textContent = summary.note;
    $("#report-classifications").textContent = ["work", "personal", "unclassified"].map((type) => `${{ work: "Work", personal: "Personal", unclassified: "Unclassified" }[type]}: ${summary.counts[type]} ${summary.counts[type] === 1 ? "trip" : "trips"} · ${formatKm(summary.classifications[type])}`).join(" | ");
    $("#report-empty").hidden = trips.length > 0;
    const classificationFilter = report.filters?.classification && report.filters.classification !== "all" ? `Trip type: ${{ work: "Work", personal: "Personal", unclassified: "Unclassified" }[report.filters.classification] || report.filters.classification}` : "";
    const appliedFilters = [classificationFilter, report.filters?.client && `Client/project: ${report.filters.client}`, report.filters?.query && `Search: ${report.filters.query}`].filter(Boolean);
    $("#filter-summary").textContent = appliedFilters.length ? `Applied filters · ${appliedFilters.join(" · ")}` : "All trip types; no search or client filter.";
    $("#report-rows").innerHTML = trips.map((trip) => {
      const route = [trip.start, ...(trip.stops || []), trip.end].join(" → ");
      const work = [trip.purpose, trip.clientProject].filter(Boolean).join(" · ") || "—";
      const vehicle = [trip.vehicle, trip.vehicleRegistration].filter(Boolean).join(" · ") || "—";
      const odometer = trip.odometerStart !== "" && trip.odometerStart !== null && trip.odometerStart !== undefined ? `${trip.odometerStart}–${trip.odometerEnd}` : "—";
      const displayedMethod = recordingMode === "ato_cents" ? "ato_cents" : trip.claimMethod;
      const rate = displayedMethod === "ato_cents" ? atoRateForDate(trip.date) : trip.rateCents;
      const journeyDates = trip.endDate && trip.endDate !== trip.date ? `${formatDate(trip.date)} – ${formatDate(trip.endDate)}` : formatDate(trip.date);
      const classification = { work: "Work", personal: "Personal", unclassified: "Unclassified" }[normalizeTripClassification(trip.classification)];
      const method = { record_only: "General record", employer: "Employer reimbursement", ato_cents: "ATO cents/km", ato_logbook: "ATO logbook" }[displayedMethod] || "General record";
      const amount = summary.unit === "AUD" && summary.estimate !== null ? summary.contributions.get(trip) : null;
      const distanceEvidence = [distanceSourceLabel(trip.distanceSource), trip.distanceSource === "manual" && manualDistanceReasonLabel(trip.manualDistanceReason), trip.distanceSource === "manual" && trip.manualDistanceNote].filter(Boolean).join(" · ");
      return `<tr><td>${escapeHtml(journeyDates)}</td><td>${escapeHtml(classification)}</td><td>${escapeHtml(work)}</td><td>${escapeHtml(route)}</td><td>${escapeHtml(vehicle)}</td><td>${escapeHtml(odometer)}</td><td>${escapeHtml(formatKm(totalDistance(trip)))}</td><td>${escapeHtml(distanceEvidence)}</td><td>${escapeHtml(method)}</td><td>${rate ? `${escapeHtml(rate)}¢/km` : "—"}</td><td>${amount !== null ? escapeHtml(formatMoney(amount)) : "—"}</td></tr>`;
    }).join("");
  } catch {
    $("#report-content").hidden = true;
    $("#report-message").hidden = false;
    $("#report-message").textContent = "The report could not be prepared. Return to Travel Log and try again.";
  }
}

$("#print-button").addEventListener("click", () => window.print());
$("#close-report").addEventListener("click", () => window.close());
