const storageKey = "travel-log-trips";
const supabaseUrl = "https://caqgnnlgtomcmkpafvoc.supabase.co";
const supabasePublishableKey = "sb_publishable_QH3nXDysJyTfg61qv_h98w_-SergW2w";
const distanceApiUrl = "https://travel-log-distance-api.jfsantana0691.workers.dev/distance";
const db = window.supabase.createClient(supabaseUrl, supabasePublishableKey);
const $ = (selector) => document.querySelector(selector);
const dialog = $("#trip-dialog");
const form = $("#trip-form");

let trips = [];
let currentUser = null;
let authMode = "signin";

function totalDistance(trip) { return Number(trip.distance) * (trip.roundTrip ? 2 : 1); }
function formatKm(value) { return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} km`; }
function displayDate(value) { return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
function escapeHtml(value) { const node = document.createElement("span"); node.textContent = value; return node.innerHTML; }
function setMessage(message, isError = false) { const element = $("#auth-message"); element.textContent = message; element.classList.toggle("error", isError); }
function setButtonBusy(button, busy, busyText) { if (!button.dataset.label) button.dataset.label = button.textContent; button.disabled = busy; button.textContent = busy ? busyText : button.dataset.label; }

function fromDatabase(row) {
  return { id: row.id, date: row.trip_date, start: row.start_address, stops: row.stops || [], end: row.end_address, distance: Number(row.distance_km), roundTrip: row.round_trip, notes: row.notes || "" };
}

function toDatabase(trip) {
  return { id: trip.id, user_id: currentUser.id, trip_date: trip.date, start_address: trip.start, stops: trip.stops || [], end_address: trip.end, distance_km: Number(trip.distance), round_trip: trip.roundTrip, notes: trip.notes };
}

function render() {
  const query = $("#search").value.toLowerCase().trim();
  const matchingTrips = trips.filter((trip) => `${trip.start} ${(trip.stops || []).join(" ")} ${trip.end} ${trip.notes}`.toLowerCase().includes(query));
  const total = trips.reduce((sum, trip) => sum + totalDistance(trip), 0);
  const today = new Date();
  const monthTotal = trips.filter((trip) => { const date = new Date(`${trip.date}T00:00:00`); return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear(); }).reduce((sum, trip) => sum + totalDistance(trip), 0);
  $("#trip-count").textContent = trips.length;
  $("#total-distance").textContent = formatKm(total);
  $("#month-distance").textContent = formatKm(monthTotal);
  $("#trip-label").textContent = trips.length === 1 ? "1 trip" : `${trips.length} trips`;
  $("#empty-state").hidden = trips.length > 0;
  $("#trip-list").innerHTML = matchingTrips.map((trip) => {
    const stops = trip.stops || [];
    const waypoints = stops.length ? `&waypoints=${encodeURIComponent(stops.join("|"))}` : "";
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(trip.start)}&destination=${encodeURIComponent(trip.end)}${waypoints}&travelmode=driving`;
    return `<article class="trip"><div class="trip-date">${displayDate(trip.date)}</div><div><div class="route">${escapeHtml(trip.start)} <span>${stops.length ? `via ${stops.length} stop${stops.length === 1 ? "" : "s"} to ` : "to "}${escapeHtml(trip.end)}</span></div><p class="trip-details">${formatKm(totalDistance(trip))}${trip.roundTrip ? " · round trip" : " · one way"}${trip.notes ? ` · ${escapeHtml(trip.notes)}` : ""}</p></div><div class="trip-actions"><a class="text-button" href="${mapsUrl}" target="_blank" rel="noopener">Route</a><button class="text-button" data-edit="${trip.id}">Edit</button><button class="text-button" data-delete="${trip.id}">Delete</button></div></article>`;
  }).join("");
}

