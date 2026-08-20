# Staging smoke test

Record the pull request number, preview URL, tester, date, and result when testing a major release.

- [ ] The page loads over HTTPS and shows **STAGING TEST ENVIRONMENT — TEST DATA ONLY**.
- [ ] Production credentials do not work on staging.
- [ ] A staging test account can sign in and sign out.
- [ ] The tester sees only that staging account's test trips.
- [ ] A trip can be added, edited, duplicated, filtered, and deleted.
- [ ] Multiple stops and round-trip distance calculate successfully.
- [ ] Recording mode, appearance, saved locations, and logbook settings save correctly.
- [ ] ATO cents-per-kilometre calculations match the selected trip year and cap rules.
- [ ] CSV export, JSON account download, and Print / Save PDF work.
- [ ] Password reset is delivered only to the staging test address.
- [ ] Browser developer tools show no failed requests or uncaught errors.
- [ ] The production app and its existing account data are unchanged.

For destructive account-deletion testing, create a temporary staging account specifically for that test. Never perform it with a production account.
