# Travel Log

Santana-Co's pilot app for recording work trips. Users sign in and their private records are stored in Supabase under row-level access controls.

## Features

- Add, edit, search, and delete trips
- Create an account and use trips across devices
- Choose Light, Dark, or System appearance and keep the preference across devices
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

Run the migration files in `supabase/` once in release order: privacy/security, reporting, stabilization, ATO/logbook, then appearance/theme. They add versioned privacy acknowledgement, self-service account deletion, reporting fields, private saved locations and logbooks, validation constraints, a cross-device appearance preference, and hardened database functions. Never place a Supabase service-role key in this repository or in browser code.

ATO figures are estimates only. The app currently recognises the 88¢ rate for 2024–25 and 2025–26 and the 91¢ rate for 2026–27, and applies the 5,000 work-kilometre annual cap per vehicle to the summary. Users remain responsible for eligibility and supporting records.

## Publish with GitHub Pages

1. Push these files to the `main` branch on GitHub.
2. Open the repository on GitHub, then choose **Settings** → **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Choose branch **main**, folder **/(root)**, then click **Save**.
5. Wait a minute or two. GitHub will show the public website address at the top of the Pages settings page.

## Privacy and security

Trip records are not saved to GitHub. See `privacy.html` for the user-facing notice and `SECURITY.md` for reporting and pilot safeguards.
