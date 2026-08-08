const BLOCK = {
  startDate: "2026-08-10",
  endDate: "2026-10-25",
  weeklyGymTarget: 2,
  weeklyRunTarget: 3,
  totalGymTarget: 22,
  totalRunTarget: 33,
  months: [
    { name: "August", startDate: "2026-08-10", endDate: "2026-08-30", gym: 6, runs: 9 },
    { name: "September", startDate: "2026-08-31", endDate: "2026-10-04", gym: 10, runs: 15 },
    { name: "October", startDate: "2026-10-05", endDate: "2026-10-25", gym: 6, runs: 9 },
  ],
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TOTAL_TARGET = BLOCK.totalGymTarget + BLOCK.totalRunTarget;
const TARGET_TYPES = new Set(["gym", "run"]);

const selectors = {
  totalDone: document.querySelector("#total-done"),
  gymDone: document.querySelector("#gym-done"),
  runDone: document.querySelector("#run-done"),
  rings: document.querySelector(".rings"),
  currentWeekTitle: document.querySelector("#current-week-title"),
  currentWeekNote: document.querySelector("#current-week-note"),
  miniGoals: document.querySelector("#mini-goals"),
  weekGym: document.querySelector("#week-gym"),
  weekRuns: document.querySelector("#week-runs"),
  weekTotal: document.querySelector("#week-total"),
  updatedLabel: document.querySelector("#updated-label"),
  monthGrid: document.querySelector("#month-grid"),
  weekGrid: document.querySelector("#week-grid"),
  activityList: document.querySelector("#activity-list"),
  activitySummary: document.querySelector("#activity-summary"),
  pepNote: document.querySelector("#pep-note"),
};

function asDate(dateString) {
  return new Date(`${dateString}T12:00:00`);
}

function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
}

function formatDate(dateString, options = {}) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...options,
  }).format(asDate(dateString));
}

function formatDuration(totalSeconds) {
  if (!totalSeconds) return "";
  const minutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

function getWeeks() {
  return Array.from({ length: 11 }, (_, index) => {
    const start = new Date(asDate(BLOCK.startDate).getTime() + index * 7 * MS_PER_DAY);
    const end = new Date(start.getTime() + 6 * MS_PER_DAY);
    return {
      index: index + 1,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      gymTarget: BLOCK.weeklyGymTarget,
      runTarget: BLOCK.weeklyRunTarget,
    };
  });
}

function isBetween(date, startDate, endDate) {
  return date >= startDate && date <= endDate;
}

function normaliseSession(session) {
  const typeMap = {
    Run: "run",
    TrailRun: "run",
    Workout: "gym",
    WeightTraining: "gym",
    Ride: "ride",
    MountainBikeRide: "ride",
    GravelRide: "ride",
    VirtualRide: "ride",
    EBikeRide: "ride",
    EMountainBikeRide: "ride",
  };
  const normalType = typeMap[session.type] || session.type;
  return {
    id: session.id || `${session.date}-${session.title}`,
    title: session.title || (normalType === "gym" ? "Gym session" : normalType === "ride" ? "Ride" : "Run"),
    date: session.date,
    type: normalType,
    distanceMiles: Number(session.distanceMiles || session.miles || 0),
    movingSeconds: Number(session.movingSeconds || 0),
    source: session.source || "manual",
    url: session.url || "",
  };
}

async function loadJson(path, fallback) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return fallback;
    return response.json();
  } catch {
    return fallback;
  }
}

async function loadSessions() {
  const [stravaData, manualData] = await Promise.all([
    loadJson("data/strava-activities.json", { activities: [], updatedAt: null }),
    loadJson("data/manual-sessions.json", { sessions: [] }),
  ]);

  const stravaSessions = (stravaData.activities || []).map(normaliseSession);
  const manualSessions = (manualData.sessions || []).map(normaliseSession);
  const sessions = [...stravaSessions, ...manualSessions]
    .filter((session) => ["run", "gym", "ride"].includes(session.type))
    .filter((session) => isBetween(session.date, BLOCK.startDate, BLOCK.endDate))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    sessions,
    updatedAt: stravaData.updatedAt || manualData.updatedAt || null,
  };
}

function countSessions(sessions, startDate, endDate, type) {
  return sessions.filter((session) => {
    return session.type === type && isBetween(session.date, startDate, endDate);
  }).length;
}

