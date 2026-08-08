const BLOCK = {
  startDate: "2026-08-10",
  endDate: "2026-10-25",
  months: [
    { name: "August", startDate: "2026-08-10", endDate: "2026-08-30" },
    { name: "September", startDate: "2026-08-31", endDate: "2026-10-04" },
    { name: "October", startDate: "2026-10-05", endDate: "2026-10-25" },
  ],
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAILY_ANCHORS = 3;
const STORAGE_KEY = "movementTrackerRecoveryEntries";
const REVIEW_STORAGE_KEY = "movementTrackerWeeklyReviews";
const NOTE_STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "again",
  "all",
  "also",
  "am",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "bit",
  "but",
  "by",
  "can",
  "could",
  "day",
  "did",
  "do",
  "for",
  "from",
  "had",
  "have",
  "i",
  "im",
  "in",
  "is",
  "it",
  "just",
  "like",
  "me",
  "my",
  "not",
  "of",
  "on",
  "or",
  "so",
  "that",
  "the",
  "this",
  "to",
  "today",
  "too",
  "very",
  "was",
  "with",
]);

const selectors = {
  dailyTitle: document.querySelector("#daily-support-title-text"),
  dailyNote: document.querySelector("#daily-support-note"),
  dailyGrid: document.querySelector("#daily-support-grid"),
  latestTitle: document.querySelector("#latest-recovery-title"),
  latestContext: document.querySelector("#latest-recovery-context"),
  latestNote: document.querySelector("#latest-recovery-note"),
  recoveryChart: document.querySelector("#recovery-chart"),
  recoveryChartSummary: document.querySelector("#recovery-chart-summary"),
  recoveryChartMeta: document.querySelector("#recovery-chart-meta"),
  supplyTrend: document.querySelector("#supply-trend-grid"),
  supplyTrendNote: document.querySelector("#supply-trend-note"),
  weeklyReviewWeek: document.querySelector("#weekly-review-week"),
  weeklyReviewSummary: document.querySelector("#weekly-review-summary"),
  weeklyReviewGrid: document.querySelector("#weekly-review-grid"),
  openWeeklyReview: document.querySelector("#open-weekly-review-modal"),
  weeklyReviewModal: document.querySelector("#weekly-review-modal"),
  weeklyReviewForm: document.querySelector("#weekly-review-form"),
  closeWeeklyReview: document.querySelector("#close-weekly-review-modal"),
  deleteWeeklyReview: document.querySelector("#delete-weekly-review"),
  noteThemeCloud: document.querySelector("#note-theme-cloud"),
  noteThemesSummary: document.querySelector("#note-themes-summary"),
  monthGrid: document.querySelector("#recovery-month-grid"),
  weekGrid: document.querySelector("#recovery-week-grid"),
  logList: document.querySelector("#recovery-log-list"),
  logSummary: document.querySelector("#recovery-log-summary"),
  updatedLabel: document.querySelector("#recovery-updated-label"),
  openModal: document.querySelector("#open-recovery-modal"),
  closeModal: document.querySelector("#close-recovery-modal"),
  modal: document.querySelector("#recovery-modal"),
  form: document.querySelector("#recovery-form"),
  deleteEntry: document.querySelector("#delete-recovery-entry"),
};

let recoveryEntries = [];
let recoveryUpdatedAt = null;
let weeklyReviews = [];

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

function daysInclusive(startDate, endDate) {
  return Math.round((asDate(endDate) - asDate(startDate)) / MS_PER_DAY) + 1;
}

function getWeeks() {
  return Array.from({ length: 11 }, (_, index) => {
    const start = new Date(asDate(BLOCK.startDate).getTime() + index * 7 * MS_PER_DAY);
    const end = new Date(start.getTime() + 6 * MS_PER_DAY);
    return {
      index: index + 1,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  });
}

function isBetween(date, startDate, endDate) {
  return date >= startDate && date <= endDate;
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

function todayString() {
  return today().toISOString().slice(0, 10);
}

function defaultCheckInDate() {
  const currentDay = todayString();
  if (currentDay < BLOCK.startDate) return BLOCK.startDate;
  if (currentDay > BLOCK.endDate) return BLOCK.endDate;
  return currentDay;
}

function loadStoredEntries() {
  try {
    const entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function saveStoredEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries, null, 2));
}

function loadStoredReviews() {
  try {
    const reviews = JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY) || "[]");
    return Array.isArray(reviews) ? reviews.map(normaliseReview).filter((review) => review.weekIndex) : [];
  } catch {
    return [];
  }
}

