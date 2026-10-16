# Travel Log — Milestone Index

Newest first. Significant completed work only, not a commit/session diary. Read only the relevant entry when history is needed; [CURRENT_STATE.md](CURRENT_STATE.md) is the consolidated handover and [RELEASE_STATE.md](RELEASE_STATE.md) is the operational snapshot.

## Task #13C — Credit-efficient handover (prepared for review, 17 October 2026)

Consolidated project/release state, a short checkpoint and relevance-based context/test rules replace routine historical rediscovery. Documentation only; no deployed behaviour changed. The unfinished local Task #14 draft was preserved separately and paused, not included in this handover change.

## Task #13 — Distance provenance / schema 5

Persisted `route_calculated`, `manual`, `odometer`, `unknown` and manual evidence. Historical records became unknown without inference; unrelated edits preserve it; copied distances use manual / copied_from_trip. Staging and production gates, real routing, old-client compatibility, deployed smoke and exact cleanup completed. [PR #17](https://github.com/Santana-Co/Travel-Log/pull/17), merge `c65b1c86ed1db2c7df7e242207837297ecd39536`. Recovery remains PARTIALLY VERIFIED; staging deployment safeguard is separate [issue #20](https://github.com/Santana-Co/Travel-Log/issues/20).

## Task #12 — Classification / schema 4

Work / Personal / Unclassified deployed with conservative Work-only estimates and export/filter support. Historical records became Unclassified without inference. [PR #16](https://github.com/Santana-Co/Travel-Log/pull/16), merge `d17e550f9f325e8dc7a4b70cd6bc40e08292e900`.

## Trip clarity and evidence presentation

Route-first cards clarify From/Destination, recorded total, journey type and expandable supporting details. [PR #15](https://github.com/Santana-Co/Travel-Log/pull/15); current persisted provenance subsequently replaced inferred/placeholder presentation in Task #13.

## Task #11 — First-trip simplification

Essential-first trip entry, progressive optional fields, inline validation/recovery, clearer manual-distance fallback and duplication messaging. [PR #14](https://github.com/Santana-Co/Travel-Log/pull/14).

## Stage 0 closure / Task #9 browser baseline

Isolated real-asset browser critical-flow tests run locally and in CI with synthetic backend data and no live production/staging access. [PR #13](https://github.com/Santana-Co/Travel-Log/pull/13) closed the last Stage 0 blocker after the formal exit review. **Stage 0 COMPLETE; Refine began.**

## Tasks #6–7 — Local dates and repository documentation

Device-local new/duplicate trip dates, preserved edit dates and Australian boundary regressions ([PR #11](https://github.com/Santana-Co/Travel-Log/pull/11)); repository-owned strategy, architecture, debt and engineering guidance restored ([PR #12](https://github.com/Santana-Co/Travel-Log/pull/12)).

## Tasks #3–5 — Isolation, production reconciliation and schema 3

Two-user tenant-isolation tests and corrected account deletion ([PR #8](https://github.com/Santana-Co/Travel-Log/pull/8)); separate production drift reconciliation established ordered JSONB stops and canonical schema structure ([PR #9](https://github.com/Santana-Co/Travel-Log/pull/9)). Schema 3 was released database-first, then browser minimum enforcement deployed ([PR #10](https://github.com/Santana-Co/Travel-Log/pull/10)). Logical backup/disposable application restore established **PARTIALLY VERIFIED**, not full managed-platform, recovery.
