# Travel Log

Santana-Co's pilot app for recording work trips. Users sign in and their private records are stored in Supabase under row-level access controls.

## Features

- Add, edit, search, and delete trips
- Create an account and use trips across devices
- Choose Light, Dark, or System appearance and keep the preference across devices
- Choose Employer/general, ATO cents-per-kilometre, or ATO logbook/odometer recording and keep the preference across devices
- Add multiple stops to a trip
- Track start and end addresses, date, one-way distance, notes, and round-trip status
- Open each route in Google Maps to confirm the driving distance
- Automatic driving-distance calculation for all visitors
- View total distance and current-month distance
- Export all records to a CSV report
- Download account data and permanently delete an account
- Review and acknowledge the Privacy & Security Notice
- Filter trips by date and client or project
- Track purpose, vehicle, and an optional reimbursement rate
- Export filtered CSV reports or print a clean report to PDF
- Duplicate frequent trips and keep private saved locations
- Record vehicle registration and journey odometer readings
- Separate employer reimbursements from ATO cents-per-kilometre estimates
- Maintain 12-week ATO-style logbook periods and business-use summaries

## Run it on your computer

Serve this directory from a local web server and open it in a browser. A configured Supabase account is required.

## Automatic distance calculation

The app uses a shared secure service to calculate driving distance. Visitors do not need an API key.
The service accepts distance requests only from signed-in Travel Log users.

## Supabase privacy controls

Run the migration files in `supabase/` once in release order: privacy/security, reporting, stabilization, ATO/logbook, appearance/theme, recording mode, account reauthentication, then schema version. They add versioned privacy acknowledgement, self-service account deletion with recent-password confirmation, reporting fields, private saved locations and logbooks, validation constraints, cross-device appearance and recording preferences, hardened database functions, and an authenticated release-compatibility contract. Never place a Supabase service-role key in this repository or in browser code.

For future database changes, follow `RELEASE_CHECKLIST.md`: increase the browser and database schema versions together, apply the additive Supabase migration first, and only then merge the app release. If the contract cannot be verified, signed-in users see a safe retry screen instead of broken database errors.

Changing the recording method affects new-trip fields, guidance, dashboard estimates, and report summaries. Existing trips retain the workflow under which they were recorded, so switching methods does not discard or silently relabel historical records.

ATO figures are estimates only. The app selects the published rate from each trip's income year, supports backdated trips from 2015–16 onward, and applies the 5,000 work-kilometre annual cap per vehicle and income year. It deliberately refuses to estimate an unpublished future year rather than carrying forward an outdated rate. Add each newly published ATO rate to the isolated `atoCentsRates` schedule in `logic.js`, with financial-year boundary tests, before enabling that year. Users remain responsible for eligibility and supporting records.

## Publish with GitHub Pages

1. Push these files to the `main` branch on GitHub.
2. Open the repository on GitHub, then choose **Settings** → **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Choose branch **main**, folder **/(root)**, then click **Save**.
5. Wait a minute or two. GitHub will show the public website address at the top of the Pages settings page.

## Privacy and security

Trip records are not saved to GitHub. See `privacy.html` for the user-facing notice and `SECURITY.md` for reporting and pilot safeguards.
