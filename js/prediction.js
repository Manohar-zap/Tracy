// 7. PREDICTION ENGINE (redesigned)
// ─────────────────────────────────────────────

function normalizeDayName(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

// Returns Mon=1 .. Sat=6, Sun=7 (so a Mon-Sun week sorts naturally)
function weekdayOrderIndex(dayLabel) {
  const norm = normalizeDayName(dayLabel);
  const idx = DAY_ORDER.findIndex((d) => norm.includes(d) || d.includes(norm));
  if (idx === -1) return -1;
  return idx === 0 ? 7 : idx;
}

function getDateForTimetableDay(dayLabel, weekOffset = 0) {
  const dayIdx = weekdayOrderIndex(dayLabel);
  if (dayIdx === -1) return null;

  const today = new Date();
  const todayIdx = getTodayOrderIdx();

  let daysUntil = dayIdx - todayIdx;

  if (daysUntil < 0) {
    daysUntil += 7;
  }

  daysUntil += weekOffset * 7;

  const date = new Date(today);
  date.setHours(0, 0, 0, 0);
  date.setDate(today.getDate() + daysUntil);

  return date;
}

function getTodayOrderIdx() {
  const d = new Date().getDay(); // 0 Sun .. 6 Sat
  return d === 0 ? 7 : d;
}

function countSubjectInRows(
  rows,
  subjectName,
  minOrderIdx,
  overrides,
  weekOffset = 0,
) {
  const clean = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const sKey = clean(subjectName);
  let count = 0;

  rows.forEach((row) => {
    if (row.isHoliday) return;

    const holidayDate = getDateForTimetableDay(row.day, weekOffset);
    if (!holidayDate) return;

    if (isUniversityHoliday(holidayDate)) {
      return;
    }
    const dayKey = normalizeDayName(row.day);

    if (overrides?.suspendedDays?.includes(dayKey)) {
      return;
    }

    if (minOrderIdx !== undefined) {
      const orderIdx = weekdayOrderIndex(row.day);
      if (orderIdx === -1 || orderIdx < minOrderIdx) {
        return;
      }
    }

    const suspended = overrides?.suspendedSubjects?.[dayKey] || [];

    row.hours.forEach((cell) => {
      const text = String(cell || "").trim();

      if (!text) return;
      if (text.toLowerCase().includes("holiday")) return;

      const blocked = suspended.some(
        (subj) => clean(subj) === clean(subjectName),
      );

      if (blocked) return;

      // Split cells containing multiple subjects
      const subjectsInCell = text
        .split(/\n|\/|,|&|\+/)
        .map((s) => s.trim())
        .filter(Boolean);

      subjectsInCell.forEach((sub) => {
        let tKey = clean(sub);

        if (SUBJECT_ALIASES[tKey]) {
          tKey = SUBJECT_ALIASES[tKey];
        }

        if (sKey.includes(tKey) || tKey.includes(sKey)) {
          count++;
        }
      });
    });
  });

  if (overrides) {
    ["saturday", "sunday"].forEach((day) => {
      (overrides[day] || []).forEach((item) => {
        const a = clean(item.subject);
        const b = clean(subjectName);

        if (a.includes(b) || b.includes(a)) {
          count++;
        }
      });
    });
  }

  return count;
}

function showWrongTimetableModal() {
  confirmAction(
    "None of your attendance subjects match the selected timetable.\n\nPlease select the correct section timetable.",
    () => {
      navigateTo("timetable");
    },
  );
}

function renderPredictionPage() {
  const tt = getTimetableById(STATE.week1TimetableId);

  if (!guideMode && tt && STATE.subjects.length) {
    let matches = 0;

    STATE.subjects.forEach((s) => {
      matches += countSubjectInRows(
        tt.rows,
        s.name,
        undefined,
        STATE.weekOverrides.week1,
      );
    });

    if (matches === 0) {
      showWrongTimetableModal();
      return;
    }
  }

  renderPredTable("predTable1", 1);
  renderPredTable("predTable2", 2);
  renderPredCards();
}

function getShortSubjectName(name) {
  const code = name.match(/\(([^)]+)\)/);
  if (code) return code[1];

  const words = name.replace(/[()]/g, "").split(/\s+/).filter(Boolean);

  if (words.length > 1) {
    return words
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }

  return name;
}

