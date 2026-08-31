const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");

const root = path.join(__dirname, "..");
const output = path.join(root, "dist-staging");

test("staging build produces an isolated no-index site", () => {
  execFileSync(process.execPath, [path.join(root, "scripts", "build-staging.cjs")], {
    env: {
      ...process.env,
      TRAVEL_LOG_SUPABASE_URL: " https://staging-example.supabase.co ",
      TRAVEL_LOG_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_staging_test_key",
      TRAVEL_LOG_DISTANCE_API_URL: "https://travel-log-distance-api-staging.example.workers.dev/distance",
    },
  });
  const config = fs.readFileSync(path.join(output, "config.js"), "utf8");
  const index = fs.readFileSync(path.join(output, "index.html"), "utf8");
  assert.match(config, /"environment": "staging"/);
  assert.match(config, /staging-example\.supabase\.co/);
  assert.doesNotMatch(config, /supabase\.co\s+"/);
  assert.doesNotMatch(config, /caqgnnlgtomcmkpafvoc/);
  assert.match(index, /noindex, nofollow/);
  assert.match(index, /connect-src 'self' https:\/\/staging-example\.supabase\.co wss:\/\/staging-example\.supabase\.co https:\/\/travel-log-distance-api-staging\.example\.workers\.dev;/);
});

test("staging build rejects absent or privileged credentials", () => {
  assert.throws(() => execFileSync(process.execPath, [path.join(root, "scripts", "build-staging.cjs")], { env: {} }));
  assert.throws(() => execFileSync(process.execPath, [path.join(root, "scripts", "build-staging.cjs")], {
    env: {
      TRAVEL_LOG_SUPABASE_URL: "https://staging-example.supabase.co",
      TRAVEL_LOG_SUPABASE_PUBLISHABLE_KEY: "service_role_secret",
      TRAVEL_LOG_DISTANCE_API_URL: "https://worker.example/distance",
    },
  }));
  assert.throws(() => execFileSync(process.execPath, [path.join(root, "scripts", "build-staging.cjs")], {
    env: {
      TRAVEL_LOG_SUPABASE_URL: "https://caqgnnlgtomcmkpafvoc.supabase.co",
      TRAVEL_LOG_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_QH3nXDysJyTfg61qv_h98w_-SergW2w",
      TRAVEL_LOG_DISTANCE_API_URL: "https://travel-log-distance-api.jfsantana0691.workers.dev/distance",
    },
  }));
});
