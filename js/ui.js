function renderUpcomingClasses() {
  const el = document.getElementById("upcomingClassesList");
  if (!el) return;

  const tt = getTimetableById(STATE.week1TimetableId);

  if (!tt) {
    el.innerHTML = `
      <p class="text-sm text-gray-500">
        Select a timetable to see upcoming classes.
      </p>
    `;
    return;
  }

  const overrides = STATE.weekOverrides?.week1 || {};
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const upcoming = [];

  const findSubject = (cell) => {
    const cellParts = String(cell || "")
      .toLowerCase()
      .split(/[\/\n,&+]/)
      .map((p) => clean(p.trim()))
      .filter(Boolean);

    return STATE.subjects.find((s) => {
      const subjectKey = clean(s.name);
      return cellParts.some((part) => {
        const p = SUBJECT_ALIASES[part] || part;
        return subjectKey.includes(p) || p.includes(subjectKey);
      });
    });
  };

  const date = new Date(now);
  date.setHours(0, 0, 0, 0);

  if (isUniversityHoliday(date)) {
    el.innerHTML = genZMode
      ? `
      <div class="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5 text-center">
        <div class="text-3xl mb-2">🎈</div>
        <p class="text-base font-bold text-indigo-400 uppercase tracking-widest">Absolute Cinema</p>
        <p class="text-xs text-gray-500 mt-1">
          Today is a holiday. Just vibes 🥂
        </p>
      </div>
    `
      : `
      <div class="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5 text-center">
        <div class="text-3xl mb-2">🥳</div>
        <p class="text-base font-bold text-indigo-400">It's a Holiday!</p>
        <p class="text-xs text-gray-500 mt-1">
          Today is a university holiday. Enjoy your break!
        </p>
      </div>
    `;
    return;
  }

  const dayIdx = date.getDay();

  const row = tt.rows.find(
    (r) => weekdayOrderIndex(r.day) === (dayIdx === 0 ? 7 : dayIdx),
  );

  if (row) {
    const dayKey = normalizeDayName(row.day);

    if (!overrides.suspendedDays?.includes(dayKey)) {
      row.hours.forEach((cell, hIdx) => {
        if (upcoming.length >= 10) return;

        const text = String(cell || "").trim();

        if (!text || text.toLowerCase().includes("holiday")) return;

        const sched = HOUR_SCHEDULE[hIdx];
        if (!sched) return;

        const [sh, sm] = sched.start.split(":").map(Number);
        const [eh, em] = sched.end.split(":").map(Number);

        const startMinutes = sh * 60 + sm;
        const endMinutes = eh * 60 + em;

        if (currentMinutes >= endMinutes) {
          return;
        }

        const subject = findSubject(text);

        if (!subject) return;

        const suspendedSubjects = overrides.suspendedSubjects?.[dayKey] || [];

        const isSuspended = suspendedSubjects.some(
          (s) => clean(s) === clean(subject.name),
        );

        if (isSuspended) return;

        const currentAttended =
          (subject.attended || 0) + (subject.dutyLeave || 0);

        const currentTotal = subject.total || 0;

        const currentPct = currentTotal
          ? (currentAttended / currentTotal) * 100
          : 0;

        const afterAttended = currentAttended + 1;
        const afterTotal = currentTotal + 1;

        const afterAbsent = currentAttended;
        const afterAbsentTotal = currentTotal + 1;

        const afterPct = (afterAttended / afterTotal) * 100;

        const afterAbsentPct = (afterAbsent / afterAbsentTotal) * 100;

        const { need, bunk } = calcNeedAndBunk(
          {
            attended: afterAttended,
            total: afterTotal,
          },
          STATE.target,
        );

        const isNow =
          currentMinutes >= startMinutes && currentMinutes < endMinutes;

        upcoming.push({
          subject,
          sched,
          date,
          currentPct,
          afterPct,
          afterAbsentPct,
          need,
          bunk,
          isNow,
        });
      });
    }
  }

  if (!upcoming.length) {
    el.innerHTML = `
      <div class="text-center py-3">
        <p class="text-sm text-gray-400">${genZMode ? "Zero classes left." : "No upcoming classes."}</p>
        <p class="text-xs text-gray-500 mt-1">
          ${genZMode ? "You've Handled Today ✓" : "You're done for today ✓"}
        </p>
      </div>
    `;
    return;
  }

  el.innerHTML = upcoming
    .map((item) => {
      const dayLabel =
        item.date.toDateString() === now.toDateString()
          ? "Today"
          : item.date.toLocaleDateString("en-US", {
              weekday: "short",
            });

      const bunkText =
        item.need > 0
          ? genZMode
            ? `Dial In ${item.need}`
            : `+${item.need} needed`
          : genZMode
            ? `+${item.bunk} Aura`
            : `${item.bunk} safe bunks`;

      const bunkClass = item.need > 0 ? "text-yellow-400" : "text-green-400";

      return `
        <div class="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                ${
                  item.isNow
                    ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">
                        NOW
                       </span>`
                    : `<span class="text-xs text-indigo-400 font-medium">
                        ${dayLabel}
                       </span>`
                }

                <span class="text-xs text-gray-500">
                  ${item.sched.label}
                </span>
              </div>

              <p class="text-sm font-semibold truncate mt-1">
                ${escapeHtml(item.subject.name)}
              </p>
            </div>

            <div class="text-right shrink-0">
              <p class="text-sm font-semibold">
                ${item.sched.start}
              </p>
              <p class="text-[11px] text-gray-500">
                ${item.sched.end}
              </p>
            </div>
          </div>

          <div class="flex items-center justify-between mt-2 pt-2 border-t border-white/5 flex-wrap gap-1 sm:gap-2">
            <div class="text-[11px] sm:text-xs font-medium">
              <span class="${
                item.afterAbsentPct >= STATE.target
                  ? "text-green-400"
                  : item.afterAbsentPct >= STATE.target - 10
                    ? "text-yellow-400"
                    : "text-red-400"
              }">
                ${item.afterAbsentPct.toFixed(1)}%(A)
              </span>
              <span class="mx-0.5 sm:mx-1 text-gray-500">←</span>
              <span class="text-gray-300">
                ${item.currentPct.toFixed(1)}%
              </span>
              <span class="mx-0.5 sm:mx-1 text-gray-500">→</span>
              <span class="${
                item.afterPct >= STATE.target
                  ? "text-green-400"
                  : item.afterPct >= STATE.target - 10
                    ? "text-yellow-400"
                    : "text-red-400"
              }">
                ${item.afterPct.toFixed(1)}%(P)
              </span>
            </div>

            <div class="${bunkClass} text-[11px] sm:text-xs font-semibold shrink-0">
              ${bunkText}
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