function renderPredTable(tableId, weekNum) {
  const tbody = document.getElementById(tableId);
  if (!tbody) return;

  if (!STATE.subjects.length) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="py-4 text-center text-gray-500 text-sm">Add subjects first.</td></tr>';
    return;
  }

  const w1 = getTimetableById(STATE.week1TimetableId);
  const w2 = getTimetableById(STATE.week2TimetableId);

  if (!w1 && !w2) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="py-4 text-center text-gray-500 text-sm">Select a timetable on the Timetable page first.</td></tr>';
    return;
  }

  let todayIdx = getTodayOrderIdx();
  const now = new Date();
  if (now.getHours() >= 17) {
    todayIdx++;
  }

  tbody.innerHTML = "";
  STATE.subjects.forEach((s) => {
    let extra;
    if (weekNum === 1) {
      extra = w1
        ? countSubjectInRows(
            w1.rows,
            s.name,
            todayIdx,
            STATE.weekOverrides.week1,
            0,
          )
        : 0;
    } else {
      const week1Remainder = w1
        ? countSubjectInRows(
            w1.rows,
            s.name,
            todayIdx,
            STATE.weekOverrides.week1,
            1,
          )
        : 0;
      const week2Full = w2
        ? countSubjectInRows(
            w2.rows,
            s.name,
            undefined,
            STATE.weekOverrides.week2,
            1,
          )
        : 0;
      extra = week1Remainder + week2Full;
    }

    const newA = (s.attended || 0) + (s.dutyLeave || 0) + extra;
    const newT = s.total + extra;
    const pct = newT ? (newA / newT) * 100 : 0;
    const { need, bunk } = calcNeedAndBunk(
      { attended: newA, total: newT },
      STATE.target,
    );
    const cls =
      pct >= STATE.target
        ? "text-green-400"
        : pct >= STATE.target - 10
          ? "text-yellow-400"
          : "text-red-400";

    const tr = document.createElement("tr");
    tr.className = "border-b border-white/5";

    const tdName = document.createElement("td");
    tdName.className = "py-2 pr-2 max-w-[100px] truncate";
    tdName.title = s.name;
    tdName.textContent = getShortSubjectName(s.name);
    tr.appendChild(tdName);

    const tdExtra = document.createElement("td");
    tdExtra.className = "py-2 text-indigo-400";
    tdExtra.textContent = `+${extra}`;
    tr.appendChild(tdExtra);

    const tdPresent = document.createElement("td");
    tdPresent.className = "py-2";
    tdPresent.textContent = newA;
    tr.appendChild(tdPresent);

    const tdTotal = document.createElement("td");
    tdTotal.className = "py-2";
    tdTotal.textContent = newT;
    tr.appendChild(tdTotal);

    const tdPct = document.createElement("td");
    tdPct.className = `py-2 font-semibold ${cls}`;
    tdPct.textContent = `${pct.toFixed(1)}%`;
    tr.appendChild(tdPct);

    const tdBunk = document.createElement("td");
    tdBunk.className = `py-2 text-xs ${bunk > 0 ? "text-green-400" : "text-gray-500"}`;
    tdBunk.textContent =
      bunk > 0
        ? genZMode
          ? `+${bunk} Aura`
          : `${bunk} safe`
        : need > 0
          ? genZMode
            ? `Dial In ${need}`
            : `+${need} req`
          : "0";
    tr.appendChild(tdBunk);

    tbody.appendChild(tr);
  });
}

