# Travel Log

A simple, private browser app for recording work trips. Data is stored only in the browser on the device you use; export a CSV whenever you need a report.

## Features

- Add, edit, search, and delete trips
- Track start and end addresses, date, one-way distance, notes, and round-trip status
- Open each route in Google Maps to confirm the driving distance
- Optional automatic driving-distance calculation with a free OpenRouteService key
- View total distance and current-month distance
- Export all records to a CSV report

## Run it on your computer

Open `index.html` in a browser. No installation or account is required.

## Automatic distance calculation (optional)

Create a free API key at [openrouteservice.org](https://openrouteservice.org/dev/#/signup). In the app, click **Distance settings**, paste the key, and save it. The key stays in your browser only; do not add it to a GitHub file.

## Publish with GitHub Pages

1. Push these files to the `main` branch on GitHub.
2. Open the repository on GitHub, then choose **Settings** → **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Choose branch **main**, folder **/(root)**, then click **Save**.
5. Wait a minute or two. GitHub will show the public website address at the top of the Pages settings page.

## Important privacy note

Trip records are not saved to GitHub. They remain in the browser’s local storage. Clearing browser data or using another device starts a separate, empty log; export CSV reports for backup.