// 9. DASHBOARD
// ─────────────────────────────────────────────
function renderDashboard() {
  const { totalAttended, totalClasses, overall } = calcStats(STATE.subjects);

  const overallEl = document.getElementById("dashOverall");
  if (overallEl)
    overallEl.textContent = totalClasses ? overall.toFixed(1) + "%" : "--%";

  const barEl = document.getElementById("dashOverallBar");
  if (barEl) barEl.style.width = overall.toFixed(1) + "%";

  const presentLabel = document.getElementById("dashPresentLabel");
  const presentSub = document.getElementById("dashPresentSub");
  const absentLabel = document.getElementById("dashAbsentLabel");
  const absentSub = document.getElementById("dashAbsentSub");
  const statusSub = document.getElementById("dashStatusSub");

  if (genZMode) {
    if (presentLabel) presentLabel.textContent = "W's Secured";
    if (presentSub) presentSub.textContent = "Classes handled";
    if (absentLabel) absentLabel.textContent = "L's Taken";
    if (absentSub) absentSub.textContent = "Classes ghosted";
    if (statusSub) statusSub.textContent = "Vibe Check";
  } else {
    if (presentLabel) presentLabel.textContent = "Present";
    if (presentSub) presentSub.textContent = "Total classes attended";
    if (absentLabel) absentLabel.textContent = "Absent";
    if (absentSub) absentSub.textContent = "Missed classes";
    if (statusSub)
      statusSub.innerHTML = `vs <span id="dashTarget">${STATE.target}%</span> target`;
  }

  const presentVal = document.getElementById("dashPresent");
  if (presentVal) presentVal.textContent = totalClasses ? totalAttended : "--";

  const absentVal = document.getElementById("dashAbsent");
  if (absentVal)
    absentVal.textContent = totalClasses ? totalClasses - totalAttended : "--";

  // Re-check targetEl if it wasn't wiped by .textContent
  const targetEl = document.getElementById("dashTarget");
  if (targetEl) targetEl.textContent = STATE.target + "%";

  const statusEl = document.getElementById("dashStatus");
  if (statusEl) {
    if (totalClasses) {
      const ok = overall >= STATE.target;
      statusEl.textContent = ok ? getStatusText("safe") : getStatusText("risk");
      statusEl.className =
        "text-2xl font-bold " + (ok ? "text-green-400" : "text-red-400");
    } else {
      statusEl.textContent = "--";
      statusEl.className = "text-2xl font-bold";
    }
  }

  renderUpcomingClasses();

  const listEl = document.getElementById("dashSubjectList");
  if (!listEl) return;

  if (!STATE.subjects.length) {
    listEl.innerHTML = `<div class="card p-8 text-center text-gray-500 text-sm">
      <i class="fas fa-cloud-upload-alt text-2xl mb-2 block"></i>
      Import an Excel report or add subjects manually to get started.
    </div>`;
    return;
  }

  listEl.innerHTML = "";
  STATE.subjects.forEach((s) => {
    const pct = s.total
      ? (((s.attended || 0) + (s.dutyLeave || 0)) / s.total) * 100
      : 0;
    const { need, bunk } = calcNeedAndBunk(s, STATE.target);
    const cls = pctClass(pct);

    const card = document.createElement("div");
    card.className = "card p-3 flex items-center gap-3";

    const mainInfo = document.createElement("div");
    mainInfo.className = "flex-1 min-w-0";

    const nameP = document.createElement("p");
    nameP.className = "text-sm font-medium truncate";
    nameP.textContent = s.name;
    nameP.title = s.name;
    mainInfo.appendChild(nameP);

    const track = document.createElement("div");
    track.className = "progress-track h-1 mt-1.5";
    const fill = document.createElement("div");
    fill.className = `progress-fill ${
      pct >= STATE.target
        ? "bg-green-500"
        : pct >= STATE.target - 10
          ? "bg-yellow-500"
          : "bg-red-500"
    }`;
    fill.style.width = `${pct.toFixed(1)}%`;
    track.appendChild(fill);
    mainInfo.appendChild(track);

    card.appendChild(mainInfo);

    const rightGroup = document.createElement("div");
    rightGroup.className = "text-right flex-shrink-0 flex flex-col items-end justify-center min-w-[75px]";

    const topRow = document.createElement("div");
    topRow.className = "flex items-center gap-1.5 justify-end";

    const pctSpan = document.createElement("span");
    pctSpan.className = `text-sm font-bold ${cls}`;
    pctSpan.textContent = `${pct.toFixed(1)}%`;
    topRow.appendChild(pctSpan);
    rightGroup.appendChild(topRow);

    const bottomRow = document.createElement("div");
    bottomRow.className = "flex items-center gap-1.5 justify-end text-[11px] sm:text-xs";

    const countsSpan = document.createElement("span");
    countsSpan.className = "text-gray-500 font-medium";
    countsSpan.textContent = genZMode
      ? `${(s.attended || 0) + (s.dutyLeave || 0)} Done`
      : `${(s.attended || 0) + (s.dutyLeave || 0)}/${s.total}`;
    bottomRow.appendChild(countsSpan);

    const dot = document.createElement("span");
    dot.className = "text-gray-600";
    dot.textContent = "•";
    bottomRow.appendChild(dot);

    const statusSpan = document.createElement("span");
    if (need > 0) {
      statusSpan.className = "text-yellow-400 font-semibold";
      statusSpan.textContent = genZMode ? `+${need}` : `Need ${need}`;
    } else {
      statusSpan.className = "text-green-400 font-semibold";
      statusSpan.textContent = genZMode
        ? `+${bunk}`
        : `${bunk} safe`;
    }
    bottomRow.appendChild(statusSpan);
    rightGroup.appendChild(bottomRow);

    card.appendChild(rightGroup);

    listEl.appendChild(card);
  });
}