function saveStoredReviews(reviews) {
  localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviews, null, 2));
}

function normaliseEntry(entry) {
  return {
    date: entry.date,
    hydration: entry.hydration || "unknown",
    meals: Number(entry.meals || 0),
    foodConsistent: Boolean(entry.foodConsistent),
    protein: Boolean(entry.protein),
    sleep: entry.sleep || "unknown",
    energy: Number(entry.energy || 0),
    soreness: Number(entry.soreness || 0),
    stress: Number(entry.stress || 0),
    note: entry.note || "",
  };
}

function normaliseReview(review) {
  return {
    weekIndex: Number(review.weekIndex || 0),
    worked: review.worked || "",
    blocked: review.blocked || "",
    tweak: review.tweak || "",
    updatedAt: review.updatedAt || new Date().toISOString(),
  };
}

async function loadRecoveryEntries() {
  const data = await loadJson("data/recovery-log.json", { entries: [], updatedAt: null });
  const entriesByDate = new Map();

  for (const entry of [...(data.entries || []), ...loadStoredEntries()]) {
    const normalised = normaliseEntry(entry);
    if (normalised.date) entriesByDate.set(normalised.date, normalised);
  }

  const entries = [...entriesByDate.values()]
    .map(normaliseEntry)
    .filter((entry) => entry.date && isBetween(entry.date, BLOCK.startDate, BLOCK.endDate))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    entries,
    updatedAt: data.updatedAt || null,
  };
}

function scoreEntry(entry) {
  const hydration = ["okay", "great"].includes(entry.hydration) ? 1 : 0;
  const food = entry.foodConsistent || entry.meals >= 3 ? 1 : 0;
  const sleep = ["okay", "good", "great"].includes(entry.sleep) ? 1 : 0;

  return {
    hydration,
    food,
    sleep,
    total: hydration + food + sleep,
  };
}

function readinessScore(entry) {
  const support = scoreEntry(entry).total;
  const bodyEnergy = entry.energy >= 3 ? 1 : 0;
  const bodyLoad = entry.stress > 0 && entry.soreness > 0 && entry.stress <= 3 && entry.soreness <= 3 ? 1 : 0;
  return support + bodyEnergy + bodyLoad;
}

function summarise(entries, startDate, endDate) {
  const scoped = entries.filter((entry) => isBetween(entry.date, startDate, endDate));
  const days = daysInclusive(startDate, endDate);
  const scores = scoped.map(scoreEntry);

  return {
    entries: scoped,
    days,
    target: days * DAILY_ANCHORS,
    hydration: scores.reduce((total, score) => total + score.hydration, 0),
    food: scores.reduce((total, score) => total + score.food, 0),
    sleep: scores.reduce((total, score) => total + score.sleep, 0),
    total: scores.reduce((total, score) => total + score.total, 0),
  };
}

