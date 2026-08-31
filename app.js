const storageKey = "travel-log-trips";
const runtimeConfig = window.TravelLogConfig;
if (!runtimeConfig?.supabaseUrl || !runtimeConfig?.supabasePublishableKey || !runtimeConfig?.distanceApiUrl) throw new Error("Travel Log environment configuration is missing.");
const { supabaseUrl, supabasePublishableKey, distanceApiUrl } = runtimeConfig;
const appEnvironment = runtimeConfig.environment === "staging" ? "staging" : "production";
const privacyVersion = "2026-08-20-ato-logbook";
const requiredSchemaVersion = 2;
const db = window.supabase.createClient(supabaseUrl, supabasePublishableKey);
const $ = (selector) => document.querySelector(selector);
$("#build-label").textContent = runtimeConfig.buildLabel || (appEnvironment === "staging" ? "Testing app" : "Live app");
const dialog = $("#trip-dialog");
const form = $("#trip-form");
const privacyDialog = $("#privacy-dialog");
const accountDialog = $("#account-dialog");
const resetPasswordDialog = $("#reset-password-dialog");
const compatibilityDialog = $("#compatibility-dialog");
const { atoIncomeYear, atoIncomeYearStart, atoRateForDate, claimAmount, claimSummary, csvCell, filterError, filterTrips: filterTripRecords, logbookAnnualSummary, logbookSummary, logbookValidityEnd, normalizeRecordingMode, recordingModeForTrip, totalDistance, validateAnnualOdometerRecord, validateLogbookPeriod, validateTrip } = TravelLogLogic;

let trips = [];
let savedLocations = [];
let logbookPeriods = [];
let annualOdometerRecords = [];
let currentUser = null;
let currentProfile = null;
let authMode = "signin";
let privacyResolver = null;
const selectedAddressCoordinates = new WeakMap();
const suggestionTimers = new WeakMap();

function suggestionUrl(query) {
  const url = new URL(distanceApiUrl);
  url.pathname = url.pathname.replace(/\/distance$/, "/suggest");
  url.searchParams.set("q", query);
  return url;
}

function attachAddressSuggestions(input) {
  const menu = document.createElement("div");
  menu.className = "address-suggestions";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", "Suggested addresses");
  menu.hidden = true;
  input.parentElement.append(menu);
  const clear = () => { menu.replaceChildren(); menu.hidden = true; };
  input.addEventListener("input", () => {
    selectedAddressCoordinates.delete(input);
    clearTimeout(suggestionTimers.get(input));
    const query = input.value.trim();
    if (query.length < 3) return clear();
    suggestionTimers.set(input, setTimeout(async () => {
      try {
        const { data: { session } } = await db.auth.getSession();
        if (!session?.access_token) return clear();
        const response = await fetch(suggestionUrl(query), { headers: { Authorization: `Bearer ${session.access_token}` } });
        const data = await response.json();
        if (!response.ok || input.value.trim() !== query) return clear();
        const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
        menu.replaceChildren(...suggestions.flatMap((suggestion) => {
          if (typeof suggestion?.label !== "string" || !Array.isArray(suggestion?.coordinates) || suggestion.coordinates.length !== 2 || !suggestion.coordinates.every(Number.isFinite)) return [];
          const option = document.createElement("button");
          option.type = "button";
          option.className = "address-suggestion";
          option.setAttribute("role", "option");
          option.textContent = suggestion.label;
          option.addEventListener("click", () => {
            input.value = suggestion.label;
            selectedAddressCoordinates.set(input, suggestion.coordinates);
            clear();
          });
          return [option];
        }));
        menu.hidden = !menu.childElementCount;
      } catch { clear(); }
    }, 500));
  });
  input.addEventListener("blur", () => setTimeout(clear, 150));
}

function routeLocation(input) {
  const coordinates = selectedAddressCoordinates.get(input);
  return coordinates ? { coordinates } : input.value.trim();
}

if (appEnvironment === "staging") {
  document.documentElement.dataset.environment = "staging";
  $("#environment-banner").hidden = false;
}

function formatKm(value) { return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} km`; }
function formatMoney(value) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "AUD" }).format(value); }
function displayDate(value) { return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
function escapeHtml(value) { const node = document.createElement("span"); node.textContent = value; return node.innerHTML; }
function escapeAttribute(value) { return escapeHtml(value).replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function setMessage(message, isError = false) { const element = $("#auth-message"); element.textContent = message; element.classList.toggle("error", isError); }
function setButtonBusy(button, busy, busyText) { if (!button.dataset.label) button.dataset.label = button.textContent; button.disabled = busy; button.textContent = busy ? busyText : button.dataset.label; }
function applyTheme(theme) {
  const selected = window.TravelLogTheme.apply(theme);
  const control = $("#appearance-theme");
  if (control) control.value = selected;
  return selected;
}
function activeRecordingMode() { return normalizeRecordingMode(currentProfile?.recording_mode); }
function applyRecordingMode(mode) {
  const selected = normalizeRecordingMode(mode);
  const control = $("#recording-mode");
  if (control) control.value = selected;
  $("#logbook-account-section").hidden = selected !== "ato_logbook";
  const guidance = {
    general: { title: "Employer reimbursement / general travel log", text: "Record work travel and optionally add your employer's reimbursement rate." },
    ato_cents: { title: "ATO cents per kilometre", text: "The applicable ATO rate and 5,000 work-kilometre cap per car and income year are applied automatically." },
    ato_logbook: { title: "ATO logbook / odometer", text: "Record journey odometers and maintain a representative logbook to calculate a business-use percentage." },
  }[selected];
  $("#mode-guidance-title").textContent = guidance.title;
  $("#mode-guidance-text").textContent = guidance.text;
  $("#mode-guidance-link").hidden = selected === "general";
  return selected;
}
function passwordError(password) {
  if (password.length < 12) return "Password must be at least 12 characters long.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include a number.";
  if (!/[!@#$%^&*()_+\-=\[\]{};'\\:\"|<>?,.\/`~]/.test(password)) return "Password must include a symbol such as !, @, #, or _.";
  return "";
}

function fromDatabase(row) {
  return { id: row.id, date: row.trip_date, endDate: row.trip_end_date || row.trip_date, start: row.start_address, stops: row.stops || [], end: row.end_address, distance: Number(row.distance_km), roundTrip: row.round_trip, purpose: row.purpose || "", clientProject: row.client_project || "", vehicle: row.vehicle || "", vehicleRegistration: row.vehicle_registration || "", claimMethod: row.claim_method || (Number(row.rate_cents) > 0 ? "employer" : "record_only"), rateCents: Number(row.rate_cents || 0), odometerStart: row.odometer_start === null || row.odometer_start === undefined ? "" : Number(row.odometer_start), odometerEnd: row.odometer_end === null || row.odometer_end === undefined ? "" : Number(row.odometer_end), notes: row.notes || "" };
}