async function loadTrips() {
  const { data, error } = await db.from("trips").select("*").order("trip_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  trips = data.map(fromDatabase);
  render();
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

async function showApp(user) {
  currentUser = user;
  $("#auth-view").hidden = true;
  $("#app-view").hidden = false;
  $("#account-actions").hidden = false;
  $("#account-name").textContent = user.user_metadata?.full_name || user.email;
  try { await loadTrips(); await migrateLocalTrips(); }
  catch (error) { alert(`Trips could not be loaded: ${error.message}`); }
}

function showAuth() {
  currentUser = null;
  trips = [];
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
  $("#auth-submit").textContent = signingUp ? "Create account" : "Sign in";
  $("#auth-submit").dataset.label = $("#auth-submit").textContent;
  $("#toggle-auth-mode").textContent = signingUp ? "Already have an account? Sign in" : "Create an account";
  $("#forgot-password").hidden = signingUp;
  setMessage("");
}

function addStop(value = "") {
  const row = document.createElement("div");
  row.className = "stop-row";
  const input = document.createElement("input");
  input.className = "stop-address";
  input.type = "text";
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

function openForm(trip) {
  form.reset();
  $("#form-title").textContent = trip ? "Edit trip" : "Add a trip";
  $("#trip-id").value = trip?.id || "";
  $("#trip-date").value = trip?.date || new Date().toISOString().slice(0, 10);
  $("#distance").value = trip?.distance || "";
  $("#start-address").value = trip?.start || "";
  $("#stops-list").replaceChildren();
  (trip?.stops || []).forEach(addStop);
  $("#end-address").value = trip?.end || "";
  $("#round-trip").checked = trip?.roundTrip || false;
  $("#notes").value = trip?.notes || "";
  dialog.showModal();
}

function csvCell(value) { return `"${String(value).replaceAll('"', '""')}"`; }
function exportCsv() {
  if (!trips.length) return alert("Add at least one trip before exporting.");
  const header = ["Date", "Start address", "Stops", "End address", "One-way distance (km)", "Round trip", "Total distance (km)", "Notes"];
  const rows = trips.map((trip) => [trip.date, trip.start, (trip.stops || []).join(" → "), trip.end, trip.distance, trip.roundTrip ? "Yes" : "No", totalDistance(trip), trip.notes]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = "travel-log-report.csv"; link.click(); URL.revokeObjectURL(link.href);
}

async function calculateDistance() {
  const start = $("#start-address").value.trim();
  const end = $("#end-address").value.trim();
  const stops = [...document.querySelectorAll(".stop-address")].map((input) => input.value.trim()).filter(Boolean);
  if (!start || !end) { alert("Enter both addresses first."); return; }
  const button = $("#calculate-distance");
  setButtonBusy(button, true, "Calculating…");
  try {
    const response = await fetch(distanceApiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start, stops, end }) });
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
  setButtonBusy(button, true, authMode === "signup" ? "Creating…" : "Signing in…");
  setMessage("");
  try {
    if (authMode === "signup") {
      const redirectTo = location.href.split("#")[0].split("?")[0];
      const { data, error } = await db.auth.signUp({ email, password, options: { data: { full_name: $("#full-name").value.trim() }, emailRedirectTo: redirectTo } });
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
$("#new-trip-button").addEventListener("click", () => openForm());
$("#empty-add-button").addEventListener("click", () => openForm());
$("#close-button").addEventListener("click", () => dialog.close());
$("#cancel-button").addEventListener("click", () => dialog.close());
$("#search").addEventListener("input", render);
$("#export-button").addEventListener("click", exportCsv);
$("#calculate-distance").addEventListener("click", calculateDistance);
$("#add-stop-button").addEventListener("click", () => addStop());

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const saveButton = form.querySelector('button[type="submit"]');
  const id = $("#trip-id").value || crypto.randomUUID();
  const stops = [...document.querySelectorAll(".stop-address")].map((input) => input.value.trim()).filter(Boolean);
  const trip = { id, date: $("#trip-date").value, distance: Number($("#distance").value), start: $("#start-address").value.trim(), stops, end: $("#end-address").value.trim(), roundTrip: $("#round-trip").checked, notes: $("#notes").value.trim() };
  setButtonBusy(saveButton, true, "Saving…");
  const query = $("#trip-id").value ? db.from("trips").update(toDatabase(trip)).eq("id", id) : db.from("trips").insert(toDatabase(trip));
  const { error } = await query;
  setButtonBusy(saveButton, false);
  if (error) return alert(`Trip could not be saved: ${error.message}`);
  dialog.close();
  await loadTrips();
});

$("#trip-list").addEventListener("click", async (event) => {
  const id = event.target.dataset.edit || event.target.dataset.delete;
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
      const password = prompt("Enter a new password (at least 6 characters):");
      if (password) {
        const { error } = await db.auth.updateUser({ password });
        alert(error ? error.message : "Your password has been updated.");
      }
    }
    if (session?.user) await showApp(session.user); else showAuth();
  }, 0);
});

setAuthMode("signin");
db.auth.getSession().then(({ data }) => data.session?.user ? showApp(data.session.user) : showAuth());