function renderRecoveryChart(entries) {
  const chartEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  selectors.recoveryChart.textContent = "";
  selectors.recoveryChartMeta.textContent = "";

  if (!chartEntries.length) {
    selectors.recoveryChartSummary.textContent = "Log a couple of check-ins to draw the line.";
    selectors.recoveryChart.innerHTML = `
      <text x="380" y="108" text-anchor="middle" class="chart-empty-text">No recovery check-ins yet</text>
      <text x="380" y="134" text-anchor="middle" class="chart-empty-subtext">Water, food, sleep, energy, soreness, and stress will shape this.</text>
    `;
    return;
  }

  const width = 760;
  const height = 220;
  const padding = { top: 24, right: 28, bottom: 36, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxScore = 5;
  const scores = chartEntries.map((entry) => ({
    date: entry.date,
    score: readinessScore(entry),
  }));
  const xFor = (index) => padding.left + (scores.length === 1 ? plotWidth / 2 : (index / (scores.length - 1)) * plotWidth);
  const yFor = (score) => padding.top + plotHeight - (score / maxScore) * plotHeight;
  const points = scores.map((point, index) => `${xFor(index).toFixed(1)},${yFor(point.score).toFixed(1)}`).join(" ");
  const areaPoints = `${padding.left},${padding.top + plotHeight} ${points} ${padding.left + plotWidth},${padding.top + plotHeight}`;
  const latest = scores[scores.length - 1];
  const averageScore = scores.reduce((total, point) => total + point.score, 0) / scores.length;
  const firstLabel = formatDate(scores[0].date);
  const lastLabel = formatDate(latest.date);

  selectors.recoveryChartSummary.textContent = `${latest.score}/5 latest readiness · ${averageScore.toFixed(1)}/5 average`;
  selectors.recoveryChartMeta.innerHTML = `
    <span>${firstLabel}</span>
    <span>Score combines support habits + body signal</span>
    <span>${lastLabel}</span>
  `;

  const gridLines = [0, 1, 2, 3, 4, 5]
    .map((score) => {
      const y = yFor(score).toFixed(1);
      return `
        <line class="chart-grid-line" x1="${padding.left}" x2="${padding.left + plotWidth}" y1="${y}" y2="${y}"></line>
        <text class="chart-axis-label" x="${padding.left - 16}" y="${Number(y) + 4}" text-anchor="end">${score}</text>
      `;
    })
    .join("");
  const dots = scores
    .map((point, index) => {
      const x = xFor(index).toFixed(1);
      const y = yFor(point.score).toFixed(1);
      return `<circle class="chart-dot" cx="${x}" cy="${y}" r="${index === scores.length - 1 ? 5 : 4}"><title>${formatDate(point.date, { weekday: "short" })}: ${point.score}/5</title></circle>`;
    })
    .join("");

  selectors.recoveryChart.innerHTML = `
    <defs>
      <linearGradient id="readiness-fill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#2eb8aa" stop-opacity="0.24"></stop>
        <stop offset="100%" stop-color="#ee2a7b" stop-opacity="0.04"></stop>
      </linearGradient>
    </defs>
    ${gridLines}
    <polygon class="chart-area" points="${areaPoints}"></polygon>
    <polyline class="chart-line" points="${points}"></polyline>
    ${dots}
  `;
}

function getActiveWeek(weeks) {
  const currentDay = todayString();
  return (
    weeks.find((week) => isBetween(currentDay, week.startDate, week.endDate)) ||
    weeks.find((week) => currentDay < week.startDate) ||
    weeks[weeks.length - 1]
  );
}

function iconMarkup(type) {
  const icons = {
    hydration: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5S6.5 10 6.5 14.5a5.5 5.5 0 0 0 11 0C17.5 10 12 3.5 12 3.5Z"></path>
      </svg>
    `,
    food: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3v8"></path>
        <path d="M10 3v8"></path>
        <path d="M6 7h4"></path>
        <path d="M8 11v10"></path>
        <path d="M17 3v18"></path>
        <path d="M14 3c0 4.5 1 7 3 7"></path>
      </svg>
    `,
    sleep: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11V6"></path>
        <path d="M4 17v-6h16a2 2 0 0 1 2 2v4"></path>
        <path d="M4 17h18"></path>
        <path d="M8 11V8h5a2 2 0 0 1 2 2v1"></path>
      </svg>
    `,
    body: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.65-7 10-7 10Z"></path>
        <path d="M9 12h2l1-2 2 5 1-3h2"></path>
      </svg>
    `,
  };

  return icons[type] || "";
}

function trendStatus(done, loggedDays) {
  if (!loggedDays) {
    return {
      className: "empty",
      label: "No data yet",
      detail: "not logged",
    };
  }

  if (loggedDays < 3) {
    return {
      className: "early",
      label: "Too early",
      detail: `${loggedDays} check-in${loggedDays === 1 ? "" : "s"}`,
    };
  }

  const ratio = done / loggedDays;
  if (ratio >= 0.8) {
    return {
      className: "good",
      label: "Steady",
      detail: `${done}/${loggedDays} logged`,
    };
  }

  if (ratio >= 0.5) {
    return {
      className: "ok",
      label: "Okay-ish",
      detail: `${done}/${loggedDays} logged`,
    };
  }

  return {
    className: "low",
    label: "Needs a nudge",
    detail: `${done}/${loggedDays} logged`,
  };
}

function bodySignal(entry) {
  if (!entry?.energy && !entry?.soreness && !entry?.stress) {
    return {
      className: "empty",
      label: "Body signal",
      value: "not logged",
      note: "Energy, soreness, and stress will show here once logged.",
    };
  }

  const energy = entry.energy || 3;
  const soreness = entry.soreness || 3;
  const stress = entry.stress || 3;

  if (stress >= 4) {
    return {
      className: "low",
      label: "Body signal",
      value: "recovery debt",
      note: "Stress is high today, so treat that as a real recovery flag.",
    };
  }

  if (energy >= 4 && soreness <= 2 && stress <= 2) {
    return {
      className: "good",
      label: "Body signal",
      value: "ready-ish",
      note: "Energy is up and stress/soreness look manageable.",
    };
  }

  if (energy <= 2 || soreness >= 4 || stress === 3) {
    return {
      className: "ok",
      label: "Body signal",
      value: "watch it",
      note: "Not a panic, just worth making recovery easier today.",
    };
  }

  return {
    className: "ok",
    label: "Body signal",
    value: "manageable",
    note: "Signals look workable. Keep an eye on stress first.",
  };
}

function average(values) {
  const logged = values.filter((value) => value > 0);
  if (!logged.length) return 0;
  return logged.reduce((total, value) => total + value, 0) / logged.length;
}

function weeklyBodySignal(entries) {
  if (!entries.length) {
    return {
      className: "empty",
      label: "No data yet",
      detail: "not logged",
    };
  }

  if (entries.length < 3) {
    return {
      className: "early",
      label: "Too early",
      detail: `${entries.length} check-in${entries.length === 1 ? "" : "s"}`,
    };
  }

  const stress = average(entries.map((entry) => entry.stress));
  const soreness = average(entries.map((entry) => entry.soreness));
  const energy = average(entries.map((entry) => entry.energy));

  if (stress >= 4 || (stress >= 3.5 && energy <= 2.5)) {
    return {
      className: "low",
      label: "Recovery debt",
      detail: `stress ${stress.toFixed(1)}/5`,
    };
  }

  if (energy >= 3.7 && soreness <= 2.5 && stress <= 2.5) {
    return {
      className: "good",
      label: "Ready-ish",
      detail: `stress ${stress.toFixed(1)}/5`,
    };
  }

  return {
    className: "ok",
    label: "Manageable",
    detail: `stress ${stress.toFixed(1)}/5`,
  };
}

function renderSupplyTrend(entries, weeks) {
  const activeWeek = getActiveWeek(weeks);
  const summary = summarise(entries, activeWeek.startDate, activeWeek.endDate);
  const loggedDays = summary.entries.length;
  const metrics = [
    ["hydration", "Water", summary.hydration],
    ["food", "Food", summary.food],
    ["sleep", "Sleep", summary.sleep],
  ];
  const body = weeklyBodySignal(summary.entries);

  selectors.supplyTrend.textContent = "";
  selectors.supplyTrendNote.textContent = loggedDays
    ? `Based on ${loggedDays} logged check-in${loggedDays === 1 ? "" : "s"} this week.`
    : "Based on logged check-ins this week.";

  for (const [type, label, done] of metrics) {
    const status = trendStatus(done, loggedDays);
    const item = document.createElement("article");
    item.className = `supply-trend-item supply-badge ${type} is-${status.className}`;
    item.title = `${label}: ${status.label} (${status.detail})`;
    item.innerHTML = `
      <span class="supply-icon">${iconMarkup(type)}</span>
      <span class="supply-copy">
        <strong>${label}</strong>
        <small>${status.label}</small>
      </span>
      <span class="supply-status" aria-hidden="true"></span>
    `;
    selectors.supplyTrend.append(item);
  }

  const bodyItem = document.createElement("article");
  bodyItem.className = `supply-trend-item supply-badge body is-${body.className}`;
  bodyItem.title = `Body: ${body.label} (${body.detail})`;
  bodyItem.innerHTML = `
    <span class="supply-icon">${iconMarkup("body")}</span>
    <span class="supply-copy">
      <strong>Body</strong>
      <small>${body.label}</small>
    </span>
    <span class="supply-status" aria-hidden="true"></span>
  `;
  selectors.supplyTrend.append(bodyItem);
}

function reviewForWeek(weekIndex) {
  return weeklyReviews.find((review) => review.weekIndex === weekIndex);
}

function activeWeekLabel(week) {
  return `Week ${week.index}: ${formatDate(week.startDate)} - ${formatDate(week.endDate)}`;
}

function renderWeeklyReview(weeks) {
  const activeWeek = getActiveWeek(weeks);
  const review = reviewForWeek(activeWeek.index);
  const fields = [
    ["Worked", review?.worked],
    ["Got in the way", review?.blocked],
    ["Next tweak", review?.tweak],
  ];

  selectors.weeklyReviewWeek.textContent = activeWeekLabel(activeWeek);
  selectors.weeklyReviewGrid.textContent = "";
  selectors.openWeeklyReview.textContent = review ? "Edit weekly review" : "Add weekly review";
  selectors.weeklyReviewSummary.textContent = review
    ? `Saved ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(review.updatedAt))}.`
    : "A tiny reset point for what worked, what got in the way, and what to tweak next.";

  for (const [label, value] of fields) {
    const item = document.createElement("div");
    const labelNode = document.createElement("span");
    const valueNode = document.createElement("strong");
    labelNode.textContent = label;
    valueNode.textContent = value || "not reviewed yet";
    item.append(labelNode, valueNode);
    selectors.weeklyReviewGrid.append(item);
  }
}

function noteWords(note) {
  return note
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z]+/)
    .filter((word) => word.length > 2 && !NOTE_STOP_WORDS.has(word));
}