function toDatabase(trip) {
  return { id: trip.id, user_id: currentUser.id, trip_date: trip.date, trip_end_date: trip.endDate || trip.date, start_address: trip.start, stops: trip.stops || [], end_address: trip.end, distance_km: Number(trip.distance), round_trip: trip.roundTrip, purpose: trip.purpose || null, client_project: trip.clientProject || null, vehicle: trip.vehicle || null, vehicle_registration: trip.vehicleRegistration || null, claim_method: trip.claimMethod || (Number(trip.rateCents) > 0 ? "employer" : "record_only"), rate_cents: Number(trip.rateCents || 0), odometer_start: trip.odometerStart === "" || trip.odometerStart === undefined ? null : Number(trip.odometerStart), odometer_end: trip.odometerEnd === "" || trip.odometerEnd === undefined ? null : Number(trip.odometerEnd), notes: trip.notes };
}

function fromLogbookDatabase(row) {
  return { id: row.id, vehicleRegistration: row.vehicle_registration, vehicleDescription: row.vehicle_description, engineCapacity: row.engine_capacity || "", startDate: row.start_date, endDate: row.end_date, openingOdometer: Number(row.opening_odometer), closingOdometer: Number(row.closing_odometer) };
}

function fromAnnualOdometerDatabase(row) {
  return { id: row.id, logbookPeriodId: row.logbook_period_id, vehicleRegistration: row.vehicle_registration, incomeYearStart: Number(row.income_year_start), openingOdometer: Number(row.opening_odometer), closingOdometer: Number(row.closing_odometer), circumstancesChanged: Boolean(row.circumstances_changed), notes: row.notes || "" };
}

function filteredTrips() {
  return filterTripRecords(trips, { query: $("#search").value, client: $("#filter-client").value, from: $("#filter-from").value, to: $("#filter-to").value });
}

