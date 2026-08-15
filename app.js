const storageKey = "travel-log-trips";
const orsKeyStorageKey = "travel-log-openrouteservice-key";
const $ = (selector) => document.querySelector(selector);
const dialog = $("#trip-dialog");
const settingsDialog = $("#settings-dialog");
const form = $("#trip-form");

let trips = JSON.parse(localStorage.getItem(storageKey) || "[]");

function saveTrips() { localStorage.setItem(storageKey, JSON.stringify(trips)); }
function totalDistance(trip) { return Number(trip.distance) * (trip.roundTrip ? 2 : 1); }
function formatKm(value) { return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} km`; }
function displayDate(value) { return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
function escapeHtml(value) { const node = document.createElement("span"); node.textContent = value; return node.innerHTML; }

function render() {
  const query = $("#search").value.toLowerCase().trim();
  const matchingTrips = trips.filter((trip) => `${trip.start} ${trip.end} ${trip.notes}`.toLowerCase().includes(query));
  const total = trips.reduce((sum, trip) => sum + totalDistance(trip), 0);
  const today = new Date();
  const monthTotal = trips.filter((trip) => { const date = new Date(`${trip.date}T00:00:00`); return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear(); }).reduce((sum, trip) => sum + totalDistance(trip), 0);
  $("#trip-count").textContent = trips.length;
  $("#total-distance").textContent = formatKm(total);
  $("#month-distance").textContent = formatKm(monthTotal);
  $("#trip-label").textContent = trips.length === 1 ? "1 trip" : `${trips.length} trips`;
  $("#empty-state").hidden = trips.length > 0;
  $("#trip-list").innerHTML = matchingTrips.map((trip) => {
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(trip.start)}&destination=${encodeURIComponent(trip.end)}&travelmode=driving`;
    return `<article class="trip"><div class="trip-date">${displayDate(trip.date)}</div><div><div class="route">${escapeHtml(trip.start)} <span>to ${escapeHtml(trip.end)}</span></div><p class="trip-details">${formatKm(totalDistance(trip))}${trip.roundTrip ? " · round trip" : " · one way"}${trip.notes ? ` · ${escapeHtml(trip.notes)}` : ""}</p></div><div class="trip-actions"><a class="text-button" href="${mapsUrl}" target="_blank" rel="noopener">Route</a><button class="text-button" data-edit="${trip.id}">Edit</button><button class="text-button" data-delete="${trip.id}">Delete</button></div></article>`;
  }).join("");
}

function openForm(trip) {
  form.reset();
  $("#form-title").textContent = trip ? "Edit trip" : "Add a trip";
  $("#trip-id").value = trip?.id || "";
  $("#trip-date").value = trip?.date || new Date().toISOString().slice(0, 10);
  $("#distance").value = trip?.distance || "";
  $("#start-address").value = trip?.start || "";
  $("#end-address").value = trip?.end || "";
  $("#round-trip").checked = trip?.roundTrip || false;
  $("#notes").value = trip?.notes || "";
  dialog.showModal();
}

function csvCell(value) { return `"${String(value).replaceAll('"', '""')}"`; }
function exportCsv() {
  if (!trips.length) return alert("Add at least one trip before exporting.");
  const header = ["Date", "Start address", "End address", "One-way distance (km)", "Round trip", "Total distance (km)", "Notes"];
  const rows = trips.map((trip) => [trip.date, trip.start, trip.end, trip.distance, trip.roundTrip ? "Yes" : "No", totalDistance(trip), trip.notes]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = "travel-log-report.csv"; link.click(); URL.revokeObjectURL(link.href);
}

async function geocode(address, apiKey) {
  const response = await fetch(`https://api.openrouteservice.org/geocode/search?text=${encodeURIComponent(address)}&size=1`, { headers: { Authorization: apiKey } });
  const data = await response.json();
  if (!response.ok || !data.features?.length) throw new Error(`Address not found: ${address}`);
  return data.features[0].geometry.coordinates;
}

async function calculateDistance() {
  const apiKey = localStorage.getItem(orsKeyStorageKey);
  const start = $("#start-address").value.trim();
  const end = $("#end-address").value.trim();
  if (!apiKey) { settingsDialog.showModal(); return; }
  if (!start || !end) { alert("Enter both addresses first."); return; }
  const button = $("#calculate-distance");
  button.disabled = true; button.textContent = "Calculating…";
  try {
    const [startPoint, endPoint] = await Promise.all([geocode(start, apiKey), geocode(end, apiKey)]);
    const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", { method: "POST", headers: { Authorization: apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ coordinates: [startPoint, endPoint] }) });
    const data = await response.json();
    if (!response.ok || !data.routes?.[0]) throw new Error(data.error?.message || "Could not calculate this route.");
    $("#distance").value = (data.routes[0].summary.distance / 1000).toFixed(1);
    $("#route-tip").textContent = "Distance calculated using OpenRouteService road data. Review it before saving.";
  } catch (error) { alert(error.message || "Distance lookup failed. Check your key and addresses, then try again."); }
  finally { button.disabled = false; button.textContent = "Calculate"; }
}

$("#new-trip-button").addEventListener("click", () => openForm());
$("#settings-button").addEventListener("click", () => { $("#ors-key").value = localStorage.getItem(orsKeyStorageKey) || ""; settingsDialog.showModal(); });
$("#empty-add-button").addEventListener("click", () => openForm());
$("#close-button").addEventListener("click", () => dialog.close());
$("#cancel-button").addEventListener("click", () => dialog.close());
$("#search").addEventListener("input", render);
$("#export-button").addEventListener("click", exportCsv);
$("#calculate-distance").addEventListener("click", calculateDistance);
$("#close-settings-button").addEventListener("click", () => settingsDialog.close());
$("#clear-key-button").addEventListener("click", () => { localStorage.removeItem(orsKeyStorageKey); $("#ors-key").value = ""; settingsDialog.close(); });
$("#settings-form").addEventListener("submit", (event) => { event.preventDefault(); const key = $("#ors-key").value.trim(); if (key) localStorage.setItem(orsKeyStorageKey, key); else localStorage.removeItem(orsKeyStorageKey); settingsDialog.close(); });
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = $("#trip-id").value;
  const trip = { id: id || crypto.randomUUID(), date: $("#trip-date").value, distance: $("#distance").value, start: $("#start-address").value.trim(), end: $("#end-address").value.trim(), roundTrip: $("#round-trip").checked, notes: $("#notes").value.trim() };
  trips = id ? trips.map((item) => item.id === id ? trip : item) : [trip, ...trips];
  saveTrips(); dialog.close(); render();
});
$("#trip-list").addEventListener("click", (event) => {
  const id = event.target.dataset.edit || event.target.dataset.delete;
  if (event.target.dataset.edit) openForm(trips.find((trip) => trip.id === id));
  if (event.target.dataset.delete && confirm("Delete this trip?")) { trips = trips.filter((trip) => trip.id !== id); saveTrips(); render(); }
});
render();