function noteThemeCounts(entries) {
  const counts = new Map();

  for (const entry of entries) {
    const words = noteWords(entry.note || "");
    for (const word of words) {
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12);
}

function renderNoteThemes(entries, weeks) {
  const activeWeek = getActiveWeek(weeks);
  const weekEntries = entries.filter((entry) => isBetween(entry.date, activeWeek.startDate, activeWeek.endDate));
  const notes = weekEntries.filter((entry) => entry.note?.trim());
  const themes = noteThemeCounts(notes);

  selectors.noteThemeCloud.textContent = "";
  selectors.noteThemesSummary.textContent = notes.length
    ? `${notes.length} note${notes.length === 1 ? "" : "s"} logged this week.`
    : "Optional notes will turn into gentle themes here.";

  if (!themes.length) {
    selectors.noteThemeCloud.innerHTML = `
      <span class="theme-empty">No note themes yet</span>
    `;
    return;
  }

  const maxCount = themes[0][1];
  for (const [word, count] of themes) {
    const chip = document.createElement("span");
    const strength = count === maxCount ? "strong" : count > 1 ? "medium" : "light";
    chip.className = `theme-chip is-${strength}`;
    chip.textContent = word;
    chip.title = `${word}: mentioned ${count} time${count === 1 ? "" : "s"} this week`;
    selectors.noteThemeCloud.append(chip);
  }
}

function barMarkup(label, done, target, variant) {
  const width = target ? Math.min((done / target) * 100, 100) : 0;
  return `
    <div>
      <div class="bar-label"><span>${label}</span><span>${done}/${target}</span></div>
      <div class="bar-track"><div class="bar-fill ${variant}" style="width: ${width}%"></div></div>
    </div>
  `;
}

function renderDaily(entries) {
  const currentDay = todayString();
  const entry = entries.find((item) => item.date === currentDay) || entries[0];
  selectors.dailyGrid.textContent = "";

  if (!entry) {
    selectors.dailyTitle.textContent = "No check-in yet";
    selectors.dailyNote.textContent = "Daily support has 3 possible points: hydration, food, and sleep/recovery.";
    for (const label of ["Hydration", "Food", "Sleep"]) {
      const item = document.createElement("div");
      item.innerHTML = `<span>${label}</span><strong>not logged</strong>`;
      selectors.dailyGrid.append(item);
    }
    return;
  }

  const score = scoreEntry(entry);
  const isToday = entry.date === currentDay;
  selectors.dailyTitle.textContent = `${score.total}/3 daily support points`;
  selectors.dailyNote.textContent = isToday
    ? "1 point each for hydration, food, and sleep/recovery."
    : `Showing latest check-in from ${formatDate(entry.date, { weekday: "short" })}. 1 point each for hydration, food, and sleep/recovery.`;

  const anchors = [
    ["Hydration", entry.hydration, score.hydration],
    ["Food", entry.foodConsistent || entry.meals >= 3 ? "anchored" : "needs a nudge", score.food],
    ["Sleep", entry.sleep, score.sleep],
  ];

  for (const [label, value, done] of anchors) {
    const item = document.createElement("div");
    item.className = done ? "is-done" : "";
    item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    selectors.dailyGrid.append(item);
  }
}

function renderLatest(entries) {
  const latest = entries[0];
  selectors.latestContext.textContent = "";

  if (!latest) return;

  selectors.latestTitle.textContent = `${formatDate(latest.date, { weekday: "short" })}`;
  const signal = bodySignal(latest);
  const contexts = [
    [signal.label, signal.value, `signal is-${signal.className}`],
    ["Water", latest.hydration],
    ["Meals", latest.meals ? `${latest.meals}` : "not logged"],
    ["Protein", latest.protein ? "yes" : "not logged"],
    ["Sleep", latest.sleep],
    ["Energy", latest.energy ? `${latest.energy}/5` : "not logged"],
    ["Soreness", latest.soreness ? `${latest.soreness}/5` : "not logged"],
    ["Stress", latest.stress ? `${latest.stress}/5` : "not logged"],
  ];

  for (const [label, value, className] of contexts) {
    const item = document.createElement("div");
    if (className) item.className = className;
    item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    selectors.latestContext.append(item);
  }

  selectors.latestNote.textContent = latest.note || signal.note;
}

function renderMonths(entries) {
  selectors.monthGrid.textContent = "";

  for (const month of BLOCK.months) {
    const summary = summarise(entries, month.startDate, month.endDate);
    const card = document.createElement("article");
    card.className = "month-card recovery-card";
    card.innerHTML = `
      <h3>${month.name}</h3>
      <p>${summary.entries.length}/${summary.days} days logged</p>
      <div class="bar-group">
        ${barMarkup("Support points", summary.total, summary.target, "support")}
        ${barMarkup("Hydration", summary.hydration, summary.days, "hydration")}
        ${barMarkup("Food", summary.food, summary.days, "food")}
        ${barMarkup("Sleep", summary.sleep, summary.days, "sleep")}
      </div>
    `;
    selectors.monthGrid.append(card);
  }
}

function renderWeeks(entries, weeks) {
  selectors.weekGrid.textContent = "";

  for (const week of weeks) {
    const summary = summarise(entries, week.startDate, week.endDate);
    const complete = summary.total >= summary.target * 0.75;
    const current = isBetween(todayString(), week.startDate, week.endDate);
    const card = document.createElement("article");
    card.className = `week-card recovery-week-card${complete ? " is-complete" : ""}${current ? " is-current" : ""}`;
    card.innerHTML = `
      <strong>Week ${week.index}</strong>
      <small>${formatDate(week.startDate)} - ${formatDate(week.endDate)}</small>
      <div class="recovery-week-score">${summary.total} of ${summary.target} pts</div>
      <div class="week-dots" aria-label="${summary.entries.length} recovery days logged">
        ${dotMarkup(summary.entries.length, 7)}
      </div>
    `;
    selectors.weekGrid.append(card);
  }
}

function dotMarkup(done, target) {
  return Array.from({ length: target }, (_, index) => {
    return `<span class="dot ${index < done ? "done recovery" : ""}"></span>`;
  }).join("");
}

function renderLog(entries) {
  selectors.logList.textContent = "";
  selectors.logSummary.textContent = `${entries.length} recovery check-ins`;

  if (!entries.length) {
    selectors.logList.innerHTML = `<article class="activity-card"><h3>No recovery logs yet</h3><p>Start with water, meals, and sleep. Very glamorous. Deeply effective.</p></article>`;
    return;
  }

  for (const entry of entries.slice(0, 10)) {
    const score = scoreEntry(entry);
    const card = document.createElement("article");
    card.className = "activity-card recovery-log-card";
    card.innerHTML = `
      <h3>${formatDate(entry.date, { weekday: "short" })}</h3>
      <p>${score.total}/3 support points · water ${entry.hydration} · sleep ${entry.sleep}</p>
      <div class="activity-meta">
        <span class="pill hydration">water</span>
        <span class="pill food">food</span>
        <span class="pill sleep">sleep</span>
      </div>
    `;
    selectors.logList.append(card);
  }
}

function setChecked(name, value) {
  const options = selectors.form.querySelectorAll(`[name="${name}"]`);
  for (const option of options) {
    option.checked = option.type === "radio" ? option.value === value : Boolean(value);
  }
}

function updateRangeLabels() {
  for (const name of ["energy", "soreness", "stress"]) {
    const input = selectors.form.elements[name];
    const label = document.querySelector(`#${name}-value`);
    if (input && label) label.textContent = input.value;
  }
}

function fillForm(entry, date = defaultCheckInDate()) {
  selectors.form.reset();
  selectors.form.elements.date.value = entry?.date || date;
  selectors.form.elements.meals.value = entry?.meals ?? 0;
  selectors.form.elements.energy.value = entry?.energy || 3;
  selectors.form.elements.soreness.value = entry?.soreness || 3;
  selectors.form.elements.stress.value = entry?.stress || 3;
  selectors.form.elements.note.value = entry?.note || "";

  setChecked("hydration", entry?.hydration || "");
  setChecked("sleep", entry?.sleep || "");
  selectors.form.elements.protein.checked = Boolean(entry?.protein);
  selectors.form.elements.foodConsistent.checked = Boolean(entry?.foodConsistent);
  selectors.deleteEntry.hidden = !entry?.date || !entryForDate(entry.date);
  updateRangeLabels();
}

function entryForDate(date) {
  return recoveryEntries.find((entry) => entry.date === date);
}

function openCheckIn(date = defaultCheckInDate()) {
  fillForm(entryForDate(date) || { date });
  selectors.modal.showModal();
}

function fillWeeklyReviewForm(week) {
  const review = reviewForWeek(week.index);
  selectors.weeklyReviewForm.reset();
  selectors.weeklyReviewForm.elements.weekIndex.value = week.index;
  selectors.weeklyReviewForm.elements.worked.value = review?.worked || "";
  selectors.weeklyReviewForm.elements.blocked.value = review?.blocked || "";
  selectors.weeklyReviewForm.elements.tweak.value = review?.tweak || "";
  selectors.deleteWeeklyReview.hidden = !review;
}

function openWeeklyReview() {
  const week = getActiveWeek(getWeeks());
  fillWeeklyReviewForm(week);
  selectors.weeklyReviewModal.showModal();
}

function saveEntryFromForm() {
  const formData = new FormData(selectors.form);
  const entry = normaliseEntry({
    date: formData.get("date"),
    hydration: formData.get("hydration"),
    meals: formData.get("meals"),
    foodConsistent: formData.has("foodConsistent"),
    protein: formData.has("protein"),
    sleep: formData.get("sleep"),
    energy: formData.get("energy"),
    soreness: formData.get("soreness"),
    stress: formData.get("stress"),
    note: formData.get("note"),
  });

  const stored = loadStoredEntries().filter((item) => item.date !== entry.date);
  stored.push(entry);
  saveStoredEntries(stored.sort((a, b) => (a.date < b.date ? 1 : -1)));
}

function deleteEntryForDate(date) {
  saveStoredEntries(loadStoredEntries().filter((entry) => entry.date !== date));
}

function saveWeeklyReviewFromForm() {
  const formData = new FormData(selectors.weeklyReviewForm);
  const weekIndex = Number(formData.get("weekIndex"));
  const worked = formData.get("worked").trim();
  const blocked = formData.get("blocked").trim();
  const tweak = formData.get("tweak").trim();

  if (!worked && !blocked && !tweak) {
    deleteWeeklyReviewForWeek(weekIndex);
    return;
  }

  const review = normaliseReview({
    weekIndex,
    worked,
    blocked,
    tweak,
    updatedAt: new Date().toISOString(),
  });
  const reviews = loadStoredReviews().filter((item) => item.weekIndex !== review.weekIndex);
  reviews.push(review);
  saveStoredReviews(reviews.sort((a, b) => a.weekIndex - b.weekIndex));
  weeklyReviews = loadStoredReviews();
}

function deleteWeeklyReviewForWeek(weekIndex) {
  saveStoredReviews(loadStoredReviews().filter((review) => review.weekIndex !== weekIndex));
  weeklyReviews = loadStoredReviews();
}

function renderPage() {
  const weeks = getWeeks();

  renderSupplyTrend(recoveryEntries, weeks);
  renderRecoveryChart(recoveryEntries);
  renderWeeklyReview(weeks);
  renderNoteThemes(recoveryEntries, weeks);
  renderDaily(recoveryEntries);
  renderLatest(recoveryEntries);
  renderMonths(recoveryEntries);
  renderWeeks(recoveryEntries, weeks);
  renderLog(recoveryEntries);

  selectors.updatedLabel.textContent = recoveryUpdatedAt
    ? `Seed data updated ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(recoveryUpdatedAt))}`
    : "Browser check-ins save instantly";
}

async function refreshEntries() {
  const { entries, updatedAt } = await loadRecoveryEntries();
  recoveryEntries = entries;
  recoveryUpdatedAt = updatedAt;
  weeklyReviews = loadStoredReviews();
  renderPage();
}

function bindForm() {
  selectors.openModal.addEventListener("click", () => openCheckIn());
  selectors.closeModal.addEventListener("click", () => selectors.modal.close());
  selectors.openWeeklyReview.addEventListener("click", openWeeklyReview);
  selectors.closeWeeklyReview.addEventListener("click", () => selectors.weeklyReviewModal.close());

  selectors.form.elements.date.addEventListener("change", (event) => {
    fillForm(entryForDate(event.target.value) || { date: event.target.value });
  });

  for (const name of ["energy", "soreness", "stress"]) {
    selectors.form.elements[name].addEventListener("input", updateRangeLabels);
  }

  selectors.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveEntryFromForm();
    selectors.modal.close();
    await refreshEntries();
  });

  selectors.deleteEntry.addEventListener("click", async () => {
    deleteEntryForDate(selectors.form.elements.date.value);
    selectors.modal.close();
    await refreshEntries();
  });

  selectors.weeklyReviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveWeeklyReviewFromForm();
    selectors.weeklyReviewModal.close();
    renderPage();
  });

  selectors.deleteWeeklyReview.addEventListener("click", () => {
    deleteWeeklyReviewForWeek(Number(selectors.weeklyReviewForm.elements.weekIndex.value));
    selectors.weeklyReviewModal.close();
    renderPage();
  });
}

async function init() {
  bindForm();
  await refreshEntries();
}

init();
