# Travel Log Product Roadmap

> Living roadmap. The repository and verified deployed state are the source of truth; roadmap entries are not implementation claims.

## Strategy and current position

The product sequence is **Build → Refine → Validate → Commercialise → Scale → Mobile → Expand**. Capabilities from several later stages already exist, but stage progress is determined by exit criteria rather than feature count.

Stage 0 is complete: repository-owned documentation, tenant-isolation testing, schema reconciliation, account-deletion correction, schema-version alignment, local-date handling, recovery baselining, and an isolated browser critical-flow test are in place. The product is now in **Refine**; remaining foundation limitations stay tracked as technical debt rather than reopening Stage 0.

## Stage 0 — Repository baseline and architecture

**Goal:** make the implemented system, risks, commands, and decisions understandable and safely changeable.

Exit criteria:

- Current architecture, roadmap, decisions, standards, and debt are repository-owned.
- Critical defects and security risks have tracked remediation.
- Local startup and build/test commands are reproducible to the extent credentials and external services allow.
- Automated coverage is sufficient for safe structural change.

**Assessment:** complete. See [technical debt](../engineering/TECHNICAL_DEBT.md) for residual risks that continue into Refine.

## Stage 1 — Build: dependable core web workflow

Implemented: authenticated trip create/read/update/delete and duplication; local calendar dates; ordered stops; addresses and saved locations; manual or routed distance; round trips; purpose/project/notes; per-trip vehicle fields; validation; search/date/client filters; totals.

Missing or incomplete: explicit work/personal classification, journey time, manual-distance correction reasons/audit evidence, selectable sorting, dedicated financial-year filtering, reusable vehicle profiles, and automated mobile-width workflow coverage.

Exit: reliable persistence and validation, protected destructive actions, strong desktop/mobile behaviour, and trustworthy primary trip workflows.

## Stage 2 — Build: reporting and evidence

Implemented: filtered CSV, JSON account export, printable/PDF-oriented report, calculation summaries, and formula-safe CSV cells.

Missing or incomplete: work/personal totals, richer grouping, audit history, and automated reconciliation across screen, CSV, JSON, and print output.

Exit: understandable accountant/employer outputs whose totals and evidence can be reproduced and tested.

## Stage 3 — Build: Australian rules layer

Implemented: financial-year selection, effective-year ATO cents-per-kilometre rates, 5,000 km caps, unpublished-year refusal, representative-logbook calculations, and boundary tests in `logic.js`.

Missing: explicit rule IDs, authoritative-source metadata, publication/version traceability, and applied-rule metadata in exports.

Exit: versioned and sourced rules, stable historical calculations, and clear explanations. Outputs remain estimates and record-keeping support, not personalised tax advice.

## Stage 4 — Refine the web experience

Improve information architecture, entry speed, onboarding, responsive behaviour, accessibility, keyboard use, error recovery, confirmations/undo, visual consistency, and performance. A new user should create a correct first trip and understand totals without documentation.

In progress: the first-trip form now prioritises date, start, destination, distance, and save; progressively reveals optional detail; and provides inline validation recovery. Broader onboarding, accessibility, reporting, and polish work remains.

## Stage 5 — Refine the SaaS foundation

Implemented: Supabase Auth, private persistence, five RLS-protected user tables, account export/deletion, privacy surfaces, separated staging configuration, live two-user tenant-isolation tests, production schema reconciliation, and a disposable PostgreSQL restore exercise.

Remaining: formal location-data threat model, broader browser auth/data coverage, monitoring and health checks, a verified full managed-Supabase recovery procedure, and clearer operational evidence/cadence. Recovery is **PARTIALLY VERIFIED** because managed Auth, Storage, Vault, and related runtime were not reproduced.

## Stage 6 — Validate

Run structured discovery and a closed web pilot with target Australian users. Measure activation, repeated trip recording, report use, errors, support burden, retention, and willingness to pay using privacy-conscious instrumentation. Segment, pricing, conversion, and retention expectations are hypotheses until validated.

## Stage 7 — Commercialise the web product

Add only validated commercial foundations: plans, billing, entitlements, cancellation/failure handling, support/admin tooling, legal review, privacy-aware analytics, monitoring, feedback, feature flags, and repeatable releases.

Exit: users can discover, register, use, pay, cancel, export, and delete safely; service health and support are operationally manageable.

## Stage 8 — Scale and automation

Candidates include recurring routes, improved address assistance, user-confirmed suggestions, reminders, duplicate detection, and calendar-assisted workflows. Saved locations and manual duplication already exist. Automatic trip detection and remote autocomplete are not implemented in current `main`.

Scale only after retention and operating economics justify added complexity.

## Stage 9 — Mobile

Native iOS/Android follows stable backend contracts, validated responsive-web workflows, observability, privacy design, commercial evidence, and a justified need for native capabilities such as background location, offline capture, or push reminders. Do not duplicate Australian rules independently across clients.

## Stage 10 — Expand

Potential later directions include employer reimbursement and approval flows, payroll/accounting exports, organisations and roles, accountant access, APIs/webhooks, enterprise controls, additional countries/rulesets, and evidence-backed automation. These are opportunities, not commitments.

## Prioritisation rule

Prefer the smallest task that improves trust, repeated use, conversion evidence, revenue readiness, or operational safety at the current stage without creating premature maintenance burden.