function render() {
  const rangeError = filterError($("#filter-from").value, $("#filter-to").value);
  $("#filter-message").textContent = rangeError;
  const matchingTrips = filteredTrips();
  const total = matchingTrips.reduce((sum, trip) => sum + totalDistance(trip), 0);
  const today = new Date();
  const monthTotal = matchingTrips.filter((trip) => { const date = new Date(`${trip.date}T00:00:00`); return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear(); }).reduce((sum, trip) => sum + totalDistance(trip), 0);
  const recordingMode = activeRecordingMode();
  const claims = claimSummary(matchingTrips, recordingMode);
  $("#trip-count").textContent = matchingTrips.length;
  $("#total-distance").textContent = formatKm(total);
  $("#month-distance").textContent = formatKm(monthTotal);
  if (recordingMode === "ato_cents") {
    $("#claim-summary-label").textContent = "ATO cents/km estimate";
    $("#claim-total").textContent = formatMoney(claims.atoCents);
    $("#ato-cap-message").textContent = claims.cappedKilometres ? `${formatKm(claims.cappedKilometres)} is above the ATO 5,000 km annual cap and has been excluded from the estimate.` : "ATO estimates are capped automatically in the summary.";
  } else if (recordingMode === "ato_logbook") {
    const annualBusinessKilometres = annualOdometerRecords.reduce((sum, record) => {
      const period = logbookPeriods.find((item) => item.id === record.logbookPeriodId);
      const summary = logbookAnnualSummary(record, period, trips);
      return sum + (summary.isValid ? summary.estimatedBusinessKilometres : 0);
    }, 0);
    $("#claim-summary-label").textContent = "Estimated business km";
    $("#claim-total").textContent = formatKm(annualBusinessKilometres);
    $("#ato-cap-message").textContent = "Calculated from each valid logbook percentage and the matching financial-year odometer record.";
  } else {
    $("#claim-summary-label").textContent = "Reimbursement estimate";
    $("#claim-total").textContent = formatMoney(claims.employer);
    $("#ato-cap-message").textContent = "Only trips with an employer rate are included in this estimate.";
  }
  $("#trip-label").textContent = matchingTrips.length === trips.length ? (trips.length === 1 ? "1 trip" : `${trips.length} trips`) : `${matchingTrips.length} of ${trips.length} trips`;
  $("#empty-state").hidden = trips.length > 0;
  $("#trip-list").innerHTML = matchingTrips.map((trip) => {
    const stops = trip.stops || [];
    const waypoints = stops.length ? `&waypoints=${encodeURIComponent(stops.join("|"))}` : "";
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(trip.start)}&destination=${encodeURIComponent(trip.end)}${waypoints}&travelmode=driving`;
    const workDetails = [trip.purpose, trip.clientProject, trip.vehicle, trip.vehicleRegistration].filter(Boolean).map(escapeHtml).join(" · ");
    const displayedMethod = recordingMode === "ato_cents" ? "ato_cents" : trip.claimMethod;
    const displayedClaim = claimAmount(trip, recordingMode);
    const methodLabel = { record_only: "record only", employer: "employer reimbursement", ato_cents: `ATO ${atoIncomeYear(trip.date)} cents/km`, ato_logbook: "ATO logbook" }[displayedMethod] || "record only";
    const odometer = trip.odometerStart !== "" && trip.odometerEnd !== "" ? ` · odometer ${escapeHtml(trip.odometerStart)}–${escapeHtml(trip.odometerEnd)}` : "";
    const dates = trip.endDate && trip.endDate !== trip.date ? `${displayDate(trip.date)} – ${displayDate(trip.endDate)}` : displayDate(trip.date);
    return `<article class="trip"><div class="trip-date">${dates}</div><div><div class="route">${escapeHtml(trip.start)} <span>${stops.length ? `via ${stops.length} stop${stops.length === 1 ? "" : "s"} to ` : "to "}${escapeHtml(trip.end)}</span></div>${workDetails ? `<p class="trip-details">${workDetails}</p>` : ""}<p class="trip-details">${formatKm(totalDistance(trip))}${odometer} · ${methodLabel}${displayedClaim ? ` · ${formatMoney(displayedClaim)} estimate` : ""}${trip.notes ? ` · ${escapeHtml(trip.notes)}` : ""}</p></div><div class="trip-actions"><a class="text-button" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Route</a><button class="text-button" data-duplicate="${trip.id}">Duplicate</button><button class="text-button" data-edit="${trip.id}">Edit</button><button class="text-button" data-delete="${trip.id}">Delete</button></div></article>`;
  }).join("") || (trips.length ? `<div class="empty-state"><h3>No matching trips</h3><p>Clear or change the filters to see more records.</p></div>` : "");
}

async function loadTrips() {
  const { data, error } = await db.from("trips").select("*").order("trip_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  trips = data.map(fromDatabase);
  render();
}

function renderSavedLocations() {
  $("#saved-addresses").innerHTML = savedLocations.map((location) => `<option value="${escapeAttribute(location.address)}" label="${escapeAttribute(location.label)}"></option>`).join("");
  $("#saved-location-list").innerHTML = savedLocations.length ? savedLocations.map((location) => `<div class="saved-location"><div><strong>${escapeHtml(location.label)}</strong><span>${escapeHtml(location.address)}</span></div><button type="button" class="text-button" data-delete-location="${location.id}">Remove</button></div>`).join("") : `<p>No saved locations yet.</p>`;
}

async function loadSavedLocations() {
  const { data, error } = await db.from("saved_locations").select("id, label, address").order("label");
  if (error) throw error;
  savedLocations = data || [];
  renderSavedLocations();
}

function renderLogbooks() {
  const registrations = [...new Set([...logbookPeriods.map((period) => period.vehicleRegistration), ...trips.map((trip) => trip.vehicleRegistration)].filter(Boolean))];
  $("#vehicle-registrations").innerHTML = registrations.map((registration) => `<option value="${escapeAttribute(registration)}"></option>`).join("");
  $("#logbook-list").innerHTML = logbookPeriods.length ? logbookPeriods.map((period) => {
    const summary = logbookSummary(period, trips);
    const warning = summary.businessUsePercent > 100 ? " · check readings: work distance exceeds total distance" : "";
    return `<div class="saved-location"><div><strong>${escapeHtml(period.vehicleRegistration)} · ${escapeHtml(period.vehicleDescription)}</strong><span>${displayDate(period.startDate)} – ${displayDate(period.endDate)} · ${formatKm(summary.businessKilometres)} business / ${formatKm(summary.totalKilometres)} total · ${summary.businessUsePercent.toFixed(1)}% business use · valid through ${displayDate(logbookValidityEnd(period))}${warning}</span></div><button type="button" class="text-button" data-delete-logbook="${period.id}">Remove</button></div>`;
  }).join("") : `<p>No ATO logbook periods yet.</p>`;
  $("#annual-odometer-list").innerHTML = annualOdometerRecords.length ? annualOdometerRecords.map((record) => {
    const period = logbookPeriods.find((item) => item.id === record.logbookPeriodId);
    const summary = logbookAnnualSummary(record, period, trips);
    const year = `${record.incomeYearStart}–${String(record.incomeYearStart + 1).slice(-2)}`;
    const status = record.circumstancesChanged ? "New representative logbook required because circumstances changed" : (summary.isValid ? `${summary.businessUsePercent.toFixed(1)}% × ${formatKm(summary.totalKilometres)} = ${formatKm(summary.estimatedBusinessKilometres)} estimated business travel` : "No valid matching logbook for this financial year");
    return `<div class="saved-location"><div><strong>${escapeHtml(record.vehicleRegistration)} · ${escapeHtml(year)}</strong><span>Odometer ${escapeHtml(record.openingOdometer)}–${escapeHtml(record.closingOdometer)} · ${status}${record.notes ? ` · ${escapeHtml(record.notes)}` : ""}</span></div><button type="button" class="text-button" data-delete-annual-odometer="${record.id}">Remove</button></div>`;
  }).join("") : `<p>No financial-year odometer records yet.</p>`;
}

async function loadLogbooks() {
  const { data, error } = await db.from("logbook_periods").select("*").order("start_date", { ascending: false });
  if (error) throw error;
  logbookPeriods = (data || []).map(fromLogbookDatabase);
  renderLogbooks();
}

async function loadAnnualOdometerRecords() {
  const { data, error } = await db.from("logbook_income_years").select("*").order("income_year_start", { ascending: false });
  if (error) throw error;
  annualOdometerRecords = (data || []).map(fromAnnualOdometerDatabase);
  renderLogbooks();
}

async function migrateLocalTrips() {
  const migrationKey = `travel-log-migrated-${currentUser.id}`;
  if (localStorage.getItem(migrationKey)) return;
  let localTrips = [];
  try { localTrips = JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { localTrips = []; }
  if (!localTrips.length) { localStorage.setItem(migrationKey, "none"); return; }
  if (!confirm(`We found ${localTrips.length} trip${localTrips.length === 1 ? "" : "s"} saved in this browser. Import them into your account?`)) return;
  const rows = localTrips.map((trip) => toDatabase({ ...trip, id: trip.id || crypto.randomUUID(), stops: trip.stops || [] }));
  const { error } = await db.from("trips").upsert(rows, { onConflict: "id" });
  if (error) return alert(`Your saved trips could not be imported: ${error.message}`);
  localStorage.removeItem(storageKey);
  localStorage.setItem(migrationKey, "complete");
  await loadTrips();
}

async function ensurePrivacyAccepted() {
  const { data, error } = await db.from("profiles").select("id, full_name, privacy_version, privacy_accepted_at, appearance_theme, recording_mode").eq("id", currentUser.id).single();
  if (error) throw new Error(`Privacy settings could not be loaded. ${error.message}`);
  currentProfile = data;
  applyTheme(data.appearance_theme);
  applyRecordingMode(data.recording_mode);
  if (data.privacy_version === privacyVersion && data.privacy_accepted_at) return true;
  if (currentUser.user_metadata?.privacy_version === privacyVersion && currentUser.user_metadata?.privacy_accepted_at) {
    const { error: acceptanceError } = await db.rpc("accept_privacy_notice", { notice_version: privacyVersion });
    if (acceptanceError) throw acceptanceError;
    currentProfile = { ...data, privacy_version: privacyVersion, privacy_accepted_at: new Date().toISOString() };
    return true;
  }
  $("#existing-privacy-consent").checked = false;
  privacyDialog.showModal();
  return new Promise((resolve) => { privacyResolver = resolve; });
}

async function ensureSchemaCompatible() {
  const { data, error } = await db.rpc("get_app_schema_version");
  if (error) {
    return { compatible: false, message: "Travel Log could not verify that the database is ready. Check your connection and try again. Your saved records have not been changed." };
  }
  const currentVersion = Number(data);
  if (!Number.isInteger(currentVersion) || currentVersion < requiredSchemaVersion) {
    return { compatible: false, message: "A required Travel Log database update has not finished yet. Please try again shortly. Your saved records have not been changed." };
  }
  return { compatible: true };
}

function showCompatibilityIssue(message) {
  $("#compatibility-message").textContent = message;
  if (!compatibilityDialog.open) compatibilityDialog.showModal();
}

async function showApp(user, force = false) {
  if (!force && currentUser?.id === user.id && !$("#app-view").hidden) return;
  currentUser = user;
  $("#auth-view").hidden = true;
  $("#app-view").hidden = true;
  $("#account-actions").hidden = true;
  $("#account-name").textContent = user.user_metadata?.full_name || user.email;
  try {
    const schema = await ensureSchemaCompatible();
    if (!schema.compatible) {
      showCompatibilityIssue(schema.message);
      return;
    }
    if (compatibilityDialog.open) compatibilityDialog.close();
    $("#app-view").hidden = false;
    $("#account-actions").hidden = false;
    const accepted = await ensurePrivacyAccepted();
    if (!accepted) return;
    $("#account-name").textContent = currentProfile?.full_name || user.user_metadata?.full_name || user.email;
    await Promise.all([loadTrips(), loadSavedLocations(), loadLogbooks(), loadAnnualOdometerRecords()]);
    renderLogbooks();
    render();
    await migrateLocalTrips();
  }
  catch (error) { alert(`Trips could not be loaded: ${error.message}`); }
}

function showAuth() {
  currentUser = null;
  currentProfile = null;
  trips = [];
  savedLocations = [];
  logbookPeriods = [];
  annualOdometerRecords = [];
  $("#auth-view").hidden = false;
  $("#app-view").hidden = true;
  $("#account-actions").hidden = true;
  if (compatibilityDialog.open) compatibilityDialog.close();
}

function setAuthMode(mode) {
  authMode = mode;
  const signingUp = mode === "signup";
  $("#auth-title").textContent = signingUp ? "Create an account" : "Sign in";
  $("#auth-intro").textContent = signingUp ? "Create your private profile to save trips across devices." : "Sign in to see trips saved to your profile.";
  $("#full-name-field").hidden = !signingUp;
  $("#full-name").required = signingUp;
  $("#password").autocomplete = signingUp ? "new-password" : "current-password";
  $("#password").minLength = signingUp ? 12 : 1;
  $("#password-hint").hidden = !signingUp;
  $("#privacy-field").hidden = !signingUp;
  $("#privacy-consent").required = signingUp;
  $("#auth-submit").textContent = signingUp ? "Create account" : "Sign in";
  $("#auth-submit").dataset.label = $("#auth-submit").textContent;
  $("#toggle-auth-mode").textContent = signingUp ? "Already have an account? Sign in" : "Create an account";
  $("#forgot-password").hidden = signingUp;
  setMessage("");
}

function addStop(value = "") {
  if ($("#stops-list").children.length >= 8) {
    alert("A trip can have no more than 8 stops.");
    return;
  }
  const row = document.createElement("div");
  row.className = "stop-row";
  const input = document.createElement("input");
  input.className = "stop-address";
  input.type = "text";
  input.setAttribute("list", "saved-addresses");
  input.minLength = 3;
  input.maxLength = 250;
  input.placeholder = "Stop address";
  input.value = value;
  attachAddressSuggestions(input);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "text-button";
  remove.textContent = "Remove";
  remove.addEventListener("click", () => row.remove());
  row.append(input, remove);
  $("#stops-list").append(row);
}

function updateTripModeTip() {
  const mode = normalizeRecordingMode(form.dataset.recordingMode);
  const atoRate = atoRateForDate($("#trip-date").value);
  if (mode === "ato_cents") $("#claim-tip").textContent = atoRate ? `ATO estimate: ${atoRate}¢/km for ${atoIncomeYear($("#trip-date").value)}, capped at 5,000 work km per car for the income year.` : "No ATO cents-per-kilometre rate is configured for this date.";
  else if (mode === "ato_logbook") $("#claim-tip").textContent = "Enter registration, purpose, and starting and ending odometer readings. Actual expenses are calculated separately using the business-use percentage.";
  else $("#claim-tip").textContent = "Add an employer rate to calculate a reimbursement, or leave it blank to keep a general travel record.";
}

function configureTripMode(mode, trip) {
  const selected = normalizeRecordingMode(mode);
  form.dataset.recordingMode = selected;
  $("#claim-method").value = trip?.claimMethod || (selected === "general" ? "record_only" : selected);
  $("#rate-field").hidden = selected !== "general";
  $("#odometer-start-field").hidden = selected !== "ato_logbook";
  $("#odometer-end-field").hidden = selected !== "ato_logbook";
  $("#round-trip-field").hidden = selected === "ato_logbook";
  $("#distance-field-label").textContent = selected === "ato_logbook" ? "Route estimate (km)" : "One-way distance (km)";
  $("#route-tip").textContent = selected === "ato_logbook" ? "Calculate provides a route estimate for checking. Odometer readings determine the recorded distance." : "Calculate uses the shared route service to estimate the driving distance.";
  updateTripModeTip();
}

function openForm(trip, duplicate = false) {
  form.reset();
  selectedAddressCoordinates.delete($("#start-address"));
  selectedAddressCoordinates.delete($("#end-address"));
  $("#form-title").textContent = duplicate ? "Duplicate trip" : (trip ? "Edit trip" : "Add a trip");
  $("#trip-id").value = duplicate ? "" : (trip?.id || "");
  $("#trip-date").value = duplicate ? new Date().toISOString().slice(0, 10) : (trip?.date || new Date().toISOString().slice(0, 10));
  $("#trip-end-date").value = duplicate ? new Date().toISOString().slice(0, 10) : (trip?.endDate || trip?.date || new Date().toISOString().slice(0, 10));
  $("#distance").value = trip?.distance || "";
  $("#purpose").value = trip?.purpose || "";
  $("#client-project").value = trip?.clientProject || "";
  $("#vehicle").value = trip?.vehicle || "";
  $("#vehicle-registration").value = trip?.vehicleRegistration || "";
  $("#claim-method").value = trip?.claimMethod || (trip?.rateCents ? "employer" : "record_only");
  $("#rate-cents").value = trip?.rateCents || "";
  $("#odometer-start").value = duplicate ? "" : (trip?.odometerStart ?? "");
  $("#odometer-end").value = duplicate ? "" : (trip?.odometerEnd ?? "");
  $("#start-address").value = trip?.start || "";
  $("#stops-list").replaceChildren();
  (trip?.stops || []).forEach(addStop);
  $("#end-address").value = trip?.end || "";
  $("#round-trip").checked = trip?.roundTrip || false;
  $("#notes").value = trip?.notes || "";
  configureTripMode(trip ? recordingModeForTrip(trip) : activeRecordingMode(), trip);
  dialog.showModal();
}

function exportCsv() {
  const rangeError = filterError($("#filter-from").value, $("#filter-to").value);
  if (rangeError) return alert(rangeError);
  const reportTrips = filteredTrips();
  if (!reportTrips.length) return alert("No trips match the current filters.");
  const header = ["Journey starts", "Journey ends", "Purpose", "Client or project", "Vehicle", "Registration", "Claim method", "Start address", "Stops", "End address", "Route estimate (km)", "Round trip", "Starting odometer", "Ending odometer", "Recorded total distance (km)", "Rate (cents/km)", "Trip estimate before annual cap (AUD)", "Notes"];
  const recordingMode = activeRecordingMode();
  const rows = reportTrips.map((trip) => {
    const method = recordingMode === "ato_cents" ? "ato_cents" : trip.claimMethod;
    return [trip.date, trip.endDate || trip.date, trip.purpose, trip.clientProject, trip.vehicle, trip.vehicleRegistration, method, trip.start, (trip.stops || []).join(" → "), trip.end, trip.distance, trip.roundTrip ? "Yes" : "No", trip.odometerStart, trip.odometerEnd, totalDistance(trip), method === "ato_cents" ? atoRateForDate(trip.date) : (trip.rateCents || ""), claimAmount(trip, recordingMode).toFixed(2), trip.notes];
  });
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  downloadBlob("travel-log-report.csv", new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

function openPrintableReport() {
  const rangeError = filterError($("#filter-from").value, $("#filter-to").value);
  if (rangeError) return alert(rangeError);
  const reportTrips = filteredTrips();
  if (!reportTrips.length) return alert("No trips match the current filters.");
  const recordingMode = activeRecordingMode();
  const payload = { generatedAt: new Date().toISOString(), recordingMode, user: { name: currentProfile?.full_name || currentUser.user_metadata?.full_name || "", email: currentUser.email }, filters: { from: $("#filter-from").value, to: $("#filter-to").value, client: $("#filter-client").value.trim(), search: $("#search").value.trim() }, logbookPeriods, annualOdometerRecords, logbookTrips: trips, trips: reportTrips, claimSummary: claimSummary(reportTrips, recordingMode) };
  sessionStorage.setItem("travel-log-print-report", JSON.stringify(payload));
  const reportWindow = window.open("report.html", "_blank");
  if (!reportWindow) { sessionStorage.removeItem("travel-log-print-report"); alert("Allow pop-ups for Travel Log, then try Print / Save PDF again."); }
  else reportWindow.opener = null;
}

function downloadBlob(filename, blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function downloadJson(filename, value) { downloadBlob(filename, new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })); }

function openAccount() {
  $("#account-full-name").textContent = currentProfile?.full_name || currentUser.user_metadata?.full_name || "Not provided";
  $("#account-email").textContent = currentUser.email;
  $("#profile-name").value = currentProfile?.full_name || currentUser.user_metadata?.full_name || "";
  $("#profile-email").value = currentUser.email || "";
  $("#profile-name-message").textContent = "";
  $("#profile-name-message").classList.remove("error");
  $("#profile-email-message").textContent = "";
  $("#profile-email-message").classList.remove("error");
  $("#account-current-password").value = "";
  $("#account-new-password").value = "";
  $("#account-confirm-password").value = "";
  $("#account-password-message").textContent = "";
  $("#account-password-message").classList.remove("error");
  $("#sign-out-other-devices").checked = true;
  $("#appearance-theme").value = window.TravelLogTheme.normalize(currentProfile?.appearance_theme);
  $("#appearance-message").textContent = "";
  $("#recording-mode").value = activeRecordingMode();
  $("#recording-mode-message").textContent = "";
  applyRecordingMode(activeRecordingMode());
  $("#delete-password").value = "";
  $("#delete-confirmation").value = "";
  accountDialog.showModal();
}

async function addSavedLocation() {
  const label = $("#location-label").value.trim();
  const address = $("#location-address").value.trim();
  if (!label || !address) return alert("Enter both a location name and address.");
  const button = $("#add-location");
  setButtonBusy(button, true, "Saving…");
  const { error } = await db.from("saved_locations").upsert({ user_id: currentUser.id, label, address }, { onConflict: "user_id,label" });
  setButtonBusy(button, false);
  if (error) return alert(`Location could not be saved: ${error.message}`);
  $("#location-label").value = "";
  $("#location-address").value = "";
  await loadSavedLocations();
}

async function addLogbookPeriod() {
  const period = { vehicleRegistration: $("#logbook-registration").value.trim().toUpperCase(), vehicleDescription: $("#logbook-vehicle").value.trim(), engineCapacity: $("#logbook-engine").value.trim(), startDate: $("#logbook-start-date").value, endDate: $("#logbook-end-date").value, openingOdometer: $("#logbook-opening").value, closingOdometer: $("#logbook-closing").value };
  const validationError = validateLogbookPeriod(period);
  if (validationError) return alert(validationError);
  const button = $("#add-logbook");
  setButtonBusy(button, true, "Saving…");
  const { error } = await db.from("logbook_periods").upsert({ user_id: currentUser.id, vehicle_registration: period.vehicleRegistration, vehicle_description: period.vehicleDescription, engine_capacity: period.engineCapacity || null, start_date: period.startDate, end_date: period.endDate, opening_odometer: Number(period.openingOdometer), closing_odometer: Number(period.closingOdometer) }, { onConflict: "user_id,vehicle_registration,start_date" });
  setButtonBusy(button, false);
  if (error) return alert(`Logbook period could not be saved: ${error.message}`);
  for (const id of ["logbook-registration", "logbook-vehicle", "logbook-engine", "logbook-start-date", "logbook-end-date", "logbook-opening", "logbook-closing"]) $(`#${id}`).value = "";
  await loadLogbooks();
}

async function addAnnualOdometerRecord() {
  const record = { vehicleRegistration: $("#annual-registration").value.trim().toUpperCase(), incomeYearStart: Number($("#annual-income-year").value), openingOdometer: $("#annual-opening").value, closingOdometer: $("#annual-closing").value, circumstancesChanged: $("#annual-circumstances-changed").checked, notes: $("#annual-notes").value.trim() };
  const validationError = validateAnnualOdometerRecord(record);
  if (validationError) return alert(validationError);
  const eligiblePeriods = logbookPeriods.filter((period) => period.vehicleRegistration.toUpperCase() === record.vehicleRegistration && record.incomeYearStart >= atoIncomeYearStart(period.startDate) && `${record.incomeYearStart + 1}-06-30` <= logbookValidityEnd(period)).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const period = eligiblePeriods[0];
  if (!period) return alert("Create a matching representative logbook period for this registration before adding the financial-year record.");
  const button = $("#add-annual-odometer");
  setButtonBusy(button, true, "Saving…");
  const { error } = await db.from("logbook_income_years").upsert({ user_id: currentUser.id, logbook_period_id: period.id, vehicle_registration: record.vehicleRegistration, income_year_start: record.incomeYearStart, opening_odometer: Number(record.openingOdometer), closing_odometer: Number(record.closingOdometer), circumstances_changed: record.circumstancesChanged, notes: record.notes || null }, { onConflict: "user_id,vehicle_registration,income_year_start" });
  setButtonBusy(button, false);
  if (error) return alert(`Annual odometer record could not be saved: ${error.message}`);
  for (const id of ["annual-registration", "annual-income-year", "annual-opening", "annual-closing", "annual-notes"]) $(`#${id}`).value = "";
  $("#annual-circumstances-changed").checked = false;
  await loadAnnualOdometerRecords();
  render();
}

async function calculateDistance() {
  const start = $("#start-address").value.trim();
  const end = $("#end-address").value.trim();
  const stops = [...document.querySelectorAll(".stop-address")].map((input) => input.value.trim()).filter(Boolean);
  const routeError = validateTrip({ date: "2000-01-01", distance: 1, start, stops, end, rateCents: 0, purpose: "", clientProject: "", vehicle: "", notes: "" });
  if (routeError) { alert(routeError); return; }
  const button = $("#calculate-distance");
  setButtonBusy(button, true, "Calculating…");
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session?.access_token) throw new Error("Your session has expired. Sign in again, then retry.");
    const stopInputs = [...document.querySelectorAll(".stop-address")].filter((input) => input.value.trim());
    const response = await fetch(distanceApiUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ start: routeLocation($("#start-address")), stops: stopInputs.map(routeLocation), end: routeLocation($("#end-address")) }) });
    const data = await response.json();
    if (!response.ok || typeof data.distanceKm !== "number") throw new Error(data.error || "Could not calculate this route.");
    $("#distance").value = data.distanceKm.toFixed(1);
    $("#route-tip").textContent = normalizeRecordingMode(form.dataset.recordingMode) === "ato_logbook"
      ? "Route estimate calculated. Enter the journey's odometer readings; they determine the recorded distance."
      : "Distance calculated using the shared route service. Review it before saving.";
  } catch (error) {
    const message = error.message || "Distance lookup failed. Check the addresses, then try again.";
    if (message.includes("enter the distance manually")) {
      $("#route-tip").textContent = "Could not create a driving route. Enter the one-way distance manually, then save the trip.";
      $("#distance").focus();
    }
    alert(message);
  }
  finally { setButtonBusy(button, false); }
}

