// 9. DASHBOARD
// ─────────────────────────────────────────────
function renderDashboard() {
  const { totalAttended, totalClasses, overall } = calcStats(STATE.subjects);

  document.getElementById("dashOverall").textContent = totalClasses
    ? overall.toFixed(1) + "%"
    : "--%";
  document.getElementById("dashOverallBar").style.width =
    overall.toFixed(1) + "%";
  document.getElementById("dashPresent").textContent = totalClasses
    ? totalAttended
    : "--";
  document.getElementById("dashAbsent").textContent = totalClasses
    ? totalClasses - totalAttended
    : "--";
  document.getElementById("dashTarget").textContent = STATE.target + "%";

  const statusEl = document.getElementById("dashStatus");
  if (totalClasses) {
    const ok = overall >= STATE.target;
    statusEl.textContent = ok ? getStatusText("safe") : getStatusText("risk");
    statusEl.className =
      "text-2xl font-bold " + (ok ? "text-green-400" : "text-red-400");
  } else {
    statusEl.textContent = "--";
    statusEl.className = "text-2xl font-bold";
  }

  const listEl = document.getElementById("dashSubjectList");
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

    const rightInfo = document.createElement("div");
    rightInfo.className = "text-right flex-shrink-0";
    const pctSpan = document.createElement("span");
    pctSpan.className = `text-sm font-bold ${cls}`;
    pctSpan.textContent = `${pct.toFixed(1)}%`;
    rightInfo.appendChild(pctSpan);
    const countsP = document.createElement("p");
    countsP.className = "text-xs text-gray-500";
    countsP.textContent = `${(s.attended || 0) + (s.dutyLeave || 0)}/${s.total}`;
    rightInfo.appendChild(countsP);
    card.appendChild(rightInfo);

    const statusDiv = document.createElement("div");
    statusDiv.className = "text-right text-xs flex-shrink-0";
    const statusSpan = document.createElement("span");
    if (need > 0) {
      statusSpan.className = "text-yellow-400";
      statusSpan.textContent = genZMode ? `Lock In ${need}` : `Need +${need}`;
    } else {
      statusSpan.className = "text-green-400";
      statusSpan.textContent = genZMode
        ? `${bunk} Free Passes`
        : `${bunk} bunks safe`;
    }
    statusDiv.appendChild(statusSpan);
    card.appendChild(statusDiv);

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

function renderSidebarProfile() {
  const p = STATE.profile;
  if (!p || !Object.keys(p).length) return;
  setText("sideName", p.name || "Student");
  setText("sideDept", p.dept || "Department");
  setText("sideInitial", p.name ? p.name.charAt(0).toUpperCase() : "Z");
}

// ─────────────────────────────────────────────
// 17. CONFIRM MODAL
// ─────────────────────────────────────────────
let _confirmCallback = null;

function confirmAction(msg, cb) {
  closeManageData(); // Hide Manage Data first

  _confirmCallback = cb;
  document.getElementById("confirmMsg").textContent = msg;
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
    box.classList.add("border-2", "border-yellow-500");
    content.innerHTML = genZMode
      ? `
    <div class="text-center">
        <button type="button" class="help-btn absolute top-3 right-3" data-action="help" data-target="helpAttendanceModal" title="How to get attendance Excel">i</button>
        <div class="text-4xl mb-3">🚨</div>
        <p class="text-lg font-semibold text-orange-400">
            Don't blame Tracy when you're feeding it ancient data 💀
        </p>
        <p class="text-sm text-gray-500 mt-2">
            Upload the latest Excel.
            <br>
            These stats ain't it anymore.
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
    icon.className = "fas fa-sun text-yellow-500";
    localStorage.setItem("theme", "light");
  } else {
    icon.className = "fas fa-moon text-yellow-300";
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
  renderSidebarProfile();

  refreshAll(); // Refresh current page
  renderCgpaCalc(); // Recalculate CGPA card
  updateCGPAComments(); // Refresh comments
}

