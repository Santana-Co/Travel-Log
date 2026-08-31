const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const output = path.join(root, "dist-staging");
const settings = {
  environment: "staging",
  buildLabel: "Testing app · Version 2",
  supabaseUrl: process.env.TRAVEL_LOG_SUPABASE_URL,
  supabasePublishableKey: process.env.TRAVEL_LOG_SUPABASE_PUBLISHABLE_KEY,
  distanceApiUrl: process.env.TRAVEL_LOG_DISTANCE_API_URL,
};

function required(name, value) {
  if (!value) throw new Error(`${name} is required for a staging build.`);
  return value;
}

function secureUrl(name, value) {
  required(name, value);
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${name} must be a valid URL.`); }
  if (parsed.protocol !== "https:") throw new Error(`${name} must use HTTPS.`);
  return parsed;
}

const supabase = secureUrl("TRAVEL_LOG_SUPABASE_URL", settings.supabaseUrl);
if (!supabase.hostname.endsWith(".supabase.co")) throw new Error("TRAVEL_LOG_SUPABASE_URL must be a Supabase project URL.");
if (supabase.hostname === "caqgnnlgtomcmkpafvoc.supabase.co") throw new Error("A staging build must never use the production Supabase project.");
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(required("TRAVEL_LOG_SUPABASE_PUBLISHABLE_KEY", settings.supabasePublishableKey))) {
  throw new Error("TRAVEL_LOG_SUPABASE_PUBLISHABLE_KEY must be a publishable key, never a service-role key.");
}
const distanceApi = secureUrl("TRAVEL_LOG_DISTANCE_API_URL", settings.distanceApiUrl);
if (distanceApi.hostname === "travel-log-distance-api.jfsantana0691.workers.dev") throw new Error("A staging build must never use the production routing Worker.");

const assets = [
  "app.js",
  "ato-guide.html",
  "index.html",
  "logic.js",
  "privacy.html",
  "report.css",
  "report.html",
  "report.js",
  "styles.css",
  "theme.js",
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const asset of assets) fs.copyFileSync(path.join(root, asset), path.join(output, asset));

const connectSources = `connect-src 'self' ${supabase.origin} wss://${supabase.host} ${distanceApi.origin};`;
const indexPath = path.join(output, "index.html");
let index = fs.readFileSync(indexPath, "utf8");
const configuredIndex = index.replace(/connect-src 'self' [^;]+;/, connectSources);
if (configuredIndex === index) throw new Error("The staging Content Security Policy could not be configured.");
index = configuredIndex;
index = index.replace('<meta name="description" content="A simple work travel log." />', '<meta name="description" content="A simple work travel log." />\n    <meta name="robots" content="noindex, nofollow" />');
fs.writeFileSync(indexPath, index);

const config = `window.TravelLogConfig = Object.freeze(${JSON.stringify(settings, null, 2)});\n`;
fs.writeFileSync(path.join(output, "config.js"), config);
console.log(`Staging site built in ${output}`);
