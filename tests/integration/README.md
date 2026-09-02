# Supabase tenant-isolation integration tests

## Purpose

`tenant-isolation.integration.cjs` proves the checked-in schema's ownership boundaries against a real, isolated Supabase project using two synthetic authenticated users. It is deliberately excluded from the normal credential-free `npm test` discovery pattern.

The service-role key is used only to create and clean up synthetic Auth users. All RLS and RPC assertions use the synthetic users' access tokens and the publishable key.

## Safety requirements

- Use a dedicated test or staging project containing the current migrations from `supabase/migrations.json`.
- Never use the production project or production data.
- Do not place values in a committed file or shell history shared with others.
- The runner requires an explicit `staging` environment marker and matching expected project reference.
- The known production project is always rejected.
- Synthetic email addresses, passwords, row IDs, labels, and addresses are unique per run.
- The runner does not print credentials, tokens, passwords, response headers, or unredacted provider errors.
- Cleanup deletes synthetic Auth users through the admin API, which cascades their owned records. Cleanup runs in `finally` even after a failed assertion.

## Required environment variables

Use `.env.integration.example` as a placeholder reference. Either export the real values into the current shell or copy it to the git-ignored `.env.integration.local`, replace the placeholders, and restrict the file to its owner with `chmod 600 .env.integration.local`. The integration command loads that exact local filename when present; broader `.env` files are not loaded.

| Variable | Requirement |
|---|---|
| `TRAVEL_LOG_TEST_ENVIRONMENT` | Must equal `staging`. |
| `TRAVEL_LOG_TEST_SUPABASE_URL` | HTTPS URL for a non-production `*.supabase.co` project. |
| `TRAVEL_LOG_TEST_SUPABASE_PROJECT_REF` | Exact hostname prefix expected in the URL. |
| `TRAVEL_LOG_TEST_SUPABASE_PUBLISHABLE_KEY` | Test project's browser-safe publishable key. |
| `TRAVEL_LOG_TEST_SUPABASE_SERVICE_ROLE_KEY` | Test project's privileged setup/cleanup key; never exposed to assertions. |

## Test matrix

| Resource | Own SELECT | Cross SELECT | Own INSERT | Spoofed owner INSERT | Own UPDATE | Cross UPDATE | Reassign owner | Own DELETE | Cross DELETE |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `profiles` | Yes | Yes | Trigger-managed | Not applicable | Yes | Yes | Yes | RPC only | Direct delete denied |
| `trips` | Yes | Yes | A and B | A and B | Yes | Yes | Yes | Yes | Yes |
| `saved_locations` | Yes | Yes | A and B | A and B | Yes | Yes | Yes | Yes | Yes |
| `logbook_periods` | Yes | Yes | A and B | A and B | Yes | Yes | Yes | Yes | Yes |
| `logbook_income_years` | Yes | Yes | A and B | A and B | Yes | Yes | Yes | Yes | Yes |

Additional checks:

- An annual odometer record cannot combine one user's ownership with the other user's logbook ID.
- `accept_privacy_notice` changes only the caller's profile.
- `delete_my_account` deletes only the caller and their records; the other user remains intact.
- `get_app_schema_version` is intentionally shared with authenticated users and returns the same positive version to both.
- `private.app_schema_state` has no direct client grant and is not tested as a user-owned resource.
- `private.*` helper functions and `handle_new_user` are not exposed client RPCs; their public wrappers/trigger effects are tested instead.

## Run tests

Regular tests need no live credentials:

```sh
npm test
```

After exporting the five required staging variables or creating the restricted local environment file:

```sh
npm run test:integration
```

Absent or unsafe configuration fails before any network request or synthetic-user creation.
