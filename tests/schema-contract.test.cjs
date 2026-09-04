const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase", "schema-version-migration.sql"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "supabase", "migrations.json"), "utf8"));

test("repository schema and browser minimum versions form a valid compatibility contract", () => {
  const browserVersion = app.match(/const requiredSchemaVersion = (\d+);/);
  const databaseVersion = migration.match(/values\s*\(\s*true\s*,\s*(\d+)\s*\)/i);
  assert.ok(browserVersion, "requiredSchemaVersion is missing from app.js");
  assert.ok(databaseVersion, "schema version is missing from the migration");
  const browserMinimum = Number(browserVersion[1]);
  const repositoryVersion = Number(databaseVersion[1]);
  const isValidContract = (minimumVersion) => minimumVersion <= repositoryVersion;

  assert.equal(repositoryVersion, manifest.schemaVersion);
  assert.ok(isValidContract(browserMinimum));
  assert.equal(isValidContract(repositoryVersion + 1), false);
});

test("every Supabase migration is included once in release order", () => {
  const files = fs.readdirSync(path.join(root, "supabase")).filter((name) => name.endsWith(".sql")).sort();
  assert.deepEqual([...manifest.releaseOrder].sort(), files);
  assert.equal(new Set(manifest.releaseOrder).size, manifest.releaseOrder.length);
  assert.equal(manifest.releaseOrder.at(-1), "schema-version-migration.sql");
});

test("signed-in startup checks the authenticated compatibility RPC", () => {
  assert.match(app, /db\.rpc\("get_app_schema_version"\)/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /grant execute on function public\.get_app_schema_version\(\) to authenticated/i);
  assert.match(migration, /revoke all on function public\.get_app_schema_version\(\) from public, anon/i);
  assert.match(migration, /notify pgrst, 'reload schema'/i);
  const showApp = app.slice(app.indexOf("async function showApp"), app.indexOf("function showAuth"));
  assert.ok(showApp.indexOf("ensureSchemaCompatible()") < showApp.indexOf("ensurePrivacyAccepted()"));
});

test("account deletion compares JWT issue time using a non-reserved epoch variable", () => {
  const accountDeletionMigration = fs.readFileSync(path.join(root, "supabase", "account-deletion-time-variable-migration.sql"), "utf8");
  assert.match(accountDeletionMigration, /current_epoch bigint := extract\(epoch from now\(\)\)::bigint/i);
  assert.match(accountDeletionMigration, /current_epoch - issued_at > 300/i);
  assert.doesNotMatch(accountDeletionMigration, /current_time - issued_at/i);
  assert.match(accountDeletionMigration, /security invoker/i);
  assert.match(accountDeletionMigration, /perform private\.delete_my_account_internal\(\)/i);
});
