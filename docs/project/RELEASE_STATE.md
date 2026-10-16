# Travel Log — Release State

Latest known operational baseline, consolidated **17 October 2026** from accepted Task #13 release evidence and final cleanup checks through **16 October 2026**. This is not continuous monitoring; Task #13C performs no live environment checks.

| Environment | Application schema | Browser minimum | Last verified status |
|---|---|---|---|
| Production | **5** | **5** | Task #13 deployed and verified; release healthy; exact synthetic cleanup complete |
| Staging | **5** | **5** for the approved schema-v5 preview | Task #13A/13A.1 gates passed; isolated routing and reporting verified |

- Latest material release: [PR #17](https://github.com/Santana-Co/Travel-Log/pull/17), merge **`c65b1c86ed1db2c7df7e242207837297ecd39536`**. Merged-main App checks/browser tests, CodeQL, Pages and Cloudflare checks passed.
- Production route/manual/duplication and historical unknown-source behaviour verified; exact synthetic account/owned-record cleanup completed. No active Task #13 release blocker.
- Staging safeguard: [issue #20](https://github.com/Santana-Co/Travel-Log/issues/20), restrict Worker deployment to its designated branch/environment. Separate operational work; do not point staging at production as a workaround.
- Recovery: **PARTIALLY VERIFIED**. Application schema/data restored into disposable PostgreSQL 17; managed Supabase Auth, Storage, Vault and complete service recovery not reproduced. Restore-to-clean-database is preferred; no private backup locations belong here.

## Compatibility and release discipline

Browser minimum **5** accepts integer schema versions **>= 5**, and fails closed otherwise. The old schema-4 browser was verified against schema 5 before frontend release. That compatibility result is specific to this additive migration, not a blanket promise for future changes.

For a browser requiring a newer schema: freeze the candidate and migration checksum → fresh identity/schema/data preflight → private backup/recovery gate → staging-proven migration → verify old-client compatibility and ownership → exact synthetic cleanup → frontend **GO/NO-GO** → merge/deploy → post-deployment smoke and exact cleanup. Prove compatibility before choosing database-first; never assume it from this history. Fresh safety checks and action-specific production authority remain mandatory.

See [RELEASE_CHECKLIST.md](../../RELEASE_CHECKLIST.md) only when conducting a release. Update this file when deployed/environment facts materially change, not when a feature branch is merely implemented.
