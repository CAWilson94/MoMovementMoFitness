# Charlotte's Movement Block

A small static site for tracking the 10 August to 25 October 2026 training
block, with 26 October treated as a review/reset day:

- 2 gym sessions per week
- 3 runs per week
- 22 gym sessions total
- 33 runs total
- 55 target movement sessions
- cycling visible as bonus activity when it exists

The dashboard shows progress for the whole block, each month, and each week.
It also includes a plain-English goals section for the strength, running, body
composition, and recovery aims.

## Data

Runs, gym sessions, and rides can be fetched from Strava into
`data/strava-activities.json` by the workflow in `.github/workflows/strava.yml`.
The fetcher currently counts Strava `Run` and `TrailRun` as runs, and
`WeightTraining` and `Workout` as gym sessions. Cycling is shown as bonus
activity and does not count toward the 55-session gym/run target.

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
