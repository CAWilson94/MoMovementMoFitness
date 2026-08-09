const sideQuests = [
  {
    start: "2026-08-10",
    end: "2026-08-23",
    dates: "10-23 Aug",
    title: "Protect the bedtime",
    action: "Begin winding down deliberately on 4 nights each week.",
  },
  {
    start: "2026-08-24",
    end: "2026-09-06",
    dates: "24 Aug-6 Sep",
    title: "Keep the adventurer fed",
    action: "Make regular meals and post-training food the easy option.",
  },
  {
    start: "2026-09-07",
    end: "2026-09-20",
    dates: "7-20 Sep",
    title: "Hydration side quest",
    action: "Build a boringly reliable water routine.",
  },
  {
    start: "2026-09-21",
    end: "2026-10-04",
    dates: "21 Sep-4 Oct",
    title: "Recover from the harder quests",
    action: "Notice soreness, stress, and when an easy day needs to be easy.",
  },
  {
    start: "2026-10-05",
    end: "2026-10-18",
    dates: "5-18 Oct",
    title: "Defend the routine",
    action: "Keep the basics alive when work and life get noisy.",
  },
  {
    start: "2026-10-19",
    end: "2026-10-25",
    dates: "19-25 Oct",
    title: "Finish feeling human",
    action: "Choose sleep, sensible training, and a calm finish.",
  },
];

function localDate(value) {
  return new Date(`${value}T00:00:00`);
}

function currentSideQuest(today = new Date()) {
  const first = sideQuests[0];
  const last = sideQuests.at(-1);

  if (today < localDate(first.start)) return first;
  if (today > localDate(last.end)) return last;

  return sideQuests.find(
    (quest) => today >= localDate(quest.start) && today <= localDate(quest.end),
  ) || first;
}

function renderSideQuest() {
  const quest = currentSideQuest();

  document.querySelectorAll("[data-side-quest]").forEach((strip) => {
    strip.innerHTML = `
      <div class="side-quest-inner">
        <span class="side-quest-label">Current side quest</span>
        <strong class="side-quest-title">${quest.title}</strong>
        <span class="side-quest-action">${quest.action}</span>
        <span class="side-quest-dates">${quest.dates}</span>
      </div>
    `;
  });
}

renderSideQuest();