$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#auth-submit");
  const email = $("#email").value.trim();
  const password = $("#password").value;
  const requirementError = authMode === "signup" ? passwordError(password) : "";
  if (requirementError) return setMessage(requirementError, true);
  setButtonBusy(button, true, authMode === "signup" ? "Creating…" : "Signing in…");
  setMessage("");
  try {
    if (authMode === "signup") {
      if (!$("#privacy-consent").checked) return setMessage("Please read and agree to the Privacy & Security Notice.", true);
      const redirectTo = location.href.split("#")[0].split("?")[0];
      const { data, error } = await db.auth.signUp({ email, password, options: { data: { full_name: $("#full-name").value.trim(), privacy_version: privacyVersion, privacy_accepted_at: new Date().toISOString() }, emailRedirectTo: redirectTo } });
      if (error) throw error;
      if (!data.session) setMessage("Account created. Check your email and click the confirmation link, then sign in.");
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (error) { setMessage(error.message, true); }
  finally { setButtonBusy(button, false); }
});

$("#toggle-auth-mode").addEventListener("click", () => setAuthMode(authMode === "signin" ? "signup" : "signin"));
$("#forgot-password").addEventListener("click", async () => {
  const email = $("#email").value.trim();
  if (!email) return setMessage("Enter your email address first.", true);
  const redirectTo = location.href.split("#")[0].split("?")[0];
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });
  setMessage(error ? error.message : "Password reset email sent. Check your inbox.", Boolean(error));
});
$("#sign-out-button").addEventListener("click", () => db.auth.signOut());
$("#account-button").addEventListener("click", openAccount);
$("#account-form").addEventListener("submit", (event) => event.preventDefault());
$("#close-account").addEventListener("click", () => {
  $("#delete-password").value = "";
  accountDialog.close();
});
$("#save-profile-name").addEventListener("click", async () => {
  const button = $("#save-profile-name");
  const message = $("#profile-name-message");
  const fullName = $("#profile-name").value.trim();
  if (!fullName) {
    message.textContent = "Enter the name you want to display.";
    message.classList.add("error");
    return;
  }
  setButtonBusy(button, true, "Saving…");
  message.textContent = "";
  message.classList.remove("error");
  const { error } = await db.from("profiles").update({ full_name: fullName }).eq("id", currentUser.id);
  setButtonBusy(button, false);
  if (error) {
    message.textContent = `Name could not be saved: ${error.message}`;
    message.classList.add("error");
    return;
  }
  currentProfile = { ...currentProfile, full_name: fullName };
  $("#account-full-name").textContent = fullName;
  $("#account-name").textContent = fullName;
  message.textContent = "Name saved.";
});
$("#change-profile-email").addEventListener("click", async () => {
  const button = $("#change-profile-email");
  const message = $("#profile-email-message");
  const email = $("#profile-email").value.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    message.textContent = "Enter a valid email address.";
    message.classList.add("error");
    return;
  }
  if (email === currentUser.email?.toLowerCase()) {
    message.textContent = "That is already your account email.";
    message.classList.remove("error");
    return;
  }
  setButtonBusy(button, true, "Requesting…");
  message.textContent = "";
  message.classList.remove("error");
  const redirectTo = location.href.split("#")[0].split("?")[0];
  const { error } = await db.auth.updateUser({ email }, { emailRedirectTo: redirectTo });
  setButtonBusy(button, false);
  if (error) {
    message.textContent = `Email change could not be requested: ${error.message}`;
    message.classList.add("error");
    return;
  }
  message.textContent = "Confirmation email sent. Follow the link in your inbox to complete the change.";
});
$("#change-account-password").addEventListener("click", async () => {
  const button = $("#change-account-password");
  const message = $("#account-password-message");
  const currentPassword = $("#account-current-password").value;
  const password = $("#account-new-password").value;
  const confirmation = $("#account-confirm-password").value;
  if (!currentPassword) {
    message.textContent = "Enter your current password.";
    message.classList.add("error");
    return;
  }
  const requirementError = passwordError(password);
  if (requirementError) {
    message.textContent = requirementError;
    message.classList.add("error");
    return;
  }
  if (password !== confirmation) {
    message.textContent = "The new passwords do not match.";
    message.classList.add("error");
    return;
  }
  setButtonBusy(button, true, "Updating…");
  message.textContent = "";
  message.classList.remove("error");
  const { error: reauthenticationError } = await db.auth.signInWithPassword({ email: currentUser.email, password: currentPassword });
  if (reauthenticationError) {
    setButtonBusy(button, false);
    message.textContent = "Your current password could not be confirmed.";
    message.classList.add("error");
    return;
  }
  const { error } = await db.auth.updateUser({ password });
  if (error) {
    setButtonBusy(button, false);
    message.textContent = `Password could not be changed: ${error.message}`;
    message.classList.add("error");
    return;
  }
  let signedOutOthers = false;
  if ($("#sign-out-other-devices").checked) {
    const { error: signOutError } = await db.auth.signOut({ scope: "others" });
    signedOutOthers = !signOutError;
  }
  setButtonBusy(button, false);
  $("#account-current-password").value = "";
  $("#account-new-password").value = "";
  $("#account-confirm-password").value = "";
  message.textContent = signedOutOthers ? "Password changed. Other devices have been signed out." : "Password changed.";
});
$("#recording-mode").addEventListener("change", async (event) => {
  const control = event.currentTarget;
  const previousMode = activeRecordingMode();
  const nextMode = applyRecordingMode(control.value);
  const message = $("#recording-mode-message");
  control.disabled = true;
  message.textContent = "Saving method…";
  const { error } = await db.from("profiles").update({ recording_mode: nextMode }).eq("id", currentUser.id);
  control.disabled = false;
  if (error) {
    applyRecordingMode(previousMode);
    message.textContent = `Method could not be saved: ${error.message}`;
    message.classList.add("error");
    return;
  }
  currentProfile = { ...currentProfile, recording_mode: nextMode };
  message.classList.remove("error");
  message.textContent = "Method saved. New trips will use this workflow.";
  render();
});
$("#appearance-theme").addEventListener("change", async (event) => {
  const control = event.currentTarget;
  const previousTheme = window.TravelLogTheme.normalize(currentProfile?.appearance_theme);
  const nextTheme = applyTheme(control.value);
  const message = $("#appearance-message");
  control.disabled = true;
  message.textContent = "Saving appearance…";
  const { error } = await db.from("profiles").update({ appearance_theme: nextTheme }).eq("id", currentUser.id);
  control.disabled = false;
  if (error) {
    applyTheme(previousTheme);
    message.textContent = `Appearance could not be saved: ${error.message}`;
    message.classList.add("error");
    return;
  }
  currentProfile = { ...currentProfile, appearance_theme: nextTheme };
  message.classList.remove("error");
  message.textContent = "Appearance saved.";
});
$("#add-location").addEventListener("click", addSavedLocation);
$("#add-logbook").addEventListener("click", addLogbookPeriod);
$("#add-annual-odometer").addEventListener("click", addAnnualOdometerRecord);
$("#logbook-list").addEventListener("click", async (event) => {
  const id = event.target.dataset.deleteLogbook;
  if (!id || !confirm("Remove this logbook period? Existing trip records will not be deleted.")) return;
  const { error } = await db.from("logbook_periods").delete().eq("id", id);
  if (error) return alert(`Logbook period could not be removed: ${error.message}`);
  await loadLogbooks();
});
$("#annual-odometer-list").addEventListener("click", async (event) => {
  const id = event.target.dataset.deleteAnnualOdometer;
  if (!id || !confirm("Remove this financial-year odometer record?")) return;
  const { error } = await db.from("logbook_income_years").delete().eq("id", id);
  if (error) return alert(`Annual odometer record could not be removed: ${error.message}`);
  await loadAnnualOdometerRecords();
  render();
});
$("#saved-location-list").addEventListener("click", async (event) => {
  const id = event.target.dataset.deleteLocation;
  if (!id || !confirm("Remove this saved location? Existing trips will not be changed.")) return;
  const { error } = await db.from("saved_locations").delete().eq("id", id);
  if (error) return alert(`Location could not be removed: ${error.message}`);
  await loadSavedLocations();
});
$("#download-data").addEventListener("click", () => downloadJson(`travel-log-data-${new Date().toISOString().slice(0, 10)}.json`, { exported_at: new Date().toISOString(), profile: { account_id: currentUser.id, name: currentProfile?.full_name || currentUser.user_metadata?.full_name || null, email: currentUser.email, account_created_at: currentUser.created_at, appearance_theme: currentProfile?.appearance_theme || "system", recording_mode: activeRecordingMode(), privacy_version: currentProfile?.privacy_version || null, privacy_accepted_at: currentProfile?.privacy_accepted_at || null }, saved_locations: savedLocations, logbook_periods: logbookPeriods, logbook_income_years: annualOdometerRecords, trips }));
$("#delete-account").addEventListener("click", async () => {
  const password = $("#delete-password").value;
  if (!password) return alert("Enter your current password to confirm account deletion.");
  if ($("#delete-confirmation").value.trim() !== "DELETE") return alert("Type DELETE exactly to confirm permanent account deletion.");
  if (!confirm("Permanently delete your account and every saved trip? This cannot be undone.")) return;
  const button = $("#delete-account");
  setButtonBusy(button, true, "Confirming…");
  const { error: authenticationError } = await db.auth.signInWithPassword({ email: currentUser.email, password });
  $("#delete-password").value = "";
  if (authenticationError) {
    setButtonBusy(button, false);
    return alert("Password confirmation failed. Your account was not deleted.");
  }
  setButtonBusy(button, true, "Deleting…");
  const userId = currentUser.id;
  const { error } = await db.rpc("delete_my_account");
  setButtonBusy(button, false);
  if (error) return alert(`Your account could not be deleted: ${error.message}`);
  localStorage.removeItem(storageKey);
  localStorage.removeItem(`travel-log-migrated-${userId}`);
  accountDialog.close();
  await db.auth.signOut({ scope: "local" });
  showAuth();
  alert("Your account and saved trips have been permanently deleted.");
});

