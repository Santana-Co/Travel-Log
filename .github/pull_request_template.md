## Summary

Describe the user-visible change and its reason.

## Release checks

- [ ] `npm test` passes locally and in GitHub Actions.
- [ ] No secrets or personal test data are included.
- [ ] Sign-in and the changed workflow were tested.
- [ ] This change has no Supabase schema change, **or** the migration is repository-owned and the deployed browser remains compatible; production is migrated before any browser release that depends on the new schema.
- [ ] For a schema change, `migrations.json` and `schema-version-migration.sql` identify the same current database version; `requiredSchemaVersion` is no greater than that version and is increased only when the browser depends on the new schema.