function renderPredCards() {
  const el = document.getElementById("predCards");
  if (!el) return;

  const week = document.getElementById("predCardsWeekSelect")?.value || "current";

  const w1 = getTimetableById(STATE.week1TimetableId);
  const w2 = getTimetableById(STATE.week2TimetableId);
  let todayIdx = getTodayOrderIdx();
  const now = new Date();
  if (now.getHours() >= 17) {
    todayIdx++;
  }

  if (!STATE.subjects.length) {
    el.innerHTML =
      '<p class="text-gray-500 text-sm col-span-full">No subjects loaded.</p>';
    return;
  }

  el.innerHTML = "";
  [...STATE.subjects]
    .sort((a, b) => {
      const aPct = a.total ? (a.attended / a.total) * 100 : 0;
      const bPct = b.total ? (b.attended / b.total) * 100 : 0;
      return aPct - bPct; // ascending
    })
    .forEach((s) => {
      let extra = 0;

      if (week === "current" || week === "0") {
        extra = 0;
      } else if (week === "1") {
        extra = w1
          ? countSubjectInRows(
              w1.rows,
              s.name,
              todayIdx,
              STATE.weekOverrides.week1,
              0,
            )
          : 0;
      } else if (week === "2") {
        const week1Remainder = w1
          ? countSubjectInRows(
              w1.rows,
              s.name,
              todayIdx,
              STATE.weekOverrides.week1,
              0,
            )
          : 0;

        const week2Full = w2
          ? countSubjectInRows(
              w2.rows,
              s.name,
              undefined,
              STATE.weekOverrides.week2,
              1,
            )
          : 0;

        extra = week1Remainder + week2Full;
      }

      const futureAttended = (s.attended || 0) + (s.dutyLeave || 0) + extra;
      const futureTotal = s.total + extra;
      const pct = futureTotal ? (futureAttended / futureTotal) * 100 : 0;

      const { need, bunk } = calcNeedAndBunk(
        {
          attended: futureAttended,
          total: futureTotal,
        },
        STATE.target,
      );

      let cls = "pct-danger";

      if (pct >= STATE.target) {
        cls = "pct-safe";
      } else if (pct >= STATE.target - 10) {
        cls = "pct-warn";
      }

      const card = document.createElement("div");
      card.className = "sub-card cursor-pointer";
      card.dataset.action = "open-subj-pred";
      card.dataset.id = s.id;

      const nameP = document.createElement("p");
      nameP.className = "text-xs font-medium truncate text-gray-300 mb-1";
      nameP.textContent = s.name;
      card.appendChild(nameP);

      const pctP = document.createElement("p");
      pctP.className = `text-xl font-bold ${cls} mb-1`;
      pctP.textContent = `${pct.toFixed(1)}%`;
      card.appendChild(pctP);

      const countsP = document.createElement("p");
      countsP.className = "text-xs text-gray-500";
      countsP.textContent = `${futureAttended}/${futureTotal}`;
      card.appendChild(countsP);

      const extraP = document.createElement("p");
      extraP.className = "text-xs text-indigo-400 mt-1";
      extraP.textContent = extra > 0 ? `+${extra} classes` : "Current Status";
      card.appendChild(extraP);

      const statusP = document.createElement("p");
      statusP.className = `text-xs mt-2 ${need > 0 ? "text-yellow-400" : "text-green-400"}`;
      statusP.textContent =
        need > 0
          ? genZMode
            ? `Dial In (${need})`
            : `+${need} needed for ${STATE.target}%`
          : genZMode
            ? `+${bunk} Aura`
            : `${bunk} safe bunks`;
      card.appendChild(statusP);

      el.appendChild(card);
    });
}

function getStatusText(type) {
  if (!genZMode) {
    return {
      safe: "Safe ✓",
      warning: "Warning",
      risk: "At Risk",
    }[type];
  }

  return {
    safe: "Goated",
    warning: "Sketchy",
    risk: "Cooked",
  }[type];
}

