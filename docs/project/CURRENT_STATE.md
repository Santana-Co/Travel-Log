# Travel Log — Current State

Consolidated starting context, not a session log. Updated **22 October 2026** for Task #14, based on `main` `08fe632d36130c0a2023649efd502a0a8c96b479` (handover PR #21). Last deployed material product baseline remains PR #17 (`c65b1c86ed1db2c7df7e242207837297ecd39536`). Task #14 is prepared for review, **not deployed**. Live-state facts below come from completed release gates, not a new audit.

## Current checkpoint

- Last completed product task: **Task #13 — persisted distance provenance/manual evidence**, including staging, production and exact synthetic cleanup.
- Stage 0: **COMPLETE**. Current phase: **Refine**.
- Production/staging application schema: **5**; current browser minimum: **5**.
- Last merged material product PR: **#17**, merge `c65b1c86ed1db2c7df7e242207837297ecd39536`.
- Handover task **#13C** merged as PR #21; merged-main App checks, CodeQL and Pages passed.
- Current task: **#14 — Financial-Year Reporting UX**, resumed from the preserved draft and prepared for review on `codex/financial-year-reporting-ux`; not merged or released.
- Next action: review Task #14's PR. Reusable vehicles remain the next product candidate, not authorised work.
- Active Task #13 release blockers: **none**. Recovery remains **PARTIALLY VERIFIED**; staging deployment safeguard [issue #20](https://github.com/Santana-Co/Travel-Log/issues/20) is separate operational work.

## Product and deployed capabilities

Travel Log is an Australian work-travel, compliance and evidence web pilot. Strategy: **Build → Refine → Validate → Commercialise → Scale → Mobile → Expand**. Stage 0 is closed; commercial readiness and full managed-platform recovery are not claimed.

- Private authenticated trip create/read/edit/delete and duplication; ordered stops, round trips, saved locations, per-trip vehicle details and device-local calendar defaults.
- Explicit Work / Personal / Unclassified intent, classification/search/date/client filters and conservative Work-only estimates.
- Route-calculated, manual and odometer distance; persisted current distance provenance and constrained manual reason with optional short supporting note.
- Essential-first trip entry, inline recovery and expandable route-first trip/evidence cards.
- Employer/general, ATO cents-per-kilometre and representative-logbook modes; year-aware calculations and annual odometer records.
- Filtered CSV, full JSON account download and printable/PDF-oriented reports, including provenance/manual evidence; account privacy, settings and deletion workflows.

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

- `npm test`: credential-free domain/date/classification/provenance/reporting rules, schema contracts, static assets, staging-build guards and syntax checks; Task #14 branch **40 passed** (deployed baseline: 34).
- `npm run test:browser`: real local assets with deterministic synthetic backend boundaries; startup/compatibility, CRUD/duplication, dates, classification, provenance and CSV/JSON/print, including FY reconciliation and representative mobile checks. Task #14 branch **11 passed** (deployed baseline: 7); non-loopback service access is blocked/mocked, not live verification.
- `npm run test:integration`: explicitly configured staging-only two-user ownership/RPC suite; prior release baseline **41 passed**, no cross-user access. Never run it against production.
- App checks/browser step, CodeQL, Pages and applicable Cloudflare checks passed for merged PR #17. These are recorded results, not instructions to rerun them for ordinary documentation work.

## Task #14 — pending review, not deployed

- All dates / Australian FY / Custom dates share dashboard, CSV and printable-report scope. Inclusion follows journey start date; classification/search/client filters remain combined. Included/excluded counts distinguish period exclusions from other filters.
- Selected total and Work distance stay separate. CSV monetary contributions reconcile to the displayed after-cap total using chronological allocation and cent rounding; existing rates/caps are unchanged. Caps describe selected records, not remaining entitlement. Work is not an eligibility determination.
- Annual logbook results use full-year records and complete representative evidence under the established validity window; unsupported/partial/filter combinations explain unavailability. Invalid odometer records or percentages above 100% are not presented as supported annual estimates.
- Provenance/manual evidence remains in CSV and print. Full-account JSON is unchanged; filtered JSON is optional future backlog only.
- Empty states, mobile reporting and synthetic boundary/export regressions are included. No database, schema-version, Auth or routing change; no live environment verification required for this frontend task.

## Refine backlog and operational risks

Completed: first-trip simplification (#14 PR), trip clarity/evidence presentation (#15 PR), classification (Task #12 / PR #16), persisted provenance/manual evidence (Task #13 / PR #17). Task numbers and PR numbers are distinct.

Next priorities: (1) financial-year reporting UX and screen/export reconciliation; (2) reusable vehicle profiles; (3) immutable corrections/audit history; (4) focused onboarding, accessibility/mobile polish and trust improvements. Only Task #14 is the recommended next product task; the remainder is directional, not authorised work.

Operational risks: **PARTIALLY VERIFIED** recovery (application restore exercised, complete managed Auth/Storage/Vault runtime not reproduced); staging Worker deployment guard [#20](https://github.com/Santana-Co/Travel-Log/issues/20); production Auth/signup diagnostics; missing central monitoring/health checks; incomplete rule-source/version metadata. Do not fold them into unrelated product work.

Use [technical debt](../engineering/TECHNICAL_DEBT.md), [roadmap](../product/PRODUCT_ROADMAP.md), [architecture](../engineering/ARCHITECTURE.md) and [decisions](../decisions/DECISIONS.md) only when relevant. Some deeper documents retain schema-v5 **candidate** wording; this handover records its completed release. Do not re-audit the release to resolve that known editorial lag.
