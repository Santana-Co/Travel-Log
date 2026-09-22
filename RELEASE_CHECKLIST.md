# Travel Log release checklist

Use this checklist for every production release.

## Routine release

- Run `npm test` locally and confirm the GitHub **App checks** workflow passes.
- Confirm no API secret, service-role key, password, or personal test data is committed.
- Test sign-in, adding and editing a trip, distance calculation, reports, and sign-out.
- Confirm the GitHub Pages deployment succeeds after merge.

## Major release or authentication/data change

- Deploy the pull request to the isolated Cloudflare Pages staging environment.
- Apply new migrations to staging first and confirm its schema version.
- Complete `STAGING_SMOKE_TEST.md` with a staging-only account and synthetic data.
- Confirm staging never references the production Supabase project or routing Worker.
- Do not apply the production migration or merge until staging passes.

## Release with a Supabase schema change

1. Add an additive, repeatable migration in `supabase/`. Do not delete or rename production columns in the same release.
2. Increase the browser's `requiredSchemaVersion` in `app.js` only if the browser release depends on the new schema. It is a minimum supported database version and may remain lower during a compatible staged rollout.
3. Add the migration once at the end of `supabase/migrations.json` and increase its `schemaVersion` when the migration establishes a new application contract.
4. Have the final migration set `private.app_schema_state` to that same version only after all dependent schema changes succeed. Historical version migrations remain immutable.
5. If the existing browser minimum remains compatible, merge the repository-owned migration before applying it to production. Apply and verify the production migration before deploying any browser release whose `requiredSchemaVersion` depends on it.
6. Verify the contract in the SQL Editor:

   ```sql
   select public.get_app_schema_version();
   ```

7. Confirm the returned database version equals `migrations.json.schemaVersion` and is greater than or equal to the browser's `requiredSchemaVersion`, then test the pull request and merge it.

If the database update is missing or temporarily unreachable, the app shows a safe compatibility message instead of attempting queries against the wrong schema. Existing records are not changed by that screen.