// ─────────────────────────────────────────────
// 10. ATTENDANCE PAGE
// ─────────────────────────────────────────────
function renderAttendancePage() {
  renderAttendanceTable();
  populateCalcSubjects();
  renderCalcChart();
}

function renderAttendanceTable() {
  const tbody = document.getElementById("attendanceTableBody");
  if (!tbody) return;

  if (!STATE.subjects.length) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="px-4 py-6 text-center text-gray-500 text-sm">No subjects yet. Import Excel or add manually.</td></tr>';
    return;
  }

  tbody.innerHTML = "";
  STATE.subjects.forEach((s) => {
    const pct = s.total
      ? (((s.attended || 0) + (s.dutyLeave || 0)) / s.total) * 100
      : 0;
    const cls = pctClass(pct);

    const tr = document.createElement("tr");
    tr.className = "border-b border-white/5 hover:bg-white/2";

    const tdName = document.createElement("td");
    tdName.className = "px-4 py-3 text-sm font-medium";
    tdName.textContent = s.name;
    tr.appendChild(tdName);

    const tdAttended = document.createElement("td");
    tdAttended.className = "px-4 py-3 text-center text-sm";
    tdAttended.textContent = (s.attended || 0) + (s.dutyLeave || 0);
    tr.appendChild(tdAttended);

    const tdTotal = document.createElement("td");
    tdTotal.className = "px-4 py-3 text-center text-sm";
    tdTotal.textContent = s.total;
    tr.appendChild(tdTotal);

    const tdPct = document.createElement("td");
    tdPct.className = "px-4 py-3 text-center";
    const pctSpan = document.createElement("span");
    pctSpan.className = `font-semibold text-sm ${cls}`;
    pctSpan.textContent = `${pct.toFixed(1)}%`;
    tdPct.appendChild(pctSpan);
    tr.appendChild(tdPct);

    const tdActions = document.createElement("td");
    tdActions.className = "px-4 py-3 text-right";
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "flex gap-1 justify-end";

    const createBtn = (btnClass, iconClass, title, onClick) => {
      const btn = document.createElement("button");
      btn.className = btnClass;
      btn.style.padding = "4px 8px";
      btn.title = title;
      btn.onclick = onClick;
      const i = document.createElement("i");
      i.className = iconClass;
      btn.appendChild(i);
      return btn;
    };

    actionsDiv.appendChild(
      createBtn("btn-success", "fas fa-check", "Present", () =>
        markAttendance(s.id, "present"),
      ),
    );
    actionsDiv.appendChild(
      createBtn("btn-danger", "fas fa-times", "Absent", () =>
        markAttendance(s.id, "absent"),
      ),
    );
    actionsDiv.appendChild(
      createBtn("btn-ghost", "fas fa-edit", "Edit", () =>
        openEditSubjectModal(s.id),
      ),
    );
    actionsDiv.appendChild(
      createBtn("btn-danger", "fas fa-trash", "Delete", () =>
        deleteSubject(s.id),
      ),
    );

    tdActions.appendChild(actionsDiv);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

// ─────────────────────────────────────────────
// 15. SIDEBAR PROFILE / TARGET
// ─────────────────────────────────────────────
function setTarget(t) {
  STATE.target = t;
  saveState();
  updateTargetUI();
  renderDashboard();
  renderAttendancePage();
  renderPredictionPage();
  renderAnalyticsPage();
  renderCalc();
  renderQuickCalc();
}

function updateTargetUI() {
  const t = STATE.target;
  const el = document.getElementById("sideTarget");
  if (el) el.textContent = t + "%";
  document.querySelectorAll(".target-btn").forEach((b) => {
    const active = Number(b.dataset.t) === t;
    b.style.opacity = active ? "1" : "0.5";
    b.style.outline = active ? "2px solid currentColor" : "none";
  });
}

// ─────────────────────────────────────────────
// 17. CONFIRM MODAL
// ─────────────────────────────────────────────
let _confirmCallback = null;

function confirmAction(msg, cb, options = {}) {
  closeManageData(); // Hide Manage Data first

  _confirmCallback = cb;
  const titleEl = document.getElementById("confirmTitle");
  if (titleEl) titleEl.textContent = options.title || "Confirm";
  const msgEl = document.getElementById("confirmMsg");
  if (msgEl) msgEl.textContent = msg;
  const okBtn = document.getElementById("confirmOk");
  if (okBtn) {
    okBtn.className = options.btnClass || "btn-danger";
    okBtn.textContent = options.btnText || "Confirm";
  }
  document.getElementById("confirmModal").classList.add("open");
}
function closeConfirm() {
  _confirmCallback = null;
  document.getElementById("confirmModal").classList.remove("open");
}
document.getElementById("confirmOk").addEventListener("click", () => {
  if (_confirmCallback) _confirmCallback();
  closeConfirm();
});

// ─────────────────────────────────────────────
// 18. TOAST
// ─────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

function checkAttendanceReportStatus() {
  const box = document.getElementById("uploadZone");
  const content = document.getElementById("uploadZoneContent");
  if (!box || !content || !STATE.lastAttendanceReportDate) return;

  const reportDate = new Date(STATE.lastAttendanceReportDate);
  const today = new Date();

  reportDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const daysOld = Math.floor((today - reportDate) / (1000 * 60 * 60 * 24));

  if (daysOld >= 1) {
    box.classList.remove("border-indigo-500");
    box.classList.add("border-2", "border-warning-flash");
    content.innerHTML = genZMode
      ? `
    <div class="text-center">
        <button type="button" class="help-btn absolute top-3 right-3" data-action="help" data-target="helpAttendanceModal" title="How to get attendance Excel">i</button>
        <div class="text-4xl mb-3">🚨</div>
        <p class="text-lg font-semibold text-orange-400">
            Ancient data detected. That's a massive L 💀
        </p>
        <p class="text-sm text-gray-500 mt-2">
            Upload the latest Excel.
            <br>
            These stats are giving NPC vibes.
        </p>
    </div>
  `
      : `
    <div class="text-center">
        <button type="button" class="help-btn absolute top-3 right-3" data-action="help" data-target="helpAttendanceModal" title="How to get attendance Excel">i</button>
        <div class="text-4xl mb-3">⚠️</div>
        <p class="text-lg font-semibold text-orange-400">
            Attendance Report Outdated
        </p>
        <p class="text-sm text-gray-500 mt-2">
            Your attendance report is no longer up to date.
            <br>
            Please upload the latest Excel report.
        </p>
    </div>
  `;
  } else {
    // Restore default state
    box.classList.remove("border-2", "border-warning-flash");
    box.classList.add("border-indigo-500");
    content.innerHTML = `
      <button type="button" class="help-btn absolute top-3 right-3" data-action="help"
        data-target="helpAttendanceModal" title="How to get attendance Excel">
        i
      </button>
      <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-indigo-500/10 flex items-center justify-center">
        <i class="fas fa-file-excel text-indigo-400 text-xl"></i>
      </div>
      <p class="text-sm font-medium text-gray-300">Drop your attendance Excel here</p>
      <p class="text-xs text-gray-500 mt-1">.xlsx / .xls supported</p>
    `;
  }
}

// ─────────────────────────────────────────────
// 20. HELP MODALS
// ─────────────────────────────────────────────
function openHelpModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("open");
}
function closeHelpModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("open");
}

