const assert = require("node:assert/strict");
const test = require("node:test");
const { randomBytes, randomUUID } = require("node:crypto");

const productionProjectRef = "caqgnnlgtomcmkpafvoc";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for tenant-isolation integration tests.`);
  return value;
}

function loadSafeConfiguration() {
  if (required("TRAVEL_LOG_TEST_ENVIRONMENT") !== "staging") {
    throw new Error("TRAVEL_LOG_TEST_ENVIRONMENT must be exactly staging.");
  }
  const projectRef = required("TRAVEL_LOG_TEST_SUPABASE_PROJECT_REF");
  const rawUrl = required("TRAVEL_LOG_TEST_SUPABASE_URL");
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error("TRAVEL_LOG_TEST_SUPABASE_URL must be a valid URL."); }
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || !url.hostname.endsWith(".supabase.co")) {
    throw new Error("TRAVEL_LOG_TEST_SUPABASE_URL must be an HTTPS Supabase project root URL.");
  }
  if (url.hostname !== `${projectRef}.supabase.co`) throw new Error("The expected test project reference does not match the Supabase URL.");
  if (projectRef === productionProjectRef) throw new Error("Tenant-isolation tests refuse to target the production Supabase project.");

  const publishableKey = required("TRAVEL_LOG_TEST_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = required("TRAVEL_LOG_TEST_SUPABASE_SERVICE_ROLE_KEY");
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) throw new Error("A Supabase publishable key is required for authenticated assertions.");
  if (serviceRoleKey === publishableKey || /^sb_publishable_/.test(serviceRoleKey)) throw new Error("The setup key must be a privileged non-publishable key.");
  return { baseUrl: url.origin, publishableKey, serviceRoleKey };
}

const config = loadSafeConfiguration();

async function request(path, { method = "GET", key, token = key, body, prefer } = {}) {
  const headers = { apikey: key, Authorization: `Bearer ${token}`, Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${config.baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  return { ok: response.ok, status: response.status, data };
}

function safeFailure(label, response) {
  const code = response.data && typeof response.data === "object" ? response.data.code : undefined;
  return `${label} failed (HTTP ${response.status}${code ? `, code ${code}` : ""}).`;
}

function assertOk(response, label) {
  assert.equal(response.ok, true, safeFailure(label, response));
}

function assertDenied(response, label) {
  assert.equal(response.ok, false, `${label} unexpectedly succeeded.`);
  assert.ok([400, 401, 403, 404, 409, 422].includes(response.status), `${label} returned unexpected HTTP ${response.status}.`);
}

function rowPath(table, id) {
  return `/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*`;
}

async function selectRow(actor, table, id) {
  return request(rowPath(table, id), { key: config.publishableKey, token: actor.accessToken });
}

async function insertRow(actor, table, row) {
  return request(`/rest/v1/${table}?select=*`, { method: "POST", key: config.publishableKey, token: actor.accessToken, body: row, prefer: "return=representation" });
}

async function updateRow(actor, table, id, changes) {
  return request(rowPath(table, id), { method: "PATCH", key: config.publishableKey, token: actor.accessToken, body: changes, prefer: "return=representation" });
}

async function deleteRow(actor, table, id) {
  return request(rowPath(table, id), { method: "DELETE", key: config.publishableKey, token: actor.accessToken, prefer: "return=representation" });
}

async function rpc(actor, name, body = {}) {
  return request(`/rest/v1/rpc/${name}`, { method: "POST", key: config.publishableKey, token: actor.accessToken, body });
}

async function createSyntheticUser(label, runId) {
  const email = `travel-log-${label}-${runId}@example.invalid`;
  const password = `T1!${randomBytes(24).toString("base64url")}aA9`;
  const created = await request("/auth/v1/admin/users", {
    method: "POST",
    key: config.serviceRoleKey,
    body: { email, password, email_confirm: true, user_metadata: { full_name: `Tenant test ${label}` } },
  });
  assertOk(created, `Create synthetic User ${label}`);
  assert.ok(created.data?.id, `Create synthetic User ${label} did not return an ID.`);

  const signedIn = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    key: config.publishableKey,
    body: { email, password },
  });
  assertOk(signedIn, `Authenticate synthetic User ${label}`);
  assert.ok(signedIn.data?.access_token, `Authenticate synthetic User ${label} did not return a token.`);
  return { id: created.data.id, accessToken: signedIn.data.access_token };
}

async function deleteSyntheticUser(id) {
  if (!id) return;
  const response = await request(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: "DELETE", key: config.serviceRoleKey });
  if (!response.ok && response.status !== 404) throw new Error(safeFailure("Clean up synthetic user", response));
}

function makeFixtures(runId, userA, userB) {
  const trip = (owner, suffix) => ({ id: randomUUID(), user_id: owner.id, trip_date: "2026-09-01", trip_end_date: "2026-09-01", start_address: `${runId} ${suffix} start`, stops: [], end_address: `${runId} ${suffix} end`, distance_km: 12.3, round_trip: false, notes: "synthetic tenant-isolation test", claim_method: "record_only", rate_cents: 0 });
  const location = (owner, suffix) => ({ id: randomUUID(), user_id: owner.id, label: `${runId}-${suffix}`, address: `${runId} ${suffix} synthetic address` });
  const logbook = (owner, suffix) => ({ id: randomUUID(), user_id: owner.id, vehicle_registration: `${suffix}${runId.slice(-6)}`.slice(0, 20), vehicle_description: `${suffix} synthetic vehicle`, start_date: "2026-01-01", end_date: "2026-03-25", opening_odometer: 1000, closing_odometer: 2500 });
  const annual = (owner, logbookId, suffix, year = 2025) => ({ id: randomUUID(), user_id: owner.id, logbook_period_id: logbookId, vehicle_registration: `${suffix}${runId.slice(-6)}`.slice(0, 20), income_year_start: year, opening_odometer: 1000, closing_odometer: 5000, circumstances_changed: false, notes: "synthetic tenant-isolation test" });
  return { trip, location, logbook, annual };
}

async function verifyOwnedTable(t, { table, userA, userB, rowA, rowB, deleteRowA, ownUpdate, changedField }) {
  await t.test(`${table}: User A and User B can insert their own rows`, async () => {
    const [a, b] = await Promise.all([insertRow(userA, table, rowA), insertRow(userB, table, rowB)]);
    assertOk(a, `${table} User A own insert`);
    assertOk(b, `${table} User B own insert`);
    assert.equal(a.data?.[0]?.user_id, userA.id);
    assert.equal(b.data?.[0]?.user_id, userB.id);
  });
  await t.test(`${table}: both users can read only their own rows`, async () => {
    const [aOwn, bOwn, aReadsB, bReadsA] = await Promise.all([
      selectRow(userA, table, rowA.id), selectRow(userB, table, rowB.id),
      selectRow(userA, table, rowB.id), selectRow(userB, table, rowA.id),
    ]);
    assertOk(aOwn, `${table} User A own select`);
    assertOk(bOwn, `${table} User B own select`);
    assert.equal(aOwn.data?.length, 1);
    assert.equal(bOwn.data?.length, 1);
    assert.deepEqual(aReadsB.data, []);
    assert.deepEqual(bReadsA.data, []);
  });
  await t.test(`${table}: neither user can insert a row owned by the other`, async () => {
    const aSpoof = { ...rowA, id: randomUUID(), user_id: userB.id };
    const bSpoof = { ...rowB, id: randomUUID(), user_id: userA.id };
    assertDenied(await insertRow(userA, table, aSpoof), `${table} User A spoofed insert`);
    assertDenied(await insertRow(userB, table, bSpoof), `${table} User B spoofed insert`);
  });
  await t.test(`${table}: User A can update their own row`, async () => {
    const response = await updateRow(userA, table, rowA.id, ownUpdate);
    assertOk(response, `${table} User A own update`);
    assert.equal(response.data?.[0]?.[changedField], ownUpdate[changedField]);
  });
  await t.test(`${table}: User B cannot update User A's row`, async () => {
    const response = await updateRow(userB, table, rowA.id, ownUpdate);
    assertOk(response, `${table} cross-user update request`);
    assert.deepEqual(response.data, []);
  });
  await t.test(`${table}: User A cannot reassign ownership to User B`, async () => {
    assertDenied(await updateRow(userA, table, rowA.id, { user_id: userB.id }), `${table} ownership reassignment`);
  });
  await t.test(`${table}: User B cannot delete User A's row`, async () => {
    const denied = await deleteRow(userB, table, rowA.id);
    assertOk(denied, `${table} cross-user delete request`);
    assert.deepEqual(denied.data, []);
    const stillThere = await selectRow(userA, table, rowA.id);
    assert.equal(stillThere.data?.length, 1);
  });
  await t.test(`${table}: User A can delete their own dedicated row`, async () => {
    assertOk(await insertRow(userA, table, deleteRowA), `${table} delete fixture insert`);
    const deleted = await deleteRow(userA, table, deleteRowA.id);
    assertOk(deleted, `${table} own delete`);
    assert.equal(deleted.data?.length, 1);
  });
}

