# Charlotte's Movement Block

A small static site for tracking the 10 August to 25 October 2026 training
block, with 26 October treated as a review/reset day:

- 2 gym sessions per week throughout
- 2 runs per week for Weeks 1-5
- 3 runs per week for Weeks 6-11
- 22 gym sessions total
- 28 runs total
- 50 target movement sessions
- cycling visible as bonus activity when it exists

The dashboard shows progress for the whole block, each month, and each week.
It also includes a plain-English goals section for the strength, running, body
composition, and recovery aims.

## Data

Runs, gym sessions, and rides can be fetched from Strava into
`data/strava-activities.json` by the workflow in `.github/workflows/strava.yml`.
The fetcher currently counts Strava `Run` and `TrailRun` as runs, and
`WeightTraining` and `Workout` as gym sessions. Cycling is shown as bonus
activity and does not count toward the 50-session gym/run target.

Each fetch stays inside the campaign range, `2026-08-10` to `2026-10-25`.
After the first successful fetch, the script starts from the latest saved
activity date, with a one-day overlap to catch same-day uploads or edits, then
merges by Strava activity ID.
If the workflow runs before the campaign starts, it records that there is
nothing to fetch yet and exits successfully.
When new activity data is committed, the Strava workflow calls the Pages
deployment workflow so the live dashboard refreshes automatically. Runs with
no data changes skip the deployment.

Extra sessions can still be logged manually in `data/manual-sessions.json`:

```json
{
  "id": "gym-2026-08-10",
  "date": "2026-08-10",
  "type": "gym",
  "title": "Full-body gym",
  "source": "manual"
}
```

Recovery check-ins live in `data/recovery-log.json` and power
`recovery.html`. The recovery page leads with a daily support score out of
three: hydration, food consistency, and sleep/recovery. Weekly and monthly
sections roll those anchors up so the trend is visible without turning recovery
into homework. Energy, soreness, stress, and notes are shown as context.
Check-ins and weekly reviews added through the page are saved in the browser
with `localStorage`; seeded/shared check-ins can still be committed in
`data/recovery-log.json`.

```json
{
  "date": "2026-08-10",
  "hydration": "okay",
  "meals": 3,
  "foodConsistent": true,
  "protein": true,
  "sleep": "good",
  "energy": 4,
  "soreness": 2,
  "stress": 2,
  "note": "Felt surprisingly human."
}
```

## Strava setup

Use the same GitHub repository secrets as the cycling tracker:

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REFRESH_TOKEN`

The workflow is currently configured to fetch sessions between `2026-08-10`
and `2026-10-25`.

## Running locally

Serve the folder with any static server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
