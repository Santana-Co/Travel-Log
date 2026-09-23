# Travel Log Architecture

## Status and scope

This document describes the schema-v5 distance-provenance release candidate. Production and staging currently operate on version 4 until a separately approved database-first release; this document does not claim that version 5 is deployed. The routing Worker is separately maintained; only its checked-in client contract and repository operational guidance can be verified here.

## System overview

Travel Log is a dependency-light static browser application. GitHub Pages serves production assets. Browser JavaScript communicates directly with Supabase Auth, PostgREST, and RPCs, and calls a protected Cloudflare Worker for route distance. There is no repository-owned application server, framework, bundler, or server-rendering layer.

```mermaid
flowchart LR
    U[User browser] -->|HTML CSS JavaScript| GP[GitHub Pages production]
    U -->|Sign-in and session| A[Supabase Auth]
    U -->|PostgREST and RPC with JWT| D[(Supabase Postgres)]
    U -->|POST /distance with JWT| W[Cloudflare routing Worker]
    W -->|Validate identity| A
    W -->|Route request| R[External routing provider]
    U -->|Open route link| G[Google Maps]
    CP[Cloudflare Pages staging/previews] -->|Isolated build| U
```

## Repository responsibilities

- `index.html`, `styles.css`, `theme.js`: application shell, forms, responsive styling, and theme persistence.
- `app.js`: authentication/session orchestration, rendering, Supabase data access, trip/account workflows, routing requests, and exports.
- `logic.js`: testable validation, filtering, dates, totals, recording-mode behaviour, and Australian calculations.
- `report.html`, `report.css`, `report.js`: printable report view.
- `config.js`: public production browser endpoints and publishable Supabase key; it must never contain privileged secrets.
- `supabase/`: bootstrap schema and ordered repository-owned migrations.
- `scripts/build-staging.cjs`: isolated staging build and production-endpoint guardrails.
- `tests/`: credential-free Node tests, an isolated Playwright browser baseline, and an explicitly configured live Supabase integration suite.
- `.github/`: App checks, CodeQL, Dependabot, and the PR checklist.

## Browser responsibilities

The browser renders authentication, dashboard, trip, account, saved-location, logbook, annual-odometer, privacy, and report workflows. It maps database rows to UI models, performs client-side validation/calculation, sends authenticated CRUD/RPC requests, obtains a session token for routing, creates Google Maps links, and generates client-side exports.

Client checks improve UX but are not a security boundary. `app.js` remains a large orchestration module and is intentionally documented as technical debt rather than refactored here.

## Supabase, authentication, and sessions

Supabase provides email/password identity and recovery, persistent sessions, PostgREST, PostgreSQL integrity/RLS, profile creation, and three public RPC contracts:

- `get_app_schema_version()` for authenticated compatibility checks;
- `accept_privacy_notice(text)` for the caller's profile;
- `delete_my_account()` for recently reauthenticated callers.

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as Supabase Auth
    participant D as Postgres/PostgREST
    B->>A: Sign up or sign in
    A-->>B: Session and JWT
    B->>D: get_app_schema_version()
    D-->>B: Current database version
    alt version is valid and >= browser minimum
        B->>D: Load caller profile
        B->>D: Accept privacy notice if required
        B->>D: Load caller-owned records
    else missing, invalid, old, or RPC error
        B-->>B: Show compatibility state and block normal loading
    end
