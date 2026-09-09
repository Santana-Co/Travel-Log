const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase", "schema-version-migration.sql"), "utf8");
const reconciliationMigration = fs.readFileSync(
  path.join(root, "supabase", "production-schema-reconciliation-migration.sql"),
  "utf8",
);
const manifest = JSON.parse(fs.readFileSync(path.join(root, "supabase", "migrations.json"), "utf8"));

test("repository schema and browser minimum versions form a valid compatibility contract", () => {
  const browserVersion = app.match(/const requiredSchemaVersion = (\d+);/);
  const databaseVersion = migration.match(/values\s*\(\s*true\s*,\s*(\d+)\s*\)/i);
  assert.ok(browserVersion, "requiredSchemaVersion is missing from app.js");
  assert.ok(databaseVersion, "schema version is missing from the migration");
  const browserMinimum = Number(browserVersion[1]);
  const repositoryVersion = Number(databaseVersion[1]);
  const isValidContract = (minimumVersion) => minimumVersion <= repositoryVersion;

  assert.equal(browserMinimum, 3);
  assert.equal(repositoryVersion, manifest.schemaVersion);
  assert.ok(isValidContract(browserMinimum));
  assert.equal(isValidContract(repositoryVersion + 1), false);
});

test("browser enforces schema version 3 as a fail-closed minimum", async () => {
  const browserMinimum = Number(app.match(/const requiredSchemaVersion = (\d+);/)[1]);
  const compatibilitySource = app.slice(
    app.indexOf("async function ensureSchemaCompatible"),
    app.indexOf("function showCompatibilityIssue"),
  );
  const context = {
    db: { rpc: async () => ({ data: 3, error: null }) },
  };
  vm.runInNewContext(
    `const requiredSchemaVersion = ${browserMinimum};\n${compatibilitySource}\nglobalThis.ensureSchemaCompatible = ensureSchemaCompatible;`,
    context,
  );

  const check = async (data, error = null) => {
    context.db.rpc = async () => ({ data, error });
    return context.ensureSchemaCompatible();
  };

  assert.equal((await check(2)).compatible, false);
  assert.equal((await check(3)).compatible, true);
  assert.equal((await check(4)).compatible, true);
  assert.equal((await check(undefined)).compatible, false);
  assert.equal((await check("invalid")).compatible, false);
  assert.equal((await check(null, new Error("RPC unavailable"))).compatible, false);
});

test("every Supabase migration is included once in release order", () => {
  const files = fs.readdirSync(path.join(root, "supabase")).filter((name) => name.endsWith(".sql")).sort();
  assert.deepEqual([...manifest.releaseOrder].sort(), files);
  assert.equal(new Set(manifest.releaseOrder).size, manifest.releaseOrder.length);
  assert.equal(manifest.releaseOrder.at(-1), "schema-version-migration.sql");
});

test("production reconciliation is fail-closed and preserves schema version 2", () => {
  assert.match(reconciliationMigration, /begin;/i);
  assert.match(reconciliationMigration, /pg_advisory_xact_lock/i);
  assert.match(reconciliationMigration, /raise exception 'trips\.stops contains data that cannot be safely converted/i);
  assert.match(reconciliationMigration, /alter column stops type jsonb using to_jsonb\(stops\)/i);
  assert.match(reconciliationMigration, /Canonical profile ownership policies are missing or unexpected/i);
  assert.match(reconciliationMigration, /Canonical trip ownership policies are missing or unexpected/i);
  assert.match(reconciliationMigration, /drop trigger if exists create_profile_after_signup on auth\.users/i);
  assert.match(reconciliationMigration, /drop function if exists public\.create_profile_for_new_user\(\)/i);
  assert.doesNotMatch(reconciliationMigration, /(?:delete\s+from|truncate(?:\s+table)?)\s+public\.(?:profiles|trips|saved_locations|logbook_periods|logbook_income_years)/i);
  assert.doesNotMatch(reconciliationMigration, /update\s+public\.(?:profiles|trips)[\s\S]*?set\s+(?:id|user_id)\s*=/i);
  assert.doesNotMatch(reconciliationMigration, /(?:insert\s+into|update|delete\s+from)\s+private\.app_schema_state/i);
  assert.match(reconciliationMigration, /commit;/i);
});

test("signed-in startup checks the authenticated compatibility RPC", () => {
  assert.match(app, /db\.rpc\("get_app_schema_version"\)/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /grant execute on function public\.get_app_schema_version\(\) to authenticated/i);
  assert.match(migration, /revoke all on function public\.get_app_schema_version\(\) from public, anon/i);
  assert.match(migration, /notify pgrst, 'reload schema'/i);
  const showApp = app.slice(app.indexOf("async function showApp"), app.indexOf("function showAuth"));
  const compatibilityIssue = app.slice(app.indexOf("function showCompatibilityIssue"), app.indexOf("async function showApp"));
  assert.ok(showApp.indexOf("ensureSchemaCompatible()") < showApp.indexOf("ensurePrivacyAccepted()"));
  assert.match(showApp, /if \(!schema\.compatible\) \{\s*showCompatibilityIssue\(schema\.message\);\s*return;/);
  assert.ok(showApp.indexOf('$("#app-view").hidden = true') < showApp.indexOf("ensureSchemaCompatible()"));
  assert.ok(showApp.indexOf("ensureSchemaCompatible()") < showApp.indexOf('$("#app-view").hidden = false'));
  assert.ok(showApp.indexOf("ensureSchemaCompatible()") < showApp.indexOf("loadTrips()"));
  assert.match(compatibilityIssue, /compatibilityDialog\.showModal\(\)/);
});

test("account deletion compares JWT issue time using a non-reserved epoch variable", () => {
  const accountDeletionMigration = fs.readFileSync(path.join(root, "supabase", "account-deletion-time-variable-migration.sql"), "utf8");
  assert.match(accountDeletionMigration, /current_epoch bigint := extract\(epoch from now\(\)\)::bigint/i);
  assert.match(accountDeletionMigration, /current_epoch - issued_at > 300/i);
  assert.doesNotMatch(accountDeletionMigration, /current_time - issued_at/i);
  assert.match(accountDeletionMigration, /security invoker/i);
  assert.match(accountDeletionMigration, /perform private\.delete_my_account_internal\(\)/i);
});
