# Travel Log staging environment

Staging is a disposable test system for validating pull requests and major releases without accessing production accounts or trip data.

## Isolation rules

- Staging uses a separate Supabase project, routing Worker, user accounts, and database records.
- Production remains on GitHub Pages. Cloudflare Pages hosts staging and pull-request previews only.
- The staging build rejects the production Supabase and Worker addresses.
- Every staging page displays **STAGING TEST ENVIRONMENT — TEST DATA ONLY** and asks search engines not to index it.
- Never copy production users, addresses, trips, passwords, API secrets, or database exports into staging.

## One-time Supabase setup

1. Create a second Supabase project named `travel-log-staging` in the same region as production.
2. In its SQL Editor, run every file in `supabase/migrations.json` release order.
3. Verify `select public.get_app_schema_version();` returns the manifest's `schemaVersion`.
4. Set the Authentication site URL to the staging Pages URL after Cloudflare creates it.
5. Create test users manually in Authentication. Use addresses controlled by the testers, unique passwords, and no real trip data.
6. After the approved testers exist, disable public new-user signups in staging. Add future testers manually.

Supabase currently permits two active Free projects. A free staging project may pause after a week without activity and can be restored from the dashboard.

## One-time staging Worker setup

Deploy a second Worker named `travel-log-distance-api-staging` from the routing repository. Configure it with:

- staging `SUPABASE_URL`
- staging `SUPABASE_PUBLISHABLE_KEY`
- staging `OPENROUTESERVICE_API_KEY` secret
- `ALLOWED_ORIGINS=https://travel-log-staging.pages.dev`
- `ALLOWED_ORIGIN_SUFFIXES=.travel-log-staging.pages.dev`
- a rate-limit binding separate from production

The production Worker must continue accepting only `https://santana-co.github.io`.

## One-time Cloudflare Pages setup

Create a Git-integrated Pages project from `Santana-Co/Travel-Log` with:

- project name: `travel-log-staging`
- production branch: `main`
- build command: `npm run build:staging`
- output directory: `dist-staging`
- preview branches: all non-production branches

Add these build variables for both Production and Preview:

- `TRAVEL_LOG_SUPABASE_URL` — staging project URL
- `TRAVEL_LOG_SUPABASE_PUBLISHABLE_KEY` — staging publishable key only
- `TRAVEL_LOG_DISTANCE_API_URL` — staging Worker `/distance` URL

Never add a Supabase service-role key to Pages. Values included in a browser build are public by design.

## Pull-request test flow

1. Open a draft pull request.
2. Wait for App checks, CodeQL, and the Cloudflare Pages preview deployment to pass.
3. Open the preview URL and confirm the staging banner is visible.
4. Sign in using a staging-only test account.
5. Complete `STAGING_SMOKE_TEST.md`.
6. Apply and verify any new migration in staging before testing it.
7. Apply the migration in production only after staging passes and immediately before the approved production merge.

Do not use the staging site's root URL or preview URLs as the production service.
