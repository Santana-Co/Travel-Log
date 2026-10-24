# Task #15 — Reusable vehicles: design and release gate

**Status: implemented candidate, not deployed.** Production and staging remain schema 5. No live operations are authorised by this document.

## Model and evidence

`public.vehicles`: UUID `id`, authenticated `user_id`, required description `label` (1–120 characters), optional `registration` (up to 20 characters, empty string when absent), `archived` (default false), and server-managed `created_at` / `updated_at` timestamps. The client trims descriptions and uppercases registrations, matching existing trip entry.

There is deliberately **no profile foreign key on trips**. A user selection copies values into existing `trips.vehicle` and `trips.vehicle_registration`. Profile edits, archive/restore and removal cannot rewrite historical trips. Existing trips are untouched; no profiles are inferred or backfilled from old strings. Equal labels are not proof of vehicle identity. Profile selection supplies convenience values, not verified physical identity or immutable audit history.

Editing/duplicating a trip starts from its stored values without looking up a profile. Duplicates conservatively retain the recorded description/registration whether the source profile is active, renamed, archived or absent. A user can deliberately select a current active profile to replace them. Existing local-date, odometer-reset, classification and distance-provenance rules are unchanged.

Management is a small separate dialog available from Account and the trip's More details section. Add/edit/archive/restore uses explicit actions; no default vehicle is inferred. Manual entry remains available, including general travel without registration. A preferred/default vehicle is deferred. ATO modes still require their existing registration/evidence, and logbook/cap grouping uses the trip's registration—not profile ID or label. Logbook records are not automatically populated or renamed.

CSV, print, dashboard and FY calculations continue reading trip snapshots. Full-account JSON additionally includes all caller-owned saved vehicles, including archived profiles and their timestamps. It remains unfiltered by FY. No reporting rules change.

## Ownership

RLS permits only the authenticated owner's SELECT, INSERT and UPDATE, with both UPDATE predicates. Explicit column grants permit INSERT of identity/owner/details and UPDATE of description/registration/archive only. Clients cannot reassign identity/ownership/timestamps, delete or truncate vehicles; they archive instead. `auth.users` deletion cascades to that user's vehicles through a foreign key. No account-deletion RPC or existing table policy changes. There are no trip/profile reference IDs to cross-link across tenants.

## Compatibility and release order

- Migration: `supabase/reusable-vehicles-migration.sql`, last in the manifest. Repository schema **6**, candidate browser minimum **6**. Current deployed browser/database remain **5**.
- Schema-5 browser → schema 6: compatible under the unchanged minimum-version check; no trip columns/contracts, defaults or existing RLS are changed. Old trip CRUD and snapshot data preservation are exercised locally. Old full-account exports cannot include profiles they do not know about; after any frontend rollback, retain new profiles and use the schema-6 client for a complete export.
- Schema-6 browser → schema 5: deliberately blocked before any profile/trip/vehicle loading. Do not deploy this frontend early.
- Migration takes a transaction-scoped advisory lock, locks schema metadata, refuses missing/wrong versions, and rejects an unexpected pre-existing vehicles table at version 5. A second run on the intended schema 6 preserves records. It creates no vehicle records and does not mutate trips.

Required next gate: freeze candidate/migration checksum → approved staging preflight and recovery point → apply schema 6 to staging → existing browser against new schema + full candidate preview smoke → run extended two-user staging suite → exact synthetic cleanup. Include table grants/PostgREST availability, add/edit/archive, snapshot preservation, full JSON, ATO registration and mobile verification. Do not mistake browser mocks or disposable roles for live Supabase Auth/Data API verification.

Only after staging GO and separate production approval: fresh production preflight/backup/recovery gate → apply database migration → verify schema 6, unchanged trip records/owners/policies and old-client compatibility → cleanup → frontend GO → merge/deploy → scoped post-deployment verification. **This implementation PR must remain unmerged until the required production schema is verified.**

Rollback: keep schema 6 and saved profiles when rolling back to the schema-5 frontend; the additive table does not break old clients. Do not drop vehicles or downgrade schema metadata as an automatic rollback. If database recovery is needed, use the verified private backup and reviewed restore-to-clean-database procedure, accounting for writes after backup. Recovery remains **PARTIALLY VERIFIED**, not a full Supabase-platform restore guarantee.

## Verification

- `npm test`: vehicle validation/copying, registration-based logbook/cap rules, schema contract and existing regression suite.
- `npm run test:browser`: real local assets with deterministic synthetic data; vehicle CRUD/archive/restore and snapshots, manual entry, duplication, exports, nested dialog/focus, ATO registration and 390 × 844 layout. Non-loopback requests are blocked, including print popups.
- `npm run test:migration:vehicles`: fresh disposable PostgreSQL via a private Unix socket, with no inherited connection variables or credentials. Requires PostgreSQL server tools (`pg_config`, `initdb`, `pg_ctl`, `psql`; optionally `PG_BINDIR`). Tests preconditions/rollback, idempotence, no backfill, historical snapshots, old-client writes, A/B isolation, spoofed ownership, restricted grants, constraints, timestamps and exact synthetic Auth-parent cascade. Stops and removes only its own temporary cluster. It cannot accept a remote database URL.
- `npm run test:integration`: extended vehicle cases are **not run during implementation**; require explicit approved schema-6 staging configuration. The previously accepted 41-test live result covers the original five tables, not the new vehicles table.
