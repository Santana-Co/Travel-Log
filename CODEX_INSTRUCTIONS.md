# Travel Log Codex Operating Instructions

## Credit & agentic efficiency — efficient context loading

Minimise unnecessary tokens, file reads, searches, commands and tool calls while completing the approved task correctly. Safety-critical verification must never be skipped solely to save credits.

Read this file, then use this order:

1. Read [CURRENT_STATE.md](docs/project/CURRENT_STATE.md), starting with **Current checkpoint**. This is the primary authoritative starting context for the latest consolidated product/engineering state, not a diary. Do not reconstruct completed work from source scans.
2. Read [RELEASE_STATE.md](docs/project/RELEASE_STATE.md) **only** for schema, migrations, compatibility, security boundaries, environments, deployment or release operations. Ordinary UI work does not require release-history inspection.
3. Read only the latest relevant entry in [CHANGELOG.md](docs/project/CHANGELOG.md) if historical context is actually needed. Do not read the entire changelog by default.
4. Inspect the minimum source, tests, schema and documentation directly required for the task. Prefer one targeted `rg` search over opening many files.

Treat recorded completed work as established context. Do not routinely scan every file, reread every document or migration, reconstruct Git history, reopen old PR details, re-audit architecture/RLS/schema releases, or rerun old production verification merely to prove those facts again. Do not investigate unrelated warnings, debt or possible improvements; note them briefly only when useful and remain within scope.

Re-verify affected facts when the task changes that subsystem, current source conflicts with the handover, concrete evidence suggests stale state, security boundaries change, a release/migration depends on exact environment state, production/staging is about to be modified, or another safety-critical assumption needs fresh evidence. Target the check to the affected fact. These documents are starting context, **not permission to skip safety gates**. Source is authoritative for implementation; dated release evidence describes deployed state; roadmaps are intentions, not proof.

Use the fewest reasonable tool calls. Do not create exploratory branches, worktrees, temporary scripts or parallel investigations unless necessary. Do not use production/staging, database, browser, GitHub or Cloudflare tools unless relevant; do not repeatedly query externally for facts available locally. Prefer the smallest coherent change, not scope expansion.

### Test efficiency

During implementation, run the smallest relevant tests first. At the final validation gate, run the full regression suite required by the task once; repeat only if subsequent changes could invalidate it. Security/release tasks may require additional checks. Documentation-only changes normally require link, scope, credential/path and whitespace checks, not application/browser test reruns. Do not weaken existing CI safeguards.

### Documentation ownership and completion updates

- `CURRENT_STATE.md`: latest consolidated product/engineering state, checkpoint and next work.
- `RELEASE_STATE.md`: latest known deployed/environment state and operational constraints, with evidence dates. Never record an unmerged change as deployed.
- `CHANGELOG.md`: concise significant completed milestones, newest first; not every commit or session.

At the end of a meaningful task, assess material changes to product, architecture, schema, deployment, security assumptions, tests, roadmap or operational risks. Update the checkpoint and affected portions of `CURRENT_STATE.md` when material; update `RELEASE_STATE.md` only for changed deployed/environment state; append one short milestone at the top of `CHANGELOG.md` when meaningful. Mark pending review/deployment honestly. Do not create documentation churn for trivial changes or force the next session to reconstruct the latest state from Git history.

Deeper references are loaded only when relevant: [vision](docs/product/PRODUCT_VISION.md), [roadmap](docs/product/PRODUCT_ROADMAP.md), [commercialisation](docs/product/COMMERCIALISATION_ROADMAP.md), [architecture](docs/engineering/ARCHITECTURE.md), [debt](docs/engineering/TECHNICAL_DEBT.md), [standards](docs/engineering/CODING_STANDARDS.md), [decisions](docs/decisions/DECISIONS.md), and applicable root operational guidance. Older release-candidate wording in those references does not override the dated deployed-state handover.

## Working rules

- Confirm the exact checkout, branch, status, and diff before editing, committing, pushing, or releasing.
- Inspect only the relevant implementation and tests; consult migrations, configuration or live state when the task or a safety gate requires them.
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
