# Travel Log — Release State

Latest known operational baseline, updated **2 November 2026** after user-confirmed Task #15C manual production verification and cleanup. Schema-6 migration/backup/preservation and Task #15A staging results are accepted release evidence; those gates were not repeated. The deployed frontend is PR #24, merge `f0b98b5f36a4946d8b4622a8b831ba47ebfb5994`.

| Environment | Application schema | Browser minimum | Last verified status |
|---|---|---|---|
| Production | **6** | **6** | Task #15A/#15B/#15C COMPLETE; PR #24 deployed; all 12 manual production checks and cleanup confirmed by user |
| Staging | **6** | **6** for the approved Task #15 candidate preview | Task #15A accepted GO; 47/47 integration tests passed |

- Latest material frontend release: [PR #24](https://github.com/Santana-Co/Travel-Log/pull/24), merge **`f0b98b5f36a4946d8b4622a8b831ba47ebfb5994`**. Merged-main App checks, CodeQL, GitHub Pages and Cloudflare passed. Public deployed `app.js` matches merged main and requires schema 6. The user confirmed the final manual production smoke passed; no automated browser result is claimed. The documentation-checkpoint Pages overlap was resolved by a successful retry.
- Production route/manual/duplication and historical unknown-source behaviour verified; exact synthetic account/owned-record cleanup completed. No active Task #13 release blocker.
- Staging safeguard: [issue #20](https://github.com/Santana-Co/Travel-Log/issues/20), restrict Worker deployment to its designated branch/environment. Separate operational work; do not point staging at production as a workaround.
- Recovery: **PARTIALLY VERIFIED**. Application schema/data restored into disposable PostgreSQL 17; managed Supabase Auth, Storage, Vault and complete service recovery not reproduced. Restore-to-clean-database is preferred; no private backup locations belong here.

## Compatibility and release discipline

### Task #15 COMPLETE — staging, production and frontend release gates passed

Repository target/browser minimum **6** adds only a private saved-vehicles table and schema metadata. Production and staging databases are **6**, and the deployed production browser minimum is now **6**. The schema-5 trip-write contract passed against schema 6; the candidate blocks schema 5 before loading user records. The prior production backup, migration, fingerprints and historical preservation gates passed; recovery remains **PARTIALLY VERIFIED**.

On 1 November, exactly two synthetic production Auth users were provisioned and authenticated normally. The scoped runner passed 83 assertions covering profile loading, trip create/read/edit/duplicate-equivalent/delete, vehicle own access, cross-user denial, spoofing rejection, protected ID/owner/timestamps, and own update/archive/restore. All application/RLS assertions used normal-user sessions. Admin credentials were used only for provisioning and cleanup. This API verification complements the previously accepted manual deployed-frontend smoke; it does not claim a new browser run.

Both synthetic sessions were signed out and both Auth users permanently deleted. Exact UUID/record-ID verification found zero artifacts across Auth, profiles, trips, saved locations, logbook periods, logbook income years and vehicles. Genuine user data was not modified. The temporary local credential file and empty directory were removed; no shared project key was rotated or revoked.

PR #24 merged from unchanged head `2cb95fcfa6d2def7e2bc47231cb99116589e411c`; migration SHA-256 remains `1edcc1bfb2d3fd835b3a860b91ea07cc39872f327758771a17eb49e845a34000`. No source/migration correction was needed. Task #15C merge/deployment passed. On 2 November the user confirmed all 12 manual production checks PASS, including vehicle management, selection, snapshot preservation after rename, duplication, manual entry, historical trips, classification/provenance, FY, ATO/logbook matching, CSV/print, JSON and mobile. The user confirmed cleanup COMPLETE, no test records remaining, no unusual behaviour and no edits to genuine historical trips. These final UI/cleanup results are user-reported; Codex did not independently rerun the browser or query production for this closure. Task #15B exact-identifier cleanup remains separately verified. The temporary production Auth credential remains absent. **Task #15A, #15B, #15C and Task #15 are COMPLETE.** Task #16 is not started. Review [the vehicle release plan](../engineering/VEHICLE_PROFILES_RELEASE.md). Frontend rollback can retain schema 6 and saved profiles; do not drop new user data automatically.

### Established schema-5 release

Browser minimum **5** accepts integer schema versions **>= 5**, and fails closed otherwise. The old schema-4 browser was verified against schema 5 before frontend release. That compatibility result is specific to this additive migration, not a blanket promise for future changes.

For a browser requiring a newer schema: freeze the candidate and migration checksum → fresh identity/schema/data preflight → private backup/recovery gate → staging-proven migration → verify old-client compatibility and ownership → exact synthetic cleanup → frontend **GO/NO-GO** → merge/deploy → post-deployment smoke and exact cleanup. Prove compatibility before choosing database-first; never assume it from this history. Fresh safety checks and action-specific production authority remain mandatory.

See [RELEASE_CHECKLIST.md](../../RELEASE_CHECKLIST.md) only when conducting a release. Update this file when deployed/environment facts materially change, not when a feature branch is merely implemented.
