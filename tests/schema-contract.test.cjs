const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase", "schema-version-migration.sql"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "supabase", "migrations.json"), "utf8"));

test("browser and database require the same schema version", () => {
  const browserVersion = app.match(/const requiredSchemaVersion = (\d+);/);
  const databaseVersion = migration.match(/values\s*\(\s*true\s*,\s*(\d+)\s*\)/i);
  assert.ok(browserVersion, "requiredSchemaVersion is missing from app.js");
  assert.ok(databaseVersion, "schema version is missing from the migration");
  assert.equal(Number(browserVersion[1]), Number(databaseVersion[1]));
  assert.equal(Number(browserVersion[1]), manifest.schemaVersion);
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