test("live Supabase tenant isolation for the current Travel Log schema", { timeout: 120000 }, async (t) => {
  const runId = `${Date.now()}-${randomBytes(5).toString("hex")}`;
  let userA;
  let userB;
  try {
    userA = await createSyntheticUser("a", runId);
    userB = await createSyntheticUser("b", runId);
    const f = makeFixtures(runId, userA, userB);

    await t.test("profiles: users can read only their own profile", async () => {
      const [aOwn, bOwn, aReadsB, bReadsA] = await Promise.all([
        selectRow(userA, "profiles", userA.id), selectRow(userB, "profiles", userB.id),
        selectRow(userA, "profiles", userB.id), selectRow(userB, "profiles", userA.id),
      ]);
      assert.equal(aOwn.data?.length, 1);
      assert.equal(bOwn.data?.length, 1);
      assert.deepEqual(aReadsB.data, []);
      assert.deepEqual(bReadsA.data, []);
    });
    await t.test("profiles: users can update only their own settings", async () => {
      const own = await updateRow(userA, "profiles", userA.id, { appearance_theme: "dark", recording_mode: "general" });
      assertOk(own, "Profile own update");
      assert.equal(own.data?.[0]?.appearance_theme, "dark");
      const cross = await updateRow(userB, "profiles", userA.id, { appearance_theme: "light" });
      assertOk(cross, "Profile cross-user update request");
      assert.deepEqual(cross.data, []);
    });
    await t.test("profiles: primary-key ownership cannot be reassigned", async () => {
      assertDenied(await updateRow(userA, "profiles", userA.id, { id: userB.id }), "Profile ownership reassignment");
    });
    await t.test("profiles: direct deletion is denied and leaves RPC deletion authoritative", async () => {
      const response = await deleteRow(userA, "profiles", userA.id);
      assertOk(response, "Profile direct delete request");
      assert.deepEqual(response.data, []);
      assert.equal((await selectRow(userA, "profiles", userA.id)).data?.length, 1);
    });

    const tripA = f.trip(userA, "a-main");
    const tripB = f.trip(userB, "b-main");
    await verifyOwnedTable(t, { table: "trips", userA, userB, rowA: tripA, rowB: tripB, deleteRowA: f.trip(userA, "a-delete"), ownUpdate: { notes: "User A updated synthetic trip" }, changedField: "notes" });

    const locationA = f.location(userA, "a-main");
    const locationB = f.location(userB, "b-main");
    await verifyOwnedTable(t, { table: "saved_locations", userA, userB, rowA: locationA, rowB: locationB, deleteRowA: f.location(userA, "a-delete"), ownUpdate: { address: `${runId} User A updated address` }, changedField: "address" });

    const logbookA = f.logbook(userA, "A");
    const logbookB = f.logbook(userB, "B");
    await verifyOwnedTable(t, { table: "logbook_periods", userA, userB, rowA: logbookA, rowB: logbookB, deleteRowA: f.logbook(userA, "D"), ownUpdate: { vehicle_description: "User A updated synthetic vehicle" }, changedField: "vehicle_description" });

    const annualA = f.annual(userA, logbookA.id, "A", 2025);
    const annualB = f.annual(userB, logbookB.id, "B", 2025);
    await verifyOwnedTable(t, { table: "logbook_income_years", userA, userB, rowA: annualA, rowB: annualB, deleteRowA: f.annual(userA, logbookA.id, "D", 2024), ownUpdate: { notes: "User A updated synthetic annual record" }, changedField: "notes" });

    await t.test("annual records: composite foreign key rejects another user's logbook", async () => {
      const crossLinked = f.annual(userA, logbookB.id, "X", 2023);
      assertDenied(await insertRow(userA, "logbook_income_years", crossLinked), "Cross-owner logbook relationship");
    });

    await t.test("RPC: schema version is intentionally shared with authenticated users", async () => {
      const [a, b] = await Promise.all([rpc(userA, "get_app_schema_version"), rpc(userB, "get_app_schema_version")]);
      assertOk(a, "User A schema version RPC");
      assertOk(b, "User B schema version RPC");
      assert.equal(a.data, b.data);
      assert.ok(Number.isInteger(Number(a.data)) && Number(a.data) > 0);
    });

    await t.test("RPC: privacy acceptance changes only the caller's profile", async () => {
      const beforeB = await selectRow(userB, "profiles", userB.id);
      const marker = `tenant-test-${runId}`.slice(0, 50);
      assertOk(await rpc(userA, "accept_privacy_notice", { notice_version: marker }), "User A privacy RPC");
      const [afterA, afterB] = await Promise.all([selectRow(userA, "profiles", userA.id), selectRow(userB, "profiles", userB.id)]);
      assert.equal(afterA.data?.[0]?.privacy_version, marker);
      assert.equal(afterB.data?.[0]?.privacy_version, beforeB.data?.[0]?.privacy_version);
    });

    await t.test("RPC: deleting User A's account preserves User B and their records", async () => {
      assertOk(await rpc(userA, "delete_my_account"), "User A delete account RPC");
      const bProfile = await selectRow(userB, "profiles", userB.id);
      const bTrip = await selectRow(userB, "trips", tripB.id);
      const bLocation = await selectRow(userB, "saved_locations", locationB.id);
      const bLogbook = await selectRow(userB, "logbook_periods", logbookB.id);
      const bAnnual = await selectRow(userB, "logbook_income_years", annualB.id);
      for (const response of [bProfile, bTrip, bLocation, bLogbook, bAnnual]) {
        assertOk(response, "User B record after User A deletion");
        assert.equal(response.data?.length, 1);
      }
    });
  } finally {
    const cleanup = await Promise.allSettled([deleteSyntheticUser(userA?.id), deleteSyntheticUser(userB?.id)]);
    if (cleanup.some((result) => result.status === "rejected")) {
      throw new Error("One or more synthetic users could not be cleaned up; inspect the staging Auth user list.");
    }
  }
});
