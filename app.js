const storageKey = "travel-log-trips";
const supabaseUrl = "https://caqgnnlgtomcmkpafvoc.supabase.co";
const supabasePublishableKey = "sb_publishable_QH3nXDysJyTfg61qv_h98w_-SergW2w";
const distanceApiUrl = "https://travel-log-distance-api.jfsantana0691.workers.dev/distance";
const privacyVersion = "2026-08-20-ato-logbook";
const db = window.supabase.createClient(supabaseUrl, supabasePublishableKey);
const $ = (selector) => document.querySelector(selector);
const dialog = $("#trip-dialog");
const form = $("#trip-form");
const privacyDialog = $("#privacy-dialog");
const accountDialog = $("#account-dialog");
const resetPasswordDialog = $("#reset-password-dialog");
const { atoIncomeYear, atoRateForDate, claimAmount, claimSummary, csvCell, filterError, filterTrips: filterTripRecords, logbookSummary, totalDistance, validateLogbookPeriod, validateTrip } = TravelLogLogic;

let trips = [];
let savedLocations = [];
let logbookPeriods = [];
let currentUser = null;
let currentProfile = null;
let authMode = "signin";
let privacyResolver = null;

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
  return { id: row.id, vehicleRegistration: row.vehicle_registration, vehicleDescription: row.vehicle_description, engineCapacity: row.engine_capacity || "", startDate: row.start_date, endDate: row.end_date, openingOdometer: Number(row.opening_odometer), closingOdometer: Number(row.closing_odometer), incomeYearOpeningOdometer: row.income_year_opening_odometer === null ? "" : Number(row.income_year_opening_odometer), incomeYearClosingOdometer: row.income_year_closing_odometer === null ? "" : Number(row.income_year_closing_odometer) };
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
  const claims = claimSummary(matchingTrips);
  $("#trip-count").textContent = matchingTrips.length;
  $("#total-distance").textContent = formatKm(total);
  $("#month-distance").textContent = formatKm(monthTotal);
  $("#claim-total").textContent = formatMoney(claims.total);
  $("#ato-cap-message").textContent = claims.cappedKilometres ? `${formatKm(claims.cappedKilometres)} is above the ATO 5,000 km annual cap and has been excluded from the estimate.` : "ATO estimates are capped automatically in the summary.";
  $("#trip-label").textContent = matchingTrips.length === trips.length ? (trips.length === 1 ? "1 trip" : `${trips.length} trips`) : `${matchingTrips.length} of ${trips.length} trips`;
  $("#empty-state").hidden = trips.length > 0;
  $("#trip-list").innerHTML = matchingTrips.map((trip) => {
    const stops = trip.stops || [];
    const waypoints = stops.length ? `&waypoints=${encodeURIComponent(stops.join("|"))}` : "";
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(trip.start)}&destination=${encodeURIComponent(trip.end)}${waypoints}&travelmode=driving`;
    const workDetails = [trip.purpose, trip.clientProject, trip.vehicle, trip.vehicleRegistration].filter(Boolean).map(escapeHtml).join(" · ");
    const methodLabel = { record_only: "record only", employer: "employer reimbursement", ato_cents: `ATO ${atoIncomeYear(trip.date)} cents/km`, ato_logbook: "ATO logbook" }[trip.claimMethod] || "record only";
    const odometer = trip.odometerStart !== "" && trip.odometerEnd !== "" ? ` · odometer ${escapeHtml(trip.odometerStart)}–${escapeHtml(trip.odometerEnd)}` : "";
    const dates = trip.endDate && trip.endDate !== trip.date ? `${displayDate(trip.date)} – ${displayDate(trip.endDate)}` : displayDate(trip.date);
    return `<article class="trip"><div class="trip-date">${dates}</div><div><div class="route">${escapeHtml(trip.start)} <span>${stops.length ? `via ${stops.length} stop${stops.length === 1 ? "" : "s"} to ` : "to "}${escapeHtml(trip.end)}</span></div>${workDetails ? `<p class="trip-details">${workDetails}</p>` : ""}<p class="trip-details">${formatKm(totalDistance(trip))}${odometer} · ${methodLabel}${claimAmount(trip) ? ` · ${formatMoney(claimAmount(trip))} estimate` : ""}${trip.notes ? ` · ${escapeHtml(trip.notes)}` : ""}</p></div><div class="trip-actions"><a class="text-button" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Route</a><button class="text-button" data-duplicate="${trip.id}">Duplicate</button><button class="text-button" data-edit="${trip.id}">Edit</button><button class="text-button" data-delete="${trip.id}">Delete</button></div></article>`;
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
    const annual = period.incomeYearOpeningOdometer !== "" && period.incomeYearClosingOdometer !== "" ? ` · income-year odometer ${period.incomeYearOpeningOdometer}–${period.incomeYearClosingOdometer}` : " · add 1 July and 30 June readings when available";
    return `<div class="saved-location"><div><strong>${escapeHtml(period.vehicleRegistration)} · ${escapeHtml(period.vehicleDescription)}</strong><span>${displayDate(period.startDate)} – ${displayDate(period.endDate)} · ${formatKm(summary.businessKilometres)} work / ${formatKm(summary.totalKilometres)} total · ${summary.businessUsePercent.toFixed(1)}% business use${annual}${warning}</span></div><button type="button" class="text-button" data-delete-logbook="${period.id}">Remove</button></div>`;
  }).join("") : `<p>No ATO logbook periods yet.</p>`;
}

async function loadLogbooks() {
  const { data, error } = await db.from("logbook_periods").select("*").order("start_date", { ascending: false });
  if (error) throw error;
  logbookPeriods = (data || []).map(fromLogbookDatabase);
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
  const { data, error } = await db.from("profiles").select("id, full_name, privacy_version, privacy_accepted_at, appearance_theme").eq("id", currentUser.id).single();
  if (error) throw new Error(`Privacy settings could not be loaded. ${error.message}`);
  currentProfile = data;
  applyTheme(data.appearance_theme);
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

async function showApp(user) {
  if (currentUser?.id === user.id && $("#auth-view").hidden) return;
  currentUser = user;
  $("#auth-view").hidden = true;
  $("#app-view").hidden = false;
  $("#account-actions").hidden = false;
  $("#account-name").textContent = user.user_metadata?.full_name || user.email;
  try {
    const accepted = await ensurePrivacyAccepted();
    if (!accepted) return;
    await Promise.all([loadTrips(), loadSavedLocations(), loadLogbooks()]);
    renderLogbooks();
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
  $("#auth-view").hidden = false;
  $("#app-view").hidden = true;
  $("#account-actions").hidden = true;
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
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "text-button";
  remove.textContent = "Remove";
  remove.addEventListener("click", () => row.remove());
  row.append(input, remove);
  $("#stops-list").append(row);
}

function updateClaimMethod() {
  const method = $("#claim-method").value;
  const atoRate = atoRateForDate($("#trip-date").value);
  $("#rate-field").hidden = method !== "employer";
  if (method === "ato_cents") $("#claim-tip").textContent = atoRate ? `ATO estimate: ${atoRate}¢/km for ${atoIncomeYear($("#trip-date").value)}, capped at 5,000 work km per car for the income year.` : "No ATO cents-per-kilometre rate is configured for this date.";
  else if (method === "ato_logbook") $("#claim-tip").textContent = "ATO logbook records require registration, purpose, and starting and ending odometer readings. Actual expenses are calculated separately using the business-use percentage.";
  else if (method === "employer") $("#claim-tip").textContent = "Enter the reimbursement rate set by your employer. This is separate from an ATO deduction estimate.";
  else $("#claim-tip").textContent = "This trip will be recorded without calculating a reimbursement or ATO claim estimate.";
}

function openForm(trip, duplicate = false) {
  form.reset();
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
  updateClaimMethod();
  dialog.showModal();
}

function exportCsv() {
  const rangeError = filterError($("#filter-from").value, $("#filter-to").value);
  if (rangeError) return alert(rangeError);
  const reportTrips = filteredTrips();
  if (!reportTrips.length) return alert("No trips match the current filters.");
  const header = ["Journey starts", "Journey ends", "Purpose", "Client or project", "Vehicle", "Registration", "Claim method", "Start address", "Stops", "End address", "Route estimate (km)", "Round trip", "Starting odometer", "Ending odometer", "Recorded total distance (km)", "Rate (cents/km)", "Trip estimate before annual cap (AUD)", "Notes"];
  const rows = reportTrips.map((trip) => [trip.date, trip.endDate || trip.date, trip.purpose, trip.clientProject, trip.vehicle, trip.vehicleRegistration, trip.claimMethod, trip.start, (trip.stops || []).join(" → "), trip.end, trip.distance, trip.roundTrip ? "Yes" : "No", trip.odometerStart, trip.odometerEnd, totalDistance(trip), trip.claimMethod === "ato_cents" ? atoRateForDate(trip.date) : (trip.rateCents || ""), claimAmount(trip).toFixed(2), trip.notes]);
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  downloadBlob("travel-log-report.csv", new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

function openPrintableReport() {
  const rangeError = filterError($("#filter-from").value, $("#filter-to").value);
  if (rangeError) return alert(rangeError);
  const reportTrips = filteredTrips();
  if (!reportTrips.length) return alert("No trips match the current filters.");
  const payload = { generatedAt: new Date().toISOString(), user: { name: currentProfile?.full_name || currentUser.user_metadata?.full_name || "", email: currentUser.email }, filters: { from: $("#filter-from").value, to: $("#filter-to").value, client: $("#filter-client").value.trim(), search: $("#search").value.trim() }, trips: reportTrips, claimSummary: claimSummary(reportTrips) };
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
  $("#appearance-theme").value = window.TravelLogTheme.normalize(currentProfile?.appearance_theme);
  $("#appearance-message").textContent = "";
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
  const period = { vehicleRegistration: $("#logbook-registration").value.trim().toUpperCase(), vehicleDescription: $("#logbook-vehicle").value.trim(), engineCapacity: $("#logbook-engine").value.trim(), startDate: $("#logbook-start-date").value, endDate: $("#logbook-end-date").value, openingOdometer: $("#logbook-opening").value, closingOdometer: $("#logbook-closing").value, incomeYearOpeningOdometer: $("#logbook-year-opening").value, incomeYearClosingOdometer: $("#logbook-year-closing").value };
  const validationError = validateLogbookPeriod(period);
  if (validationError) return alert(validationError);
  if (period.incomeYearOpeningOdometer !== "" && period.incomeYearClosingOdometer !== "" && Number(period.incomeYearClosingOdometer) < Number(period.incomeYearOpeningOdometer)) return alert("The income-year closing odometer cannot be below the opening odometer.");
  const button = $("#add-logbook");
  setButtonBusy(button, true, "Saving…");
  const { error } = await db.from("logbook_periods").upsert({ user_id: currentUser.id, vehicle_registration: period.vehicleRegistration, vehicle_description: period.vehicleDescription, engine_capacity: period.engineCapacity || null, start_date: period.startDate, end_date: period.endDate, opening_odometer: Number(period.openingOdometer), closing_odometer: Number(period.closingOdometer), income_year_opening_odometer: period.incomeYearOpeningOdometer === "" ? null : Number(period.incomeYearOpeningOdometer), income_year_closing_odometer: period.incomeYearClosingOdometer === "" ? null : Number(period.incomeYearClosingOdometer) }, { onConflict: "user_id,vehicle_registration,start_date" });
  setButtonBusy(button, false);
  if (error) return alert(`Logbook period could not be saved: ${error.message}`);
  for (const id of ["logbook-registration", "logbook-vehicle", "logbook-engine", "logbook-start-date", "logbook-end-date", "logbook-opening", "logbook-closing", "logbook-year-opening", "logbook-year-closing"]) $(`#${id}`).value = "";
  await loadLogbooks();
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
    const response = await fetch(distanceApiUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ start, stops, end }) });
    const data = await response.json();
    if (!response.ok || typeof data.distanceKm !== "number") throw new Error(data.error || "Could not calculate this route.");
    $("#distance").value = data.distanceKm.toFixed(1);
    $("#route-tip").textContent = "Distance calculated using the shared route service. Review it before saving.";
  } catch (error) { alert(error.message || "Distance lookup failed. Check the addresses, then try again."); }
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
$("#close-account").addEventListener("click", () => accountDialog.close());
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
$("#logbook-list").addEventListener("click", async (event) => {
  const id = event.target.dataset.deleteLogbook;
  if (!id || !confirm("Remove this logbook period? Existing trip records will not be deleted.")) return;
  const { error } = await db.from("logbook_periods").delete().eq("id", id);
  if (error) return alert(`Logbook period could not be removed: ${error.message}`);
  await loadLogbooks();
});
$("#saved-location-list").addEventListener("click", async (event) => {
  const id = event.target.dataset.deleteLocation;
  if (!id || !confirm("Remove this saved location? Existing trips will not be changed.")) return;
  const { error } = await db.from("saved_locations").delete().eq("id", id);
  if (error) return alert(`Location could not be removed: ${error.message}`);
  await loadSavedLocations();
});
$("#download-data").addEventListener("click", () => downloadJson(`travel-log-data-${new Date().toISOString().slice(0, 10)}.json`, { exported_at: new Date().toISOString(), profile: { account_id: currentUser.id, name: currentProfile?.full_name || currentUser.user_metadata?.full_name || null, email: currentUser.email, account_created_at: currentUser.created_at, appearance_theme: currentProfile?.appearance_theme || "system", privacy_version: currentProfile?.privacy_version || null, privacy_accepted_at: currentProfile?.privacy_accepted_at || null }, saved_locations: savedLocations, logbook_periods: logbookPeriods, trips }));
$("#delete-account").addEventListener("click", async () => {
  if ($("#delete-confirmation").value.trim() !== "DELETE") return alert("Type DELETE exactly to confirm permanent account deletion.");
  if (!confirm("Permanently delete your account and every saved trip? This cannot be undone.")) return;
  const button = $("#delete-account");
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
$("#add-stop-button").addEventListener("click", () => addStop());
$("#claim-method").addEventListener("change", updateClaimMethod);
$("#trip-date").addEventListener("change", updateClaimMethod);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const saveButton = form.querySelector('button[type="submit"]');
  const id = $("#trip-id").value || crypto.randomUUID();
  const stops = [...document.querySelectorAll(".stop-address")].map((input) => input.value.trim()).filter(Boolean);
  const claimMethod = $("#claim-method").value;
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
