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

const selectors = {
  dailyTitle: document.querySelector("#daily-support-title-text"),
  dailyNote: document.querySelector("#daily-support-note"),
  dailyGrid: document.querySelector("#daily-support-grid"),
  latestTitle: document.querySelector("#latest-recovery-title"),
  latestContext: document.querySelector("#latest-recovery-context"),
  latestNote: document.querySelector("#latest-recovery-note"),
  supplyTrend: document.querySelector("#supply-trend-grid"),
  supplyTrendNote: document.querySelector("#supply-trend-note"),
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

function renderPage() {
  const weeks = getWeeks();

  renderSupplyTrend(recoveryEntries, weeks);
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
  renderPage();
}

function bindForm() {
  selectors.openModal.addEventListener("click", () => openCheckIn());
  selectors.closeModal.addEventListener("click", () => selectors.modal.close());

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
}

async function init() {
  bindForm();
  await refreshEntries();
}

init();
