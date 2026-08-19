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
  assert.ok(index.indexOf("logic.js") < index.indexOf("app.js"));
  assert.match(index, /Content-Security-Policy/);
  const report = read("report.html");
  assert.ok(report.indexOf("logic.js") < report.indexOf("report.js"));
});

test("privacy, report and migration assets are present", () => {
  for (const name of ["privacy.html", "ato-guide.html", "report.html", "report.css", "supabase/privacy-security-migration.sql", "supabase/reporting-migration.sql", "supabase/stabilization-migration.sql", "supabase/ato-logbook-migration.sql"]) {
    assert.ok(fs.existsSync(path.join(root, name)), name);
  }
});
