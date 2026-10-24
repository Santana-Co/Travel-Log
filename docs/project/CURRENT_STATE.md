# Travel Log — Current State

Consolidated starting context, not a session log. Updated **24 October 2026** for the Task #15 candidate, based on clean `main` `5d8420e9bd6db96ab54eb04c9b3e158ce4679365`. Deployed product baseline remains PR #23, merge `daa1655129dc42d07c9815b15c2ae31205ca9383`. Task #15 is not deployed; no new live environment checks or changes occurred.

## Current checkpoint

- Last completed product task: **Task #14 — Financial-Year Reporting UX**, including deployment and the user's authenticated read-only production smoke.
- Stage 0: **COMPLETE**. Current phase: **Refine**.
- Production/staging application schema and deployed browser minimum: **5**. Task #15 candidate repository schema/browser minimum: **6**, not released.
- Last merged material product PR: **#23**, merge `daa1655129dc42d07c9815b15c2ae31205ca9383`.
- Handover task **#13C** merged as PR #21; merged-main App checks, CodeQL and Pages passed.
- Current task: **#15 — Reusable Vehicle Profiles**, implemented on `codex/reusable-vehicle-profiles`, pending PR/release gates; **not COMPLETE or deployed**. Task #14 remains COMPLETE.
- Next action: review the candidate and approve a schema-6 staging release-validation gate. Do not merge/deploy the frontend before production schema 6 is verified. No later task is authorised.
- Active Task #15 release gates: schema-6 staging migration/live isolation/preview, then separately approved production verification before frontend merge. Recovery remains **PARTIALLY VERIFIED**; staging deployment safeguard [issue #20](https://github.com/Santana-Co/Travel-Log/issues/20) is separate operational work.

## Product and deployed capabilities

Travel Log is an Australian work-travel, compliance and evidence web pilot. Strategy: **Build → Refine → Validate → Commercialise → Scale → Mobile → Expand**. Stage 0 is closed; commercial readiness and full managed-platform recovery are not claimed.

- Private authenticated trip create/read/edit/delete and duplication; ordered stops, round trips, saved locations, per-trip vehicle details and device-local calendar defaults.
- Explicit Work / Personal / Unclassified intent, classification/search/date/client filters and conservative Work-only estimates.
- Route-calculated, manual and odometer distance; persisted current distance provenance and constrained manual reason with optional short supporting note.
- Essential-first trip entry, inline recovery and expandable route-first trip/evidence cards.
- Employer/general, ATO cents-per-kilometre and representative-logbook modes; year-aware calculations and annual odometer records.
- All-date/Australian FY/custom-date reporting shared across dashboard, CSV and printable reports, including provenance/manual evidence; full JSON account download remains unfiltered. Account privacy, settings and deletion workflows remain available.

## Architecture and contract

Static HTML/CSS/JavaScript on GitHub Pages; no application server or framework. `app.js` orchestrates browser workflows and exports, `logic.js` owns reusable calculations/validation, and `report.js` renders print output. Supabase supplies Auth, PostgreSQL, PostgREST and RPCs. A separately maintained authenticated Cloudflare Worker calculates routes. Staging/previews use separate configured services.

Five private application tables: `profiles`, `trips`, `saved_locations`, `logbook_periods`, `logbook_income_years`. Supabase RLS and caller ownership—not browser filtering—form the tenant security boundary. Privileged credentials never belong in browser code or fixtures.

Task #15 adds candidate private table `vehicles` with description, optional registration, archive state and server timestamps. No trip FK: explicit selection copies existing historical snapshot fields. Profile edits never rewrite trips/logbooks; duplicate/edit keeps recorded values. Full JSON includes active/archived profiles; CSV/print/FY/ATO calculations keep reading trip snapshots.

Startup calls `get_app_schema_version()`. The deployed browser accepts integer versions **>= 5**; the candidate minimum is **6**. Missing/invalid/error/older responses block normal loading before vehicle/profile/trip reads. Repository schema and browser minimum are separate concepts. Deployment details belong in [RELEASE_STATE.md](RELEASE_STATE.md).

## Product/data invariants