$("#privacy-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!$("#existing-privacy-consent").checked) return;
  const button = $("#accept-privacy");
  setButtonBusy(button, true, "Saving…");
  const { error } = await db.rpc("accept_privacy_notice", { notice_version: privacyVersion });
  setButtonBusy(button, false);
  if (error) return alert(`Your acknowledgement could not be saved: ${error.message}`);
  currentProfile = { ...currentProfile, privacy_version: privacyVersion, privacy_accepted_at: new Date().toISOString() };
  privacyDialog.close();
  privacyResolver?.(true);
  privacyResolver = null;
});
$("#privacy-sign-out").addEventListener("click", async () => {
  privacyDialog.close();
  privacyResolver?.(false);
  privacyResolver = null;
  await db.auth.signOut();
});
privacyDialog.addEventListener("cancel", (event) => event.preventDefault());
$("#retry-compatibility").addEventListener("click", async () => {
  if (!currentUser) return;
  const button = $("#retry-compatibility");
  setButtonBusy(button, true, "Checking…");
  await showApp(currentUser, true);
  setButtonBusy(button, false);
});
$("#compatibility-sign-out").addEventListener("click", async () => { await db.auth.signOut(); });
compatibilityDialog.addEventListener("cancel", (event) => event.preventDefault());
$("#new-trip-button").addEventListener("click", () => openForm());
$("#empty-add-button").addEventListener("click", () => openForm());
$("#close-button").addEventListener("click", () => dialog.close());
$("#cancel-button").addEventListener("click", () => dialog.close());
$("#search").addEventListener("input", render);
$("#filter-from").addEventListener("input", render);
$("#filter-to").addEventListener("input", render);
$("#filter-client").addEventListener("input", render);
$("#clear-filters").addEventListener("click", () => { $("#search").value = ""; $("#filter-from").value = ""; $("#filter-to").value = ""; $("#filter-client").value = ""; render(); });
$("#export-button").addEventListener("click", exportCsv);
$("#print-report").addEventListener("click", openPrintableReport);
$("#calculate-distance").addEventListener("click", calculateDistance);
attachAddressSuggestions($("#start-address"));
attachAddressSuggestions($("#end-address"));
$("#add-stop-button").addEventListener("click", () => addStop());
$("#trip-date").addEventListener("change", updateTripModeTip);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const saveButton = form.querySelector('button[type="submit"]');
  const id = $("#trip-id").value || crypto.randomUUID();
  const stops = [...document.querySelectorAll(".stop-address")].map((input) => input.value.trim()).filter(Boolean);
  const recordingMode = normalizeRecordingMode(form.dataset.recordingMode);
  const employerRate = Number($("#rate-cents").value || 0);
  const claimMethod = recordingMode === "general" ? (employerRate > 0 ? "employer" : "record_only") : recordingMode;
  const trip = { id, date: $("#trip-date").value, endDate: $("#trip-end-date").value, distance: Number($("#distance").value), purpose: $("#purpose").value, clientProject: $("#client-project").value.trim(), vehicle: $("#vehicle").value.trim(), vehicleRegistration: $("#vehicle-registration").value.trim().toUpperCase(), claimMethod, rateCents: claimMethod === "ato_cents" ? Number(atoRateForDate($("#trip-date").value) || 0) : (claimMethod === "employer" ? Number($("#rate-cents").value || 0) : 0), odometerStart: $("#odometer-start").value, odometerEnd: $("#odometer-end").value, start: $("#start-address").value.trim(), stops, end: $("#end-address").value.trim(), roundTrip: $("#round-trip").checked, notes: $("#notes").value.trim() };
  const validationError = validateTrip(trip);
  if (validationError) return alert(validationError);
  if (claimMethod === "ato_logbook" && !logbookPeriods.some((period) => period.vehicleRegistration.toUpperCase() === trip.vehicleRegistration.toUpperCase() && trip.date >= period.startDate && trip.endDate <= period.endDate)) return alert("Create a matching 12-week logbook period for this registration and journey dates in Account and privacy before saving an ATO logbook trip.");
  setButtonBusy(saveButton, true, "Saving…");
  const query = $("#trip-id").value ? db.from("trips").update(toDatabase(trip)).eq("id", id) : db.from("trips").insert(toDatabase(trip));
  const { error } = await query;
  setButtonBusy(saveButton, false);
  if (error) return alert(`Trip could not be saved: ${error.message}`);
  dialog.close();
  await loadTrips();
});