```

The repository release target and browser minimum are **5**. Deployed production and staging remain at **4** until release execution. `app.js` rejects only when the returned version is invalid or lower than the minimum; future versions greater than 5 remain accepted. Schema 5 must be applied and verified before this browser is deployed.

## Conceptual data model

| Resource | Purpose | Ownership/integrity |
|---|---|---|
| `auth.users` | Supabase identity | Managed by Supabase Auth |
| `profiles` | Name, privacy acceptance, theme, recording mode | `id` equals authenticated user ID |
| `trips` | Intent classification, calendar dates, ordered route, distance and current provenance, purpose/project, claim/rate, vehicle/odometer, notes | `user_id`; classification and provenance are constrained; manual distance requires a reason; `stops` is canonical JSONB ordered string array |
| `saved_locations` | Private label/address suggestions | `user_id` |
| `logbook_periods` | Representative vehicle logbook periods | `user_id` |
| `logbook_income_years` | Annual odometer records | `user_id`; composite foreign key enforces same-owner logbook link |
| `private.app_schema_state` | Current application schema version | No direct browser table access |

PostgreSQL constraints enforce important date ranges, odometer relationships, lengths, reasonable distance/rate limits, JSON-array shape, logbook duration, and same-owner relationships.

## Tenant ownership and RLS

RLS is enabled on all five application-owned tables. Authenticated policies compare `auth.uid()` with `user_id` (or profile `id`) for the permitted CRUD operations; anonymous table privileges are revoked. Public RPC wrappers have narrow grants and call restricted private helpers where privileged execution is required.

The live staging integration suite uses two synthetic authenticated users and covers own/cross-user select, insert, update, ownership reassignment, delete, composite ownership, privacy acceptance, schema version, and account deletion. It previously completed 40 authenticated isolation subtests within 41 total passing integration tests with no successful cross-user access. The suite is opt-in and refuses the known production project.

## Trip lifecycle

1. `openForm()` prepares a new, duplicate, or existing trip. New general trips initially show the essential date, route, and distance path; optional evidence/reporting fields are progressively disclosed. Existing, duplicated, and mode-specific trips reveal their relevant detail fields immediately.
2. New and duplicate dates use device-local `tripCalendarDates()` defaults; edit retains stored dates.
3. New/duplicated trips require an explicit Work or Personal choice. Historical rows migrate to Unclassified and remain editable without forced reclassification.
4. The user supplies ordered addresses/stops, purpose, distance or odometers, and optional reporting fields. A route response records `route_calculated`, direct distance entry records `manual` with a reason, and logbook odometers record `odometer`.
5. `validateTrip()` checks domain rules without converting calendar dates through UTC ISO strings. Trip-form failures are shown inline and focus the first invalid field without discarding entered values.
6. `toDatabase()` maps to database columns and includes the signed-in user ID.
7. PostgREST performs insert/update/delete; RLS and constraints enforce server-side ownership and integrity.
8. The browser reloads and renders the user's records. Deletes require confirmation.

Classification records the user's stated trip intent; it does not establish tax deductibility, ATO eligibility, or employer reimbursement. General displayed-distance totals include the filtered set and are labelled accordingly. Financial/reimbursement estimates and representative-logbook business kilometres include only explicitly Work trips; Personal and Unclassified trips remain visible and exportable but are conservatively excluded.

Trip cards prioritise the date, total distance, journey direction, and round-trip state. A native details disclosure shows persisted current distance provenance as Route calculated, Entered manually, From odometer, or Not recorded. Manual records include the constrained reason and optional short note. Schema-v5 migration marks every pre-existing row `unknown`; it never guesses history from old field combinations.

Unrelated edits preserve provenance. Recalculation, manual replacement, or odometer recording deliberately replaces the current provenance. Duplication conservatively records the copied value as manual with reason `copied_from_trip`; it does not claim a new route calculation or copy stale evidence. Edits still overwrite the row: this is current provenance, not immutable trip-change history.

## Distance and address flows

```mermaid
sequenceDiagram
    participant U as User
    participant B as Browser
    participant A as Supabase Auth
    participant W as Cloudflare Worker
    participant P as Routing provider
    U->>B: Enter start, ordered stops, destination
    B->>A: Get current session
    A-->>B: Access token
    B->>W: POST /distance with bearer token
    W->>A: Validate caller
    W->>P: Resolve route and distance
    P-->>W: Route result
    W-->>B: distanceKm or bounded error
    B-->>U: Populate editable distance
