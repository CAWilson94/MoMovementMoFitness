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

const selectors = {
  weekScore: document.querySelector("#recovery-week-score"),
  weekNote: document.querySelector("#recovery-week-note"),
  hydrationDone: document.querySelector("#hydration-done"),
  hydrationTarget: document.querySelector("#hydration-target"),
  foodDone: document.querySelector("#food-done"),
  foodTarget: document.querySelector("#food-target"),
  sleepDone: document.querySelector("#sleep-done"),
  sleepTarget: document.querySelector("#sleep-target"),
  latestTitle: document.querySelector("#latest-recovery-title"),
  latestContext: document.querySelector("#latest-recovery-context"),
  latestNote: document.querySelector("#latest-recovery-note"),
  monthGrid: document.querySelector("#recovery-month-grid"),
  weekGrid: document.querySelector("#recovery-week-grid"),
  logList: document.querySelector("#recovery-log-list"),
  logSummary: document.querySelector("#recovery-log-summary"),
  updatedLabel: document.querySelector("#recovery-updated-label"),
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

async function loadRecoveryEntries() {
  const data = await loadJson("data/recovery-log.json", { entries: [], updatedAt: null });
  const entries = (data.entries || [])
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

function setRecoveryRing(name, done, target) {
  const ring = document.querySelector(`[data-recovery-ring="${name}"]`);
  if (!ring) return;
  const degrees = target ? Math.min(done / target, 1) * 360 : 0;
  ring.style.setProperty("--progress", `${degrees}deg`);
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

function renderBlock(entries) {
  const block = summarise(entries, BLOCK.startDate, BLOCK.endDate);

  selectors.hydrationDone.textContent = block.hydration;
  selectors.foodDone.textContent = block.food;
  selectors.sleepDone.textContent = block.sleep;
  selectors.hydrationTarget.textContent = `/${block.days}`;
  selectors.foodTarget.textContent = `/${block.days}`;
  selectors.sleepTarget.textContent = `/${block.days}`;

  setRecoveryRing("hydration", block.hydration, block.days);
  setRecoveryRing("food", block.food, block.days);
  setRecoveryRing("sleep", block.sleep, block.days);
}

function renderCurrentWeek(entries, weeks) {
  const now = today().toISOString().slice(0, 10);
  const activeWeek =
    weeks.find((week) => isBetween(now, week.startDate, week.endDate)) ||
    weeks.find((week) => now < week.startDate) ||
    weeks[weeks.length - 1];
  const summary = summarise(entries, activeWeek.startDate, activeWeek.endDate);

  selectors.weekScore.textContent = `${summary.total}/${summary.target}`;
  if (!summary.entries.length) {
    selectors.weekNote.textContent = "No camp supplies logged yet.";
  } else if (summary.total >= summary.target * 0.75) {
    selectors.weekNote.textContent = "Supplies are looking suspiciously competent.";
  } else if (summary.total >= summary.target * 0.45) {
    selectors.weekNote.textContent = "Some support is in. Keep the basics boring.";
  } else {
    selectors.weekNote.textContent = "Tiny refill quest: water, food, sleep.";
  }
}

function renderLatest(entries) {
  const latest = entries[0];
  selectors.latestContext.textContent = "";

  if (!latest) return;

  selectors.latestTitle.textContent = `${formatDate(latest.date, { weekday: "short" })}`;
  const contexts = [
    ["Water", latest.hydration],
    ["Meals", latest.meals ? `${latest.meals}` : "not logged"],
    ["Protein", latest.protein ? "yes" : "not logged"],
    ["Sleep", latest.sleep],
    ["Energy", latest.energy ? `${latest.energy}/5` : "not logged"],
    ["Soreness", latest.soreness ? `${latest.soreness}/5` : "not logged"],
  ];

  for (const [label, value] of contexts) {
    const item = document.createElement("div");
    item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    selectors.latestContext.append(item);
  }

  selectors.latestNote.textContent = latest.note || "Logged. No dramatic subplot recorded.";
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
        ${barMarkup("Support", summary.total, summary.target, "support")}
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
    const current = isBetween(today().toISOString().slice(0, 10), week.startDate, week.endDate);
    const card = document.createElement("article");
    card.className = `week-card recovery-week-card${complete ? " is-complete" : ""}${current ? " is-current" : ""}`;
    card.innerHTML = `
      <strong>Week ${week.index}</strong>
      <small>${formatDate(week.startDate)} - ${formatDate(week.endDate)}</small>
      <div class="recovery-week-score">${summary.total}/${summary.target}</div>
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
      <p>${score.total}/3 support anchors · water ${entry.hydration} · sleep ${entry.sleep}</p>
      <div class="activity-meta">
        <span class="pill hydration">water</span>
        <span class="pill food">food</span>
        <span class="pill sleep">sleep</span>
      </div>
    `;
    selectors.logList.append(card);
  }
}

async function init() {
  const { entries, updatedAt } = await loadRecoveryEntries();
  const weeks = getWeeks();

  renderBlock(entries);
  renderCurrentWeek(entries, weeks);
  renderLatest(entries);
  renderMonths(entries);
  renderWeeks(entries, weeks);
  renderLog(entries);

  selectors.updatedLabel.textContent = updatedAt
    ? `Updated ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(updatedAt))}`
    : "Ready for first recovery logs";
}

init();
