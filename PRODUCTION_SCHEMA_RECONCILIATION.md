# Production schema reconciliation

This note records the verified production reconciliation and recovery baseline that preceded Travel Log's release to application schema version 3. It contains no credentials or user data.

## Why reconciliation is required

Before reconciliation, production reported application schema version 2 while parts of its manually evolved schema differed from the repository bootstrap schema and schema-version-3 staging database:

- `profiles.updated_at` and the 120-character full-name constraint are absent.
- `trips.stops` is `text[]` rather than the canonical JSONB ordered string array, and the JSON-array constraint is absent.
- Six legacy profile/trip ownership policies duplicate the canonical ownership policies.
- A legacy profile-creation trigger and `SECURITY DEFINER` function coexist with the canonical signup trigger.
- Two single-column trip indexes duplicate coverage provided by the canonical user/date index.

The canonical representation for `trips.stops` is JSONB containing an ordered array of strings. This matches the repository schema, staging, and the browser's ordered JavaScript array model. Production analysis found 14 non-null arrays containing 12 total entries; all passed the reconciliation migration's shape, length, and element checks.

## Recovery evidence and limitation

A private PostgreSQL custom-format logical backup was created on 7 September 2026. Its SHA-256 checksum was reverified before use. The backup restored into a disposable PostgreSQL 17 server with matching application row counts, constraints, indexes, grants, RLS policies, and representative function definitions.

The restore reproduced the Travel Log application schema and data. It did not fully reproduce managed Supabase Vault, Auth, Storage, or Realtime runtime behaviour. Recovery therefore remains **PARTIALLY VERIFIED**, not a full Supabase-platform recovery verification.

The reconciliation migration was applied to the disposable production restore and then applied again successfully to confirm idempotence. Application row counts and privacy-safe data fingerprints were preserved. A second clean restore of the original backup reproduced the pre-reconciliation schema and matching application-data fingerprints.

## Execution outcome and reusable order

The repository-owned reconciliation was merged and applied after a fresh identity/schema/data preflight and backup checksum verification. Production row counts and ownership identifiers were preserved; `trips.stops` became canonical JSONB; intended constraints, indexes, triggers/functions, grants, RLS, and policies were verified; and the application schema remained version 2 during its compatibility smoke test. The separate account-deletion/schema-version migration was then applied and verified, followed by browser minimum-version enforcement. Production, staging, the repository manifest, and the current browser minimum now report or require version 3.

Future production migrations should reuse the same order: merge the repository-owned migration while compatibility permits, repeat preflight and recovery checks immediately before execution, apply only the approved SQL over a migration-safe encrypted connection, verify data and security boundaries, then deploy any dependent browser minimum increase.

## Rollback strategy

The preferred rollback is restore-to-clean-database from the verified logical backup, followed by application-data and security verification before traffic is redirected. An in-place reverse migration is not preferred because converting arbitrary JSONB back to `text[]` and recreating historical duplicate objects would add avoidable ambiguity.

If the reconciliation migration encounters an unexpected schema, policy, trigger, index, or stop value, its preconditions raise an exception and the enclosing transaction rolls back rather than partially reconciling production.