function setRing(name, done, target) {
  const ring = document.querySelector(`[data-ring="${name}"]`);
  if (!ring) return;
  const degrees = target ? Math.min(done / target, 1) * 360 : 0;
  ring.style.setProperty("--progress", `${degrees}deg`);
}

function renderTotals(sessions) {
  const gymDone = sessions.filter((session) => session.type === "gym").length;
  const runDone = sessions.filter((session) => session.type === "run").length;
  const rideDone = sessions.filter((session) => session.type === "ride").length;
  const totalDone = gymDone + runDone;

  selectors.totalDone.textContent = totalDone;
  selectors.gymDone.textContent = gymDone;
  selectors.runDone.textContent = runDone;

  selectors.rings.querySelector("[data-bonus-type='ride']")?.remove();
  if (rideDone) {
    const rideCard = document.createElement("div");
    rideCard.className = "ring-card bonus-ring-card";
    rideCard.dataset.bonusType = "ride";
    rideCard.innerHTML = `
      <div class="ring ring-ride" data-ring="ride">
        <span><strong>${rideDone}</strong><small>bonus</small></span>
      </div>
      <p>Rides</p>
    `;
    selectors.rings.append(rideCard);
  }

  setRing("total", totalDone, TOTAL_TARGET);
  setRing("gym", gymDone, BLOCK.totalGymTarget);
  setRing("run", runDone, BLOCK.totalRunTarget);
  setRing("ride", rideDone, rideDone);

  if (totalDone === 0) {
    selectors.pepNote.textContent = "Quest not started. Suspiciously calm so far.";
  } else if (rideDone && totalDone < 10) {
    selectors.pepNote.textContent = "Quest started, with cycling side-quest energy.";
  } else if (totalDone < 10) {
    selectors.pepNote.textContent = "Early campaign wobble is still campaign progress.";
  } else if (totalDone < 28) {
    selectors.pepNote.textContent = "Look at you gaining suspicious amounts of XP.";
  } else if (totalDone < TOTAL_TARGET) {
    selectors.pepNote.textContent = "The side quests are becoming a build.";
  } else {
    selectors.pepNote.textContent = "Campaign complete. Very main-character behaviour.";
  }
}

function renderCurrentWeek(sessions, weeks) {
  const now = today().toISOString().slice(0, 10);
  const activeWeek =
    weeks.find((week) => isBetween(now, week.startDate, week.endDate)) ||
    weeks.find((week) => now < week.startDate) ||
    weeks[weeks.length - 1];

  const gym = countSessions(sessions, activeWeek.startDate, activeWeek.endDate, "gym");
  const runs = countSessions(sessions, activeWeek.startDate, activeWeek.endDate, "run");
  const rides = countSessions(sessions, activeWeek.startDate, activeWeek.endDate, "ride");
  const total = gym + runs;
  const met = gym >= activeWeek.gymTarget && runs >= activeWeek.runTarget;

  selectors.currentWeekTitle.textContent = `Week ${activeWeek.index}: ${formatDate(activeWeek.startDate)} - ${formatDate(activeWeek.endDate)}`;
  selectors.miniGoals.innerHTML = `
    <div>
      <span id="week-gym">${gym}/${activeWeek.gymTarget}</span>
      <small>Gym</small>
    </div>
    <div>
      <span id="week-runs">${runs}/${activeWeek.runTarget}</span>
      <small>Runs</small>
    </div>
    <div>
      <span id="week-total">${total}/${activeWeek.gymTarget + activeWeek.runTarget}</span>
      <small>Total</small>
    </div>
    ${
      rides
        ? `<div class="bonus-goal">
            <span>${rides}</span>
            <small>Rides</small>
          </div>`
        : ""
    }
  `;
  selectors.currentWeekNote.textContent = met
    ? rides
      ? "Encounter cleared, with cycling side-quest XP."
      : "Encounter cleared. Anything else is bonus XP."
    : rides
      ? "Nice side quest. Main quest still wants the next lift or run."
      : "Keep it simple: complete the next available lift or run.";

}

function renderMonths(sessions) {
  selectors.monthGrid.textContent = "";

  for (const month of BLOCK.months) {
    const gym = countSessions(sessions, month.startDate, month.endDate, "gym");
    const runs = countSessions(sessions, month.startDate, month.endDate, "run");
    const rides = countSessions(sessions, month.startDate, month.endDate, "ride");
    const total = gym + runs;
    const target = month.gym + month.runs;
    const bonusMarkup = rides ? barMarkup("Rides", rides, 0, "ride") : "";
    const card = document.createElement("article");
    card.className = "month-card";
    card.innerHTML = `
      <h3>${month.name}</h3>
      <div class="bar-group">
        ${barMarkup("Total", total, target, "")}
        ${barMarkup("Gym", gym, month.gym, "gym")}
        ${barMarkup("Runs", runs, month.runs, "run")}
        ${bonusMarkup}
      </div>
    `;
    selectors.monthGrid.append(card);
  }
}

