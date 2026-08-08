// Fetches runs and gym sessions from Strava and writes data/strava-activities.json.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "..", "data", "strava-activities.json");

const CONFIG = {
  startDate: process.env.START_DATE || "2026-08-10",
  endDate: process.env.END_DATE || "2026-10-25",
};

const RUN_TYPES = new Set(["Run", "TrailRun"]);
const GYM_TYPES = new Set(["WeightTraining", "Workout"]);
const METRES_PER_MILE = 1609.344;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function getAccessToken() {
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("STRAVA_CLIENT_ID"),
      client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: requireEnv("STRAVA_REFRESH_TOKEN"),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchActivities(accessToken, afterEpoch, beforeEpoch) {
  const activities = [];
  let page = 1;

  while (true) {
    const url = new URL("https://www.strava.com/api/v3/athlete/activities");
    url.searchParams.set("after", String(afterEpoch));
    url.searchParams.set("before", String(beforeEpoch));
    url.searchParams.set("per_page", "200");
    url.searchParams.set("page", String(page));

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Activity fetch failed (${response.status}): ${detail}`);
    }

    const batch = await response.json();
    activities.push(...batch);
    if (batch.length < 200) break;
    page += 1;
  }

  return activities;
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toRun(activity) {
  return {
    id: activity.id,
    title: activity.name || "Run",
    date: activity.start_date_local.slice(0, 10),
    type: "run",
    distanceMiles: round(activity.distance / METRES_PER_MILE, 1),
    movingSeconds: activity.moving_time || 0,
    source: "strava",
    url: `https://www.strava.com/activities/${activity.id}`,
  };
}

function toGym(activity) {
  return {
    id: activity.id,
    title: activity.name || "Gym session",
    date: activity.start_date_local.slice(0, 10),
    type: "gym",
    movingSeconds: activity.moving_time || activity.elapsed_time || 0,
    source: "strava",
    url: `https://www.strava.com/activities/${activity.id}`,
  };
}

function toSession(activity) {
  const type = activity.sport_type || activity.type;
  if (RUN_TYPES.has(type)) return toRun(activity);
  if (GYM_TYPES.has(type)) return toGym(activity);
  return null;
}

async function main() {
  const { startDate, endDate } = CONFIG;
  const afterEpoch = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000) - 86400;
  const beforeEpoch = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000) + 86400;

  const accessToken = await getAccessToken();
  const activities = await fetchActivities(accessToken, afterEpoch, beforeEpoch);

  const sessions = activities
    .filter((activity) => RUN_TYPES.has(activity.sport_type || activity.type) || GYM_TYPES.has(activity.sport_type || activity.type))
    .filter((activity) => {
      const day = activity.start_date_local.slice(0, 10);
      return day >= startDate && day <= endDate;
    })
    .map(toSession)
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const payload = {
    startDate,
    endDate,
    updatedAt: new Date().toISOString(),
    activities: sessions,
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${sessions.length} Strava sessions to data/strava-activities.json`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