// ─────────────────────────────────────────────
function toggleTheme() {
  document.body.classList.toggle("light-theme");

  const icon = document.getElementById("themeIcon");

  if (document.body.classList.contains("light-theme")) {
    if (icon) icon.className = "fas fa-sun text-yellow-500";
    localStorage.setItem("theme", "light");
  } else {
    if (icon) icon.className = "fas fa-moon text-yellow-300";
    localStorage.setItem("theme", "dark");
  }
  const meta = document.querySelector('meta[name="theme-color"]');

  if (meta) {
    meta.setAttribute(
      "content",
      document.body.classList.contains("light-theme") ? "#f8fafc" : "#0a0a0b",
    );
  }
  refreshAll();
}

function toggleGenZMode() {
  genZMode = !genZMode;

  localStorage.setItem("genZMode", genZMode);

  const btn = document.getElementById("genZBtn");

  if (btn) {
    btn.classList.toggle("bg-indigo-600", genZMode);
    btn.classList.toggle("text-white", genZMode);
    btn.classList.toggle("bg-white/5", !genZMode);
  }

  showToast(genZMode ? "Gen Z Mode Enabled" : "Gen Z Mode Disabled");

  checkAttendanceReportStatus();
  updateTargetUI();

  refreshAll(); // Refresh current page
  renderCgpaCalc(); // Recalculate CGPA card
}