$("#trip-list").addEventListener("click", async (event) => {
  const id = event.target.dataset.edit || event.target.dataset.delete || event.target.dataset.duplicate;
  if (event.target.dataset.duplicate) openForm(trips.find((trip) => trip.id === id), true);
  if (event.target.dataset.edit) openForm(trips.find((trip) => trip.id === id));
  if (event.target.dataset.delete && confirm("Delete this trip?")) {
    const { error } = await db.from("trips").delete().eq("id", id);
    if (error) return alert(`Trip could not be deleted: ${error.message}`);
    await loadTrips();
  }
});

db.auth.onAuthStateChange((event, session) => {
  setTimeout(async () => {
    if (event === "PASSWORD_RECOVERY") {
      $("#reset-password-form").reset();
      $("#reset-password-message").textContent = "";
      resetPasswordDialog.showModal();
      return;
    }
    if (session?.user) await showApp(session.user); else showAuth();
  }, 0);
});

$("#reset-password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = $("#new-password").value;
  const confirmation = $("#confirm-password").value;
  const requirementError = passwordError(password);
  if (requirementError) { $("#reset-password-message").textContent = requirementError; return; }
  if (password !== confirmation) { $("#reset-password-message").textContent = "Passwords do not match."; return; }
  const button = $("#save-new-password");
  setButtonBusy(button, true, "Updating…");
  const { error } = await db.auth.updateUser({ password });
  setButtonBusy(button, false);
  if (error) { $("#reset-password-message").textContent = error.message; return; }
  resetPasswordDialog.close();
  alert("Your password has been updated.");
  const { data: { user } } = await db.auth.getUser();
  if (user) await showApp(user);
});
$("#cancel-password-reset").addEventListener("click", async () => { resetPasswordDialog.close(); await db.auth.signOut(); });
resetPasswordDialog.addEventListener("cancel", async (event) => { event.preventDefault(); resetPasswordDialog.close(); await db.auth.signOut(); });

setAuthMode("signin");
db.auth.getSession().then(({ data }) => data.session?.user ? showApp(data.session.user) : showAuth());
