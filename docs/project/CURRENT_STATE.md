# Travel Log — Current State

Consolidated starting context, not a session log. Updated **22 October 2026** after Task #14 completion. Deployed product baseline: PR #23, merge `daa1655129dc42d07c9815b15c2ae31205ca9383`. Release facts come from established CI results and the user's completed manual production smoke, not a new audit.

## Current checkpoint

- Last completed product task: **Task #14 — Financial-Year Reporting UX**, including deployment and the user's authenticated read-only production smoke.
- Stage 0: **COMPLETE**. Current phase: **Refine**.
- Production/staging application schema: **5**; current browser minimum: **5**.
- Last merged material product PR: **#23**, merge `daa1655129dc42d07c9815b15c2ae31205ca9383`.
- Handover task **#13C** merged as PR #21; merged-main App checks, CodeQL and Pages passed.
- Current task: **#14 — COMPLETE**; final manual smoke confirmed by the user without creating, editing or deleting production records.
- Next recommended task: **Task #15 — Reusable Vehicle Profiles**, awaiting separate approval; not started.
- Active Task #14 release blockers: **none**. Recovery remains **PARTIALLY VERIFIED**; staging deployment safeguard [issue #20](https://github.com/Santana-Co/Travel-Log/issues/20) is separate operational work.

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

Startup calls `get_app_schema_version()`. The browser accepts a valid integer version **>= 5**, including future higher versions; missing/invalid/error/older responses block normal loading through the compatibility state. Repository schema and browser minimum are separate concepts. Deployment details belong in [RELEASE_STATE.md](RELEASE_STATE.md).

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

Completed: first-trip simplification (#14 PR), trip clarity/evidence presentation (#15 PR), classification (Task #12 / PR #16), persisted provenance/manual evidence (Task #13 / PR #17), financial-year reporting (Task #14 / PR #23). Task numbers and PR numbers are distinct.

Next priorities: (1) **Task #15 — Reusable Vehicle Profiles**; (2) immutable corrections/audit history; (3) focused onboarding, accessibility/mobile polish and trust improvements. These are recommendations, not authorised work; Task #15 has not begun.

Operational risks: **PARTIALLY VERIFIED** recovery (application restore exercised, complete managed Auth/Storage/Vault runtime not reproduced); staging Worker deployment guard [#20](https://github.com/Santana-Co/Travel-Log/issues/20); production Auth/signup diagnostics; missing central monitoring/health checks; incomplete rule-source/version metadata. Do not fold them into unrelated product work.

Use [technical debt](../engineering/TECHNICAL_DEBT.md), [roadmap](../product/PRODUCT_ROADMAP.md), [architecture](../engineering/ARCHITECTURE.md) and [decisions](../decisions/DECISIONS.md) only when relevant. Some deeper documents retain schema-v5 **candidate** wording; this handover records its completed release. Do not re-audit the release to resolve that known editorial lag.