function openSubjectPredictionModal(id) {
  const s = STATE.subjects.find((subj) => subj.id === id);
  if (!s) return;

  const modal = document.getElementById("subjectPredictionModal");
  document.getElementById("subjPredTitle").textContent = s.name;
  const listEl = document.getElementById("subjPredList");
  listEl.innerHTML = "";

  const w1 = getTimetableById(STATE.week1TimetableId);
  const w2 = getTimetableById(STATE.week2TimetableId);

  const classes = [];
  const todayIdx = getTodayOrderIdx();
  const now = new Date();
  const effectiveTodayIdx = now.getHours() >= 17 ? todayIdx + 1 : todayIdx;

  const collect = (tt, weekOffset, label) => {
    if (!tt) return;
    tt.rows.forEach((row) => {
      if (row.isHoliday) return;
      const date = getDateForTimetableDay(row.day, weekOffset);
      if (!date || isUniversityHoliday(date)) return;

      const orderIdx = weekdayOrderIndex(row.day);
      if (weekOffset === 0 && orderIdx < effectiveTodayIdx) return;

      const dateStr = date.toISOString().split("T")[0];
      const displayDate = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      row.hours.forEach((cell, hIdx) => {
        const text = String(cell || "").trim();
        if (!text || text.toLowerCase().includes("holiday")) return;

        const cellParts = text.toLowerCase().split(/[\/\n,&+]/).map(p => clean(p.trim())).filter(Boolean);
        const subjectKey = clean(s.name);
        const match = cellParts.some(part => {
          const p = SUBJECT_ALIASES[part] || part;
          return subjectKey.includes(p) || p.includes(subjectKey);
        });

        if (match) {
          classes.push({
            dateStr,
            displayDate,
            hourIdx: hIdx,
            label: `${label} - Hr ${hIdx + 1}`,
            skipKey: `${dateStr}_${hIdx}`,
          });
        }
      });
    });
  };

  collect(w1, 0, "This Week");
  collect(w2, 1, "Next Week");

  if (classes.length === 0) {
    listEl.innerHTML = '<p class="text-center text-gray-500 py-10">No upcoming classes found in timetable.</p>';
    updateSubjPredResult(s, 0, 0);
  } else {
    const skipped = STATE.skippedPredictions?.[id] || [];
    classes.forEach((cls) => {
      const isSkipped = skipped.includes(cls.skipKey);
      const div = document.createElement("div");
      div.className = `p-3 rounded-xl border flex items-center justify-between transition-all ${
        isSkipped ? "border-red-500/30 bg-red-500/5 opacity-60" : "border-white/5 bg-white/5"
      }`;

      div.innerHTML = `
        <div>
          <p class="text-xs text-indigo-400 font-medium">${cls.displayDate}</p>
          <p class="text-sm font-semibold">${cls.label}</p>
        </div>
        <button class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
          isSkipped ? "bg-red-500 text-white" : "bg-white/10 text-gray-400 hover:bg-white/20"
        }" onclick="togglePredictionSkip('${id}', '${cls.skipKey}')">
          ${isSkipped ? (genZMode ? "Bunk" : "Missed") : (genZMode ? "Lock In" : "Attend")}
        </button>
      `;
      listEl.appendChild(div);
    });

    // Calculate simulated result for modal
    const totalPossible = classes.length;
    const willAttend = totalPossible - skipped.filter(k => classes.some(c => c.skipKey === k)).length;
    updateSubjPredResult(s, willAttend, totalPossible);
  }

  modal.classList.add("open");
}

function updateSubjPredResult(subject, willAttend, totalPossible) {
  const futureA = (subject.attended || 0) + (subject.dutyLeave || 0) + willAttend;
  const futureT = (subject.total || 0) + totalPossible;

  const pct = futureT ? (futureA / futureT) * 100 : 0;
  const { need, bunk } = calcNeedAndBunk({ attended: futureA, total: futureT }, STATE.target);

  const pctEl = document.getElementById("subjPredResultPct");
  const statusEl = document.getElementById("subjPredStatus");
  const bunkEl = document.getElementById("subjPredResultBunk");
  const needEl = document.getElementById("subjPredResultNeed");

  pctEl.textContent = `${pct.toFixed(1)}%`;
  bunkEl.textContent = bunk;
  needEl.textContent = need;

  if (pct >= STATE.target) {
    pctEl.className = "text-3xl md:text-4xl font-black text-green-400";
    statusEl.textContent = getStatusText("safe");
    statusEl.className = "text-xs font-bold text-green-500/80";
  } else if (pct >= STATE.target - 10) {
    pctEl.className = "text-3xl md:text-4xl font-black text-yellow-400";
    statusEl.textContent = getStatusText("warning");
    statusEl.className = "text-xs font-bold text-yellow-500/80";
  } else {
    pctEl.className = "text-3xl md:text-4xl font-black text-red-400";
    statusEl.textContent = getStatusText("risk");
    statusEl.className = "text-xs font-bold text-red-500/80";
  }
}

function togglePredictionSkip(subjectId, skipKey) {
  if (!STATE.skippedPredictions) STATE.skippedPredictions = {};
  if (!STATE.skippedPredictions[subjectId]) STATE.skippedPredictions[subjectId] = [];

  const list = STATE.skippedPredictions[subjectId];
  const idx = list.indexOf(skipKey);
  if (idx > -1) {
    list.splice(idx, 1);
  } else {
    list.push(skipKey);
  }

  saveState();
  openSubjectPredictionModal(subjectId); // Re-render modal only
}

function closeSubjPredModal() {
  document.getElementById("subjectPredictionModal").classList.remove("open");
}
// ─────────────────────────────────────────────
