const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("production pages load pinned and local scripts in the required order", () => {
  const index = read("index.html");
  assert.match(index, /@supabase\/supabase-js@2\.112\.3/);
  assert.match(index, /integrity="sha384-/);
  assert.ok(index.indexOf("theme.js") < index.indexOf("styles.css"));
  assert.ok(index.indexOf("logic.js") < index.indexOf("app.js"));
  assert.match(index, /Content-Security-Policy/);
  const report = read("report.html");
  assert.ok(report.indexOf("theme.js") < report.indexOf("report.css"));
  assert.ok(report.indexOf("logic.js") < report.indexOf("report.js"));
});

test("privacy, report and migration assets are present", () => {
  for (const name of ["privacy.html", "ato-guide.html", "report.html", "report.css", "theme.js", "supabase/privacy-security-migration.sql", "supabase/reporting-migration.sql", "supabase/stabilization-migration.sql", "supabase/ato-logbook-migration.sql", "supabase/appearance-theme-migration.sql", "supabase/recording-mode-migration.sql", "supabase/account-reauthentication-migration.sql", "supabase/schema-version-migration.sql"]) {
    assert.ok(fs.existsSync(path.join(root, name)), name);
  }
  assert.match(read("supabase/appearance-theme-migration.sql"), /appearance_theme in \('light', 'dark', 'system'\)/);
  assert.match(read("supabase/appearance-theme-migration.sql"), /notify pgrst, 'reload schema'/);
  assert.match(read("app.js"), /appearance_theme/);
  assert.match(read("supabase/recording-mode-migration.sql"), /recording_mode in \('general', 'ato_cents', 'ato_logbook'\)/);
  assert.match(read("supabase/recording-mode-migration.sql"), /notify pgrst, 'reload schema'/);
  assert.match(read("app.js"), /recording_mode/);
  assert.match(read("index.html"), /id="recording-mode"/);
  assert.match(read("index.html"), /id="claim-method" type="hidden"/);
  assert.match(read("index.html"), /id="delete-password" type="password" autocomplete="current-password"/);
  assert.match(read("app.js"), /signInWithPassword\(\{ email: currentUser\.email, password \}\)/);
  assert.match(read("supabase/account-reauthentication-migration.sql"), /Recent authentication required/);
  assert.match(read("index.html"), /id="compatibility-dialog"/);
});