- Never infer historical classification: pre-classification records remain Unclassified unless deliberately changed. Work is user intent, not automatic tax deductibility or reimbursement eligibility.
- Never infer historical provenance: pre-provenance records remain `unknown`, displayed as **Not recorded**. An unrelated edit must not fabricate a distance source.
- Provenance (`route_calculated`, `manual`, `odometer`, `unknown`) is independent of classification. Unknown provenance does not disqualify an otherwise included Work record.
- Manual distance requires a valid reason; its optional note is bounded. Duplicate distance is conservatively manual / `copied_from_trip`, not a fresh route calculation. New/duplicate dates are device-local; edit preserves stored dates; duplication resets odometers.
- Current provenance is **not immutable edit history**. Changes still overwrite the current row.
- Calendar days use local `YYYY-MM-DD`/database `date`, never UTC ISO slicing for defaults. Actual timestamps remain UTC ISO/`timestamptz`.
- Ordered stops are JSONB string arrays. Ownership, RLS and same-owner relationships remain intact.
- Personal/Unclassified trips remain visible/exportable but are excluded from Work estimates. Keep rates, caps and recording-mode semantics unchanged unless explicitly in scope and verified.
- Outputs are estimates/evidence support, not personal tax advice. Full JSON account download is not a filtered report.

## Meaningful test baseline

- Task #15 candidate local gate: **44 unit/static passed**, **15 browser passed**, **44 disposable PostgreSQL migration/RLS assertions passed**; syntax, documentation links and diff checks passed. No live integration suite was run. These candidate results do not replace the deployed/live baseline below.

- `npm test`: credential-free domain/date/classification/provenance/reporting rules, schema contracts, static assets, staging-build guards and syntax checks; deployed Task #14 baseline **40 passed**.
- `npm run test:browser`: real local assets with deterministic synthetic backend boundaries; startup/compatibility, CRUD/duplication, dates, classification, provenance and CSV/JSON/print, including FY reconciliation and representative mobile checks. Deployed Task #14 baseline **11 passed**; non-loopback service access is blocked/mocked, not live verification.
- `npm run test:integration`: explicitly configured staging-only two-user ownership/RPC suite; prior release baseline **41 passed**, no cross-user access. Never run it against production.
- PR #23 checks, including Cloudflare preview, passed; merged-main App checks/browser step, CodeQL and Pages passed. These are recorded results, not instructions to rerun them for ordinary documentation work.

## Task #14 — COMPLETE and deployed

- All dates / Australian FY / Custom dates share dashboard, CSV and printable-report scope. Inclusion follows journey start date; classification/search/client filters remain combined. Included/excluded counts distinguish period exclusions from other filters.
- Selected total and Work distance stay separate. CSV monetary contributions reconcile to the displayed after-cap total using chronological allocation and cent rounding; existing rates/caps are unchanged. Caps describe selected records, not remaining entitlement. Work is not an eligibility determination.
- Annual logbook results use full-year records and complete representative evidence under the established validity window; unsupported/partial/filter combinations explain unavailability. Invalid odometer records or percentages above 100% are not presented as supported annual estimates.
- Provenance/manual evidence remains in CSV and print. Full-account JSON is unchanged; filtered JSON is optional future backlog only.
- Empty states, mobile reporting and synthetic boundary/export regressions are included. No database, schema-version, Auth or routing change.
- On 22 October 2026, the user confirmed the final authenticated, read-only production smoke: normal loading without a compatibility warning, existing trips, FY choices/labels/ranges, scope changes, summaries, classification presentation and selected-scope printable totals worked, with no obvious responsive regression. No production records were created, edited or deleted.

## Refine backlog and operational risks

Task #15 candidate: saved-vehicle management and trip selection; manual entry retained; no historical inference or default preference; own-user RLS and restricted column grants; archive rather than direct deletion. Local disposable PostgreSQL and synthetic desktop/mobile browser coverage accompany the [release plan](../engineering/VEHICLE_PROFILES_RELEASE.md). Live six-table tenant isolation is still pending; the accepted 41-test live baseline covers the original five tables only.

Completed: first-trip simplification (#14 PR), trip clarity/evidence presentation (#15 PR), classification (Task #12 / PR #16), persisted provenance/manual evidence (Task #13 / PR #17), financial-year reporting (Task #14 / PR #23). Task numbers and PR numbers are distinct.

Current priority: complete Task #15's review and separately approved release gates. Later possibilities remain immutable corrections/audit history and focused onboarding/accessibility/mobile polish; none is authorised by Task #15.

Operational risks: **PARTIALLY VERIFIED** recovery (application restore exercised, complete managed Auth/Storage/Vault runtime not reproduced); staging Worker deployment guard [#20](https://github.com/Santana-Co/Travel-Log/issues/20); production Auth/signup diagnostics; missing central monitoring/health checks; incomplete rule-source/version metadata. Do not fold them into unrelated product work.

Use [technical debt](../engineering/TECHNICAL_DEBT.md), [roadmap](../product/PRODUCT_ROADMAP.md), [architecture](../engineering/ARCHITECTURE.md) and [decisions](../decisions/DECISIONS.md) only when relevant. Some deeper documents retain schema-v5 **candidate** wording; this handover records its completed release. Do not re-audit the release to resolve that known editorial lag.
