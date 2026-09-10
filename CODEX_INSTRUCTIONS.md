# Travel Log Codex Operating Instructions

## Required context

Before significant implementation work, inspect the current worktree and read the documents relevant to the task:

1. [Product vision](docs/product/PRODUCT_VISION.md)
2. [Product roadmap](docs/product/PRODUCT_ROADMAP.md)
3. [Commercialisation roadmap](docs/product/COMMERCIALISATION_ROADMAP.md)
4. [Architecture](docs/engineering/ARCHITECTURE.md)
5. [Technical debt](docs/engineering/TECHNICAL_DEBT.md)
6. [Coding standards](docs/engineering/CODING_STANDARDS.md)
7. [Decision log](docs/decisions/DECISIONS.md)
8. Applicable root operational documentation

The current repository is the source of truth for implementation. Roadmaps describe direction, not proof that a capability exists.

## Working rules

- Confirm the exact checkout, branch, status, and diff before editing, committing, pushing, or releasing.
- Inspect the relevant code, migrations, tests, configuration, and deployed state before deciding that work is missing or complete.
- Implement the smallest coherent task and avoid unrelated refactoring or features.
- Preserve Supabase RLS and ownership checks. Authentication alone is not authorisation.
- Keep privileged keys, passwords, tokens, production data, and real personal/location test data out of browser code, logs, fixtures, documentation, and Git.
- Treat local calendar dates separately from timestamps. Do not derive a user's calendar day using `toISOString().slice(0, 10)`; retain UTC ISO timestamps for real instants.
- Do not silently change Australian rules, rates, limits, classifications, or reporting meaning. Verify authoritative sources and add boundary tests.
- Describe calculation and record-keeping features as estimates and evidence support, not personalised tax advice.
- Run the checks that actually exist and report exact results. Do not claim a deployment, integration test, restore, or production verification succeeded without evidence.

## Database and production changes

- Use repository-owned, ordered migrations as the canonical schema-evolution record.
- Keep the database schema version and browser minimum supported version distinct; the browser minimum must not exceed the deployed database version.
- Test migrations in isolated staging first.
- Immediately before a production migration, verify project identity, current schema/version, data assumptions, and drift.
- Establish and verify an appropriate recovery point before changing production.
- Use an encrypted, migration-safe connection and never expose credentials in arguments, output, history, or documentation.
- Stop on unexpected preconditions or SQL errors. Do not improvise around failed security or data checks.
- Verify schema, row/data preservation, RLS/policies, application behaviour, and cleanup after migration.
- Use synthetic identities for destructive production verification. Never modify or delete a real user's data for testing.

## Definition of done

Review scope and credentials, run applicable unit/static/integration/browser checks, update durable documentation when facts or decisions change, and report limitations and remaining risks. Stop when the approved task is complete. Never begin the next task without explicit approval.
