# Travel Log Engineering Standards

## Scope and architecture

- Prefer the smallest coherent change and preserve existing safe conventions.
- Keep domain calculations out of presentation code where practical; improve the current plain-JavaScript separation incrementally rather than introducing a framework or rewrite without evidence.
- Treat browser input and external responses as untrusted.
- Record durable architecture/product decisions in [DECISIONS.md](../decisions/DECISIONS.md).

## Australian rules

- Do not scatter rates, limits, or time-sensitive rules through UI code.
- Verify authoritative sources before changing rules; retain effective dates, source/version metadata, and historical reproducibility.
- Test financial-year, cap, logbook, invalid-input, and unpublished-year boundaries.
- Present calculations as estimates and record-keeping support, not personalised tax advice.

## Calendar dates and timestamps

- Treat a user calendar date and an instant as different domain values.
- Calendar dates use device-local `YYYY-MM-DD` components and PostgreSQL `date`.
- Never derive a local calendar day with `toISOString().slice(0, 10)`.
- Use UTC ISO values/PostgreSQL `timestamptz` for actual instants such as creation, update, consent, and export timestamps.
- Document intentional UTC arithmetic used to count calendar-day spans across DST changes.

## Database and release safety

- Use additive, repeatable, repository-owned migrations in `supabase/migrations.json` order.
- Keep the current database schema version separate from the browser minimum. The minimum must never exceed the deployed database version.
- Apply and verify schema changes in isolated staging before production.
- Before production migration, verify identity/version/data assumptions and an appropriate recovery point; stop on failed preconditions.
- Avoid destructive column/table changes unless explicitly designed, backed up, tested, and approved.
- Enforce ownership and important integrity rules in PostgreSQL, keep RLS enabled, and retain live multi-user regression coverage.
- Verify application data, policies, constraints, and smoke behaviour after migration.

## Security and privacy

- Never commit service-role keys, passwords, database connection secrets, production exports, or real personal/location test data.
- Publishable browser keys and public endpoints are not privileged secrets; never confuse them with service-role or provider keys.
- Authentication is not authorisation. RLS/server-side code must enforce ownership.
- Review any `SECURITY DEFINER` function, public RPC grant, policy, view, or ownership mutation carefully.
- Escape user-controlled HTML, protect CSV cells from formula execution, preserve CSP/SRI, and use HTTPS.
- Avoid sensitive addresses and identity data in logs, analytics, fixtures, screenshots, and monitoring.
- Use synthetic users/records for destructive production verification and clean them up. Never test destructive flows with real-user data.

## Testing

Bug fixes need regression tests. New behaviour needs proportional unit, static/contract, integration, and browser verification based on risk.

Baseline:

```sh
npm test
```

Live tenant-isolation testing is separate and staging-only:

```sh
npm run test:integration
```

Follow [the integration-test guide](../../tests/integration/README.md). Never claim lint, type checking, live integration, staging, production, accessibility, or browser coverage passed unless the check exists and was run.

## Frontend, APIs, and dependencies

- Use semantic controls, keyboard-complete interactions, responsive layouts, and clear loading/empty/error/success states.
- Confirm or make recoverable destructive actions.
- Validate API input/output and design bounded timeouts, retries, fallbacks, rate limits, quotas, and costs deliberately.
- Never trust client-calculated privileged values or put provider secrets in client code.
- Before adding a dependency, assess need, maintenance, licence, security, and browser cost. Pin browser CDN dependencies and use SRI where practical.

## Observability

Measure before optimising. Evolve toward privacy-safe monitoring of app availability, compatibility, route latency/failures, and third-party errors. Do not log credentials or unnecessary user/location data.

## Workflow and definition of done

Read [CODEX_INSTRUCTIONS.md](../../CODEX_INSTRUCTIONS.md), confirm the worktree, inspect implementation, keep scope narrow, update relevant documentation, run checks, review the staged diff, and use the PR/release checklists. A change is done only when requirements, relevant tests, security/privacy review, migration/recovery needs, documentation, and reported limitations are addressed.