function barMarkup(label, done, target, variant) {
  const width = target ? Math.min((done / target) * 100, 100) : 0;
  const value = target ? `${done}/${target}` : `${done}`;
  return `
    <div>
      <div class="bar-label"><span>${label}</span><span>${value}</span></div>
      <div class="bar-track ${target ? "" : "bonus"}"><div class="bar-fill ${variant}" style="width: ${target ? width : 100}%"></div></div>
    </div>
  `;
}

function renderWeeks(sessions, weeks) {
  const now = today().toISOString().slice(0, 10);
  selectors.weekGrid.textContent = "";

  for (const week of weeks) {
    const gym = countSessions(sessions, week.startDate, week.endDate, "gym");
    const runs = countSessions(sessions, week.startDate, week.endDate, "run");
    const rides = countSessions(sessions, week.startDate, week.endDate, "ride");
    const complete = gym >= week.gymTarget && runs >= week.runTarget;
    const current = isBetween(now, week.startDate, week.endDate);
    const card = document.createElement("article");
    card.className = `week-card${complete ? " is-complete" : ""}${current ? " is-current" : ""}`;
    card.innerHTML = `
      <strong>Week ${week.index}</strong>
      <small>${formatDate(week.startDate)} - ${formatDate(week.endDate)}</small>
      <div class="week-dots${rides ? " has-rides" : ""}" aria-label="${gym} gym sessions, ${runs} runs, and ${rides} rides logged">
        ${dotMarkup(gym, 2, "gym")}
        ${dotMarkup(runs, 3, "run")}
        ${dotMarkup(rides, rides, "ride")}
      </div>
    `;
    selectors.weekGrid.append(card);
  }
}

function dotMarkup(done, target, type) {
  return Array.from({ length: target }, (_, index) => {
    return `<span class="dot ${index < done ? `done ${type}` : ""}"></span>`;
  }).join("");
}

function renderActivities(sessions) {
  selectors.activityList.textContent = "";
  const targetSessions = sessions.filter((session) => TARGET_TYPES.has(session.type)).length;
  const rides = sessions.filter((session) => session.type === "ride").length;
  selectors.activitySummary.textContent = rides
    ? `${targetSessions} campaign sessions + ${rides} rides`
    : `${targetSessions} campaign sessions in this block`;

  if (!sessions.length) {
    selectors.activityList.innerHTML = `<article class="activity-card"><h3>The log is empty</h3><p>Let Strava fetch your runs, gym sessions, and rides.</p></article>`;
    return;
  }

  for (const session of sessions.slice(0, 9)) {
    const card = document.createElement(session.url ? "a" : "article");
    card.className = "activity-card";
    if (session.url) {
      card.href = session.url;
      card.target = "_blank";
      card.rel = "noreferrer";
      card.style.textDecoration = "none";
      card.style.color = "inherit";
    }

    const detail =
      (session.type === "run" || session.type === "ride") && session.distanceMiles
        ? `${session.distanceMiles.toFixed(1)} miles ${formatDuration(session.movingSeconds) ? `, ${formatDuration(session.movingSeconds)}` : ""}`
        : session.source === "manual"
          ? "Logged manually"
          : "Logged from Strava";

    card.innerHTML = `
      <h3>${session.title}</h3>
      <p>${formatDate(session.date, { weekday: "short" })} · ${detail}</p>
      <div class="activity-meta">
        <span class="pill ${session.type}">${session.type}</span>
        <span class="pill">${session.source}</span>
      </div>
    `;
    selectors.activityList.append(card);
  }
}

async function init() {
  const { sessions, updatedAt } = await loadSessions();
  const weeks = getWeeks();

  renderTotals(sessions);
  renderCurrentWeek(sessions, weeks);
  renderMonths(sessions);
  renderWeeks(sessions, weeks);
  renderActivities(sessions);

  selectors.updatedLabel.textContent = updatedAt
    ? `Updated ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(updatedAt))}`
    : "Ready for your first logs";
}

init();
