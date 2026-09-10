# Travel Log

Travel Log is an Australian work-travel, compliance, and evidence web pilot. Signed-in users can record private trips, calculate or enter distance, maintain ATO-style kilometre/logbook records, filter totals, and export accountant-friendly data. It is not yet a commercially complete SaaS product.

## Current status and architecture

The responsive static application is deployed from `main` through GitHub Pages. Browser JavaScript talks directly to Supabase Auth, PostgREST, and RPCs; PostgreSQL constraints and RLS enforce tenant ownership. A protected Cloudflare Worker mediates route-distance requests to an external routing provider.

The current repository/database schema and browser minimum supported schema are both version **3**. Startup accepts version 3 or higher and fails safely on missing, invalid, errored, or older versions.

Live staging tests have verified two-user tenant isolation across the five private application tables and relevant RPCs. Production schema drift, account deletion, and local calendar-date handling have been corrected and verified. A logical backup and disposable PostgreSQL restore validated application schema/data recovery, but full managed Supabase recovery remains **PARTIALLY VERIFIED**.

## Features

- Email/password accounts, private cloud records, privacy acceptance, data export, and reauthenticated account deletion
- Trip creation, editing, duplication, deletion, multiple ordered stops, round trips, search, and filters
- Protected driving-distance calculation plus manual distance entry and Google Maps route links
- Saved locations and per-trip vehicle/registration details
- Employer/general, ATO cents-per-kilometre, and representative-logbook/odometer recording modes
- Australian financial-year rates, caps, logbook estimates, filtered CSV, JSON account export, and printable reports
- Cross-device appearance and recording-mode preferences

ATO outputs are estimates and record-keeping aids, not personalised tax advice.

## Repository map

```text
app.js, logic.js, index.html, styles.css   Browser application and domain logic
report.html, report.js, report.css          Printable report
config.js                                   Public production browser configuration
supabase/                                   Bootstrap schema and ordered migrations
scripts/                                    Isolated staging build
tests/                                      Unit, contract, build, and live integration tests
docs/product/                               Product and commercial direction
docs/engineering/                           Architecture, standards, and technical debt
docs/decisions/                             Durable decisions
CODEX_INSTRUCTIONS.md                       Codex operating rules
```

## Local setup

Prerequisites are Node.js 24 and a local static HTTP server. There are no npm runtime dependencies; the browser loads a pinned Supabase client from jsDelivr.

From the repository root, for example:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`. Do not open `index.html` directly.

Useful signed-in local operation is not fully self-contained: it requires compatible Supabase and routing services, Auth redirect configuration, applied migrations, and credentials intentionally absent from this repository. Prefer an isolated environment and synthetic data. Committed `config.js` points to public production endpoints; never put service-role, database, or routing-provider secrets in browser assets.

## Tests

Run credential-free unit, contract, static, staging-build, and JavaScript syntax checks:

```sh
npm test
```

The live Supabase tenant-isolation suite is separate and requires explicit non-production configuration:

```sh
npm run test:integration
```

Follow [the integration guide](tests/integration/README.md). The repository does not currently define lint, type-check, or general browser/E2E commands.

## Configuration, staging, and production

- **Production:** public assets from `main` on GitHub Pages, production Supabase, and the production routing Worker.
- **Staging/previews:** generated Cloudflare Pages builds with a separate Supabase project, Worker, accounts, and synthetic data.

The staging build requires `TRAVEL_LOG_SUPABASE_URL`, `TRAVEL_LOG_SUPABASE_PUBLISHABLE_KEY`, and `TRAVEL_LOG_DISTANCE_API_URL`. It rejects production endpoints, privileged-looking keys, missing values, and non-HTTPS URLs. See [STAGING.md](STAGING.md) and [STAGING_SMOKE_TEST.md](STAGING_SMOKE_TEST.md).

Database changes must be repository-owned and listed in `supabase/migrations.json`. Keep the repository database version distinct from the browser minimum, test staging first, and follow [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) before production migration.

## Product and engineering documentation

- [Product vision](docs/product/PRODUCT_VISION.md)
- [Product roadmap](docs/product/PRODUCT_ROADMAP.md)
- [Commercialisation roadmap](docs/product/COMMERCIALISATION_ROADMAP.md)
- [Architecture](docs/engineering/ARCHITECTURE.md)
- [Technical debt](docs/engineering/TECHNICAL_DEBT.md)
- [Coding standards](docs/engineering/CODING_STANDARDS.md)
- [Decision log](docs/decisions/DECISIONS.md)
- [Codex operating instructions](CODEX_INSTRUCTIONS.md)

Operational references include [security](SECURITY.md), [incident response](INCIDENT_RESPONSE.md), [staging](STAGING.md), [production reconciliation](PRODUCTION_SCHEMA_RECONCILIATION.md), and the [release checklist](RELEASE_CHECKLIST.md).

## Contribution workflow

Start from clean current `main`, read `CODEX_INSTRUCTIONS.md` and relevant documents, use a focused branch, inspect before editing, keep scope narrow, add proportional tests, and run applicable checks. Before committing, review staged content for secrets, personal data, generated artifacts, unrelated changes, and migration/version consistency. Use the repository PR template and do not treat approval as proof that deployment completed.

## Privacy and security

Trip and address data is sensitive and lives in Supabase, not GitHub. See [SECURITY.md](SECURITY.md) for reporting and pilot safeguards. Never commit real trip/location data, passwords, tokens, service-role keys, database dumps, or private backup locations.
