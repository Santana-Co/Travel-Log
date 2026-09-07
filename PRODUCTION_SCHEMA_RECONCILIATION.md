# Production schema reconciliation

This note records the verified Task #4A baseline and the release order required before Travel Log advances production to database schema version 3. It contains no credentials or user data.

## Why reconciliation is required

Production currently reports application schema version 2, but parts of its manually evolved schema differ from the repository bootstrap schema and schema-version-3 staging database:

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

## Required production execution order

1. Review and merge the repository-owned reconciliation migration while the browser minimum and production database remain at schema version 2.
2. Immediately before execution, repeat the production identity, schema-version, schema-shape, and data preflight checks and confirm the private backup remains available and unchanged.
3. Apply only `supabase/production-schema-reconciliation-migration.sql` through an approved Supabase migration path.
4. Verify production row counts, stop-array conversion, constraints, indexes, triggers/functions, grants, RLS enablement, ownership policies, and `get_app_schema_version() = 2`.
5. Smoke-test the production browser while it still supports schema version 2.
6. Only after reconciliation is verified may the separate Task #4 schema-version-3/account-deletion migration resume.

Production has not yet been modified by Task #4A.

## Rollback strategy

The preferred rollback is restore-to-clean-database from the verified logical backup, followed by application-data and security verification before traffic is redirected. An in-place reverse migration is not preferred because converting arbitrary JSONB back to `text[]` and recreating historical duplicate objects would add avoidable ambiguity.

If the reconciliation migration encounters an unexpected schema, policy, trigger, index, or stop value, its preconditions raise an exception and the enclosing transaction rolls back rather than partially reconciling production.
