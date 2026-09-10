# Travel Log Product and Architecture Decision Log

Record only decisions that future contributors need. Dates reflect when the decision was established or formally recorded; they are not a complete project history.

## ADR-001 — Web-first before native mobile

**Date:** 2026-09-01
**Status:** Accepted

Build and commercially validate a robust responsive web product before native iOS/Android. Backend and domain contracts should remain reusable, but native-only complexity waits for evidence that it solves a validated need.

**Evidence:** [Product roadmap](../product/PRODUCT_ROADMAP.md), [commercialisation roadmap](../product/COMMERCIALISATION_ROADMAP.md).

## ADR-002 — Supabase RLS is the multi-tenant security boundary

**Date:** 2026-09-01
**Status:** Accepted

The static browser uses a public publishable key and user JWT to access Supabase directly. PostgreSQL constraints and RLS—not client filtering—enforce per-user ownership. Privileged RPCs must be narrowly granted and internally ownership-scoped.

**Consequences:** policy/RPC changes are security-sensitive and require structural tests plus live two-user isolation regression coverage.

**Evidence:** `supabase/*.sql`, `tests/integration/tenant-isolation.integration.cjs`.

## ADR-003 — Repository-owned migrations define schema evolution

**Date:** 2026-09-08
**Status:** Accepted

All database changes are represented as ordered, reviewable SQL in `supabase/migrations.json`. Staging verification, production preflight, recovery point, controlled execution, and post-migration verification precede dependent browser release.

**Evidence:** `supabase/migrations.json`, [release checklist](../../RELEASE_CHECKLIST.md), [production reconciliation](../../PRODUCTION_SCHEMA_RECONCILIATION.md).

## ADR-004 — `trips.stops` is an ordered JSONB string array

**Date:** 2026-09-08
**Status:** Accepted

The canonical representation is a non-null PostgreSQL JSONB array of strings whose order represents route order. Production `text[]` drift was converted through a fail-closed, data-preserving migration.

**Consequences:** clients must preserve order and migrations must validate array shape/elements rather than treating stops as an unordered set.

**Evidence:** `supabase/base-schema.sql`, `supabase/production-schema-reconciliation-migration.sql`.

## ADR-005 — Browser compatibility uses a minimum schema version

**Date:** 2026-09-09
**Status:** Accepted

The repository/current database version and browser minimum supported version are distinct release values. Startup fails closed for missing, invalid, errored, or lower versions. A database version greater than the browser minimum remains accepted.

**Consequences:** compatible database migrations may precede browser enforcement; the browser minimum must never exceed production.

**Evidence:** `app.js`, `supabase/schema-version-migration.sql`, `supabase/migrations.json`, `tests/schema-contract.test.cjs`.

## ADR-006 — Production migration requires preflight, recovery, and verification

**Date:** 2026-09-08
**Status:** Accepted

Before production SQL, confirm target identity, schema/version, drift/data assumptions, encrypted migration-safe connectivity, and a verified recovery point. Stop on failed preconditions. Afterward verify data preservation, constraints, RLS/policies, RPCs, compatibility, and application behaviour.

Restore-to-clean-database is preferred to an ambiguous in-place reverse migration. Current recovery confidence is **PARTIALLY VERIFIED** because the disposable PostgreSQL exercise did not recreate the complete managed Supabase runtime.

**Evidence:** [production reconciliation](../../PRODUCTION_SCHEMA_RECONCILIATION.md), [release checklist](../../RELEASE_CHECKLIST.md).

## ADR-007 — Destructive production verification uses synthetic identities

**Date:** 2026-09-08
**Status:** Accepted

When destructive production verification is explicitly approved, create a dedicated synthetic identity and records, affect no real-user data, and prove zero test artifacts remain. Ordinary smoke tests should be read-only or close forms without saving.

**Evidence:** [Codex instructions](../../CODEX_INSTRUCTIONS.md), `tests/integration/tenant-isolation.integration.cjs`.

## ADR-008 — Calendar dates are not timestamps

**Date:** 2026-09-09
**Status:** Accepted

User calendar days use device-local `YYYY-MM-DD` values/PostgreSQL `date`; actual instants use UTC ISO values/`timestamptz`. Local defaults must not use `toISOString().slice(0, 10)`.

**Evidence:** `logic.js`, `tests/logic.test.cjs`.

## ADR-009 — Australian rules must be versioned and traceable

**Date:** 2026-09-01
**Status:** Accepted direction; partially implemented

Rates, limits, effective dates, authoritative sources, and applied versions belong in an explainable rules layer rather than scattered UI constants. Existing year-based rules and boundary tests are a partial implementation; source/version metadata remains debt.

**Evidence:** `logic.js`, [TL-DEBT-006](../engineering/TECHNICAL_DEBT.md).

## ADR-010 — Record keeping and estimates are not personalised tax advice

**Date:** 2026-09-01
**Status:** Accepted

Travel Log may record evidence and explain generic calculations, but must not present outputs as personalised tax advice or eligibility determinations. Users remain responsible for their circumstances and authoritative professional guidance.

**Evidence:** `ato-guide.html`, `index.html`, `report.js`.
