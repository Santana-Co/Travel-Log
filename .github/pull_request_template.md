## Summary

Describe the user-visible change and its reason.

## Release checks

- [ ] `npm test` passes locally and in GitHub Actions.
- [ ] No secrets or personal test data are included.
- [ ] Sign-in and the changed workflow were tested.
- [ ] This change has no Supabase schema change, **or** all outstanding migrations were applied before merge.
- [ ] For a schema change, `requiredSchemaVersion`, `migrations.json`, and `schema-version-migration.sql` were increased together and `get_app_schema_version()` returns that version.