```

The Worker is a trust and privacy boundary because it receives user tokens and route addresses. Operational documents say it restricts origins, validates users, rate-limits, and keeps the routing-provider key outside the browser; its implementation is not in this repository.

Address assistance currently comes from the signed-in user's `saved_locations` rendered through an escaped HTML `datalist`. Current `main` contains no remote `/suggest` autocomplete flow.

## Australian rules and calculations

`logic.js` contains financial-year selection, effective-year ATO cents-per-kilometre rates from 2015–16, unpublished-future-year refusal, the 5,000 work-kilometre cap per vehicle and income year, claim summaries, logbook duration/validity/business percentage, annual estimates, and recording-mode preservation. Unit tests cover important boundaries. Explicit rule IDs and authoritative-source metadata are still missing.

These are estimates and record-keeping aids, not personalised tax advice.

## Reporting and exports

- CSV includes stable provenance/reason values and protects cells against spreadsheet-formula execution.
- JSON account export includes current provenance through the trip model, the profile and all four related resource collections plus a UTC generation timestamp.
- Print/PDF shows human-readable distance evidence; its same-origin `sessionStorage` payload is consumed/removed by `report.html`.
- Google Maps route links provide external route viewing; they do not persist calculated distance.

Downloads and printed files leave Travel Log's control. Automated browser-level report reconciliation remains limited.

## Environments, migrations, and recovery

| Concern | Production | Staging/previews |
|---|---|---|
| Static hosting | GitHub Pages from `main` | Cloudflare Pages generated build |
| Supabase | Production project | Separate staging project |
| Routing | Production Worker | Separate staging Worker configuration required |
| Client config | Committed public `config.js` | Build environment variables |
| Safety UI | Live label | Persistent staging banner and `noindex` |

The staging builder refuses production endpoints, privileged-looking credentials, non-HTTPS URLs, and missing configuration. A successful build or preview does not by itself prove the staging Worker is active; that remains an operational verification gap.

`supabase/migrations.json` owns migration order. Production and staging are verified at schema 4. Schema 5 is additive and database-first: old schema-4 clients ignore the new defaulted columns, while the schema-5 browser must wait until each database is migrated. Production migration work follows preflight, recovery-point, encrypted connection, staging-first, post-migration verification, and synthetic-test discipline.

A private logical production backup was checksum-verified and restored to disposable PostgreSQL 17; application schema/data and reconciliation behaviour were validated. Recovery remains **PARTIALLY VERIFIED** because managed Supabase Auth, Storage, Vault, and related runtime were not fully reproduced. Restore-to-clean-database is preferred over an ambiguous in-place reverse migration.

## CI, dependencies, and trust boundaries

- GitHub Actions runs `npm test` and the isolated Chromium critical-flow baseline with Node 24 for PRs and `main`.
- CodeQL scans JavaScript on PRs, `main`, and weekly; Dependabot checks npm and Actions weekly.
- The browser loads pinned `@supabase/supabase-js` 2.112.3 from jsDelivr with SRI.
- External services are Supabase, GitHub Pages/Actions, Cloudflare Pages/Worker, the routing provider, Google Maps, and jsDelivr.
- Public endpoints and publishable keys are visible by design; service-role/database/routing-provider secrets must not enter browser assets.
- Browser input is untrusted. Supabase RLS/constraints are the data security boundary.
- Route addresses cross the Worker/provider boundary; report payloads briefly enter `sessionStorage`; exports leave application control.

The browser baseline serves real application assets, substitutes deterministic synthetic Supabase/configuration/routing boundaries, and blocks unexpected non-loopback requests. It covers authenticated startup, schema compatibility, classification, current distance provenance, conservative totals, CSV/JSON/print output, the essential-first trip flow at desktop/mobile widths, CRUD/duplication, and Brisbane-local dates. Broader auth, accessibility, and multi-browser coverage remains outside this narrow baseline. There is no lint/type-check command, production error monitor, or automated application/routing/schema health check.

## Calendar dates and timestamps

Trip dates, logbook periods, and filters are calendar dates represented as local `YYYY-MM-DD` and PostgreSQL `date`. Device-local defaults must not use `toISOString().slice(0, 10)`. Actual instants—creation/update, privacy acceptance, and export/report generation—use UTC ISO strings or PostgreSQL `timestamptz`. Intentional UTC arithmetic is used for whole-day logbook spans so DST-hour changes do not alter day counts.

## Business-logic locations

- `logic.js`: reusable domain rules, validation, dates, filters, and calculations.
- `app.js`: browser workflow, rendering, mapping, persistence, auth, routing, and exports.
- Supabase migrations: ownership, integrity, RPCs, deletion, and compatibility.
- `report.js`: report rendering and report-facing calculations.

This split is partial; future extraction should be incremental and protected by browser-flow tests.
