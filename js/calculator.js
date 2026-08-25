// 11. SUBJECT-LINKED MANUAL CALCULATOR (Attendance page)
// ─────────────────────────────────────────────
let calcState = { attended: 0, total: 0, min_attended: 0, min_total: 0 };
let calcChartInst = null;

function populateCalcSubjects() {
  const menu = document.getElementById("calcSubjectMenu");
  const text = document.getElementById("calcSubjectText");

  if (!menu || !text) return;

  menu.innerHTML = "";

  const placeholder = document.createElement("div");
  placeholder.className = "dropdown-item";
  placeholder.textContent = "Select Subject";

  placeholder.onclick = () => {
    text.textContent = "Select Subject";
    text.dataset.value = "";
    closeDropdown("calcSubjectDropdown");
    resetCalc();
  };

  menu.appendChild(placeholder);

  STATE.subjects.forEach((s, i) => {
    const item = document.createElement("div");
    item.className = "dropdown-item whitespace-pre-line";

    item.textContent = s.name.replace(/\s*\([^)]+\)\s*$/, "");

    item.onclick = () => {
      text.textContent = s.name.replace(/\s*\([^)]+\)\s*$/, "");
      text.dataset.value = i;

      closeDropdown("calcSubjectDropdown");

      calcState = {
        attended: (s.attended || 0) + (s.dutyLeave || 0),
        total: s.total || 0,
        min_attended: (s.attended || 0) + (s.dutyLeave || 0),
        min_total: s.total || 0,
      };

      renderCalc();
    };

    menu.appendChild(item);
  });
}

function updateSubjectCalc() {
  calcState.total =
    parseInt(document.getElementById("calcTotalInput").value, 10) || 0;
  calcState.attended =
    parseInt(document.getElementById("calcAttendedInput").value, 10) || 0;
  renderCalc();
}

function changeFutureTotal(delta) {
  let total = calcState.total + delta;

  // Rule: Total Classes must never go below the subject’s original saved total.
  total = Math.max(calcState.min_total, total);

  // Rule: Attended Classes must never exceed Total Classes.
  total = Math.max(total, calcState.attended);

  calcState.total = total;
  renderCalc();
}

function changeFutureAttend(delta) {
  let attended = calcState.attended + delta;
  let total = calcState.total + delta;

  // Rule: Attended Classes must never exceed Total Classes is implicitly handled
  // by increasing both by delta.
  // However, we must not go below minimum values.

  if (delta < 0) {
    if (attended < calcState.min_attended || total < calcState.min_total) {
      attended = Math.max(calcState.min_attended, attended);
      total = Math.max(calcState.min_total, total);
    }
  }

  calcState.attended = attended;
  calcState.total = total;

  renderCalc();
}

function renderCalc() {
  const a = calcState.attended,
    t = calcState.total;
  document.getElementById("calcTotalInput").value = t;
  document.getElementById("calcAttendedInput").value = a;

  if (!t) {
    document.getElementById("calcPercent").textContent = "--%";
    document.getElementById("calcStatus").textContent = "Select Subject";
    const needEl = document.getElementById("calcNeed");
    const bunkEl = document.getElementById("calcBunk");

    if (needEl) needEl.textContent = "--";
    if (bunkEl) bunkEl.textContent = "--";
    renderCalcChart(0, 0);
    return;
  }

  const pct = (a / t) * 100;
  const pctEl = document.getElementById("calcPercent");
  pctEl.textContent = pct.toFixed(1) + "%";

  const calcStatus = document.getElementById("calcStatus");

  if (pct >= STATE.target) {
    pctEl.className = "text-3xl md:text-5xl font-bold text-green-400";
    if (calcStatus) calcStatus.textContent = getStatusText("safe");
  } else if (pct >= STATE.target - 10) {
    pctEl.className = "text-3xl md:text-5xl font-bold text-yellow-400";
    if (calcStatus) calcStatus.textContent = getStatusText("warning");
  } else {
    pctEl.className = "text-3xl md:text-5xl font-bold text-red-400";
    if (calcStatus) calcStatus.textContent = getStatusText("risk");
  }

  const { need, bunk } = calcNeedAndBunk(
    { attended: a, total: t },
    STATE.target,
  );

  const calcNeedEl = document.getElementById("calcNeed");
  const calcBunkEl = document.getElementById("calcBunk");

  if (calcNeedEl) calcNeedEl.textContent = need > 0 ? need : "0";

  if (calcBunkEl) calcBunkEl.textContent = bunk > 0 ? bunk : "0";
  renderCalcChart(a, t);
}

function renderCalcChart(a, t) {
  const ctx = document.getElementById("calcChart");
  if (!ctx) return;
  if (calcChartInst) {
    calcChartInst.destroy();
    calcChartInst = null;
  }

  const absent = Math.max(0, t - a);

  const { need, bunk } = calcNeedAndBunk(
    { attended: a, total: t },
    STATE.target,
  );

  if (a === 0 && bunk === 0 && need === 0 && absent === 0) return;

  calcChartInst = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Attended", "Safe Bunks", "Needed", "Absent"],
      datasets: [
        {
          data: [a, bunk, need, absent],
          backgroundColor: ["#22c55e", "#f59e0b", "#3b82f6", "#64748b"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      cutout: 0,
      plugins: {
        legend: { display: false },
      },
    },
  });
}

function resetCalc() {
  calcState = { attended: 0, total: 0, min_attended: 0, min_total: 0 };

  const text = document.getElementById("calcSubjectText");
  if (text) {
    text.textContent = "Select Subject";
    text.dataset.value = "";
  }

  renderCalc();
}

// ─────────────────────────────────────────────
// 12. STANDALONE QUICK CALCULATOR (new — not linked to any subject)
// ─────────────────────────────────────────────
let quickCalcTarget = 75;
let qcChartInst = null;

function setQuickCalcTarget(t) {
  quickCalcTarget = t;
  STATE.quickCalcTarget = t;
  saveState();
  document
    .querySelectorAll(".quick-target-btn")
    .forEach((b) => b.classList.toggle("active", Number(b.dataset.t) === t));
  renderQuickCalc();
}

function renderQuickCalc() {
  const totalEl = document.getElementById("qcTotal");
  const attEl = document.getElementById("qcAttended");
  if (!totalEl || !attEl) return;

  const total = parseInt(totalEl.value, 10) || 0;
  let attended = parseInt(attEl.value, 10) || 0;
  if (attended > total) {
    attended = total;
    attEl.value = total;
  }

  const pctEl = document.getElementById("qcPercent");
  const statusEl = document.getElementById("qcStatus");

  if (!total) {
    pctEl.textContent = "--%";
    pctEl.className = "text-3xl font-bold";
    statusEl.textContent = "Enter values";
    document.getElementById("qcNeed").textContent = "--";
    document.getElementById("qcBunk").textContent = "--";
    renderQcChart(0, 0);
    return;
  }

  const pct = (attended / total) * 100;
  pctEl.textContent = pct.toFixed(1) + "%";

  if (pct >= quickCalcTarget) {
    pctEl.className = "text-3xl font-bold text-green-400";
    statusEl.textContent = getStatusText("safe");
  } else if (pct >= quickCalcTarget - 10) {
    pctEl.className = "text-3xl font-bold text-yellow-400";
    statusEl.textContent = getStatusText("warning");
  } else {
    pctEl.className = "text-3xl font-bold text-red-400";
    statusEl.textContent = getStatusText("risk");
  }

  const { need, bunk } = calcNeedAndBunk({ attended, total }, quickCalcTarget);
  document.getElementById("qcNeed").textContent =
    need > 0 ? need : "0";
  document.getElementById("qcBunk").textContent =
    bunk > 0 ? bunk : "0";

  renderQcChart(attended, total);
}

function renderQcChart(a, t) {
  const ctx = document.getElementById("qcChart");
  if (!ctx) return;
  if (qcChartInst) {
    qcChartInst.destroy();
    qcChartInst = null;
  }

  const absent = Math.max(0, t - a);

  const { need, bunk } = calcNeedAndBunk(
    { attended: a, total: t },
    quickCalcTarget,
  );

  if (a === 0 && bunk === 0 && need === 0 && absent === 0) return;

  qcChartInst = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Attended", "Safe Bunks", "Needed", "Absent"],
      datasets: [
        {
          data: [a, bunk, need, absent],
          backgroundColor: ["#22c55e", "#f59e0b", "#3b82f6", "#64748b"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: 0,
      plugins: {
        legend: {
          display: false,
        },
      },
    },
  });
  const colors = qcChartInst.data.datasets[0].backgroundColor;

  [
    ["attendedLegend", colors[0]],
    ["bunkLegend", colors[1]],
    ["needLegend", colors[2]],
    ["absentLegend", colors[3]],
  ].forEach(([id, color]) => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = `<span class="legend-dot" style="background:${color}"></span>`;
    }
  });
}

function resetQuickCalc() {
  document.getElementById("qcTotal").value = "";
  document.getElementById("qcAttended").value = "";
  renderQuickCalc();
}

// ─────────────────────────────────────────────
// 24. CGPA CALCULATOR
// ─────────────────────────────────────────────
let cgpaChart = null;

function renderCgpaCalc() {
  const curEl = document.getElementById("cgpaCurrent");
  const tgtEl = document.getElementById("cgpaTarget");
  const semEl = document.getElementById("semCompleted");
  const card = document.getElementById("neededCgpaCard");
  if (!curEl || !tgtEl || !semEl || !card) return;

  let current = parseFloat(curEl.value);
  let target = parseFloat(tgtEl.value);
  let sem = parseInt(semEl.value, 10);

  card.classList.remove("status-card-green", "status-card-yellow", "status-card-red");

  if (current > 10) { current = 10; curEl.value = 10; }
  if (target > 10) { target = 10; tgtEl.value = 10; }
  if (sem > 7) { sem = 7; semEl.value = 7; }
  if (current < 0) { current = 0; curEl.value = 0; }
  if (target < 0) { target = 0; tgtEl.value = 0; }

  const deltaEl = document.getElementById("cgpaDelta");
  const statusEl = document.getElementById("cgpaStatus");

  if (isNaN(current) || isNaN(target) || isNaN(sem)) {
    deltaEl.textContent = "--";
    if (statusEl) statusEl.textContent = "Enter values to calculate";
    card.classList.add("bg-white/[0.02]");
    return;
  }
  card.classList.remove("bg-white/[0.02]");

  const totalSem = 8;
  const completedSem = Math.min(totalSem - 1, Math.max(1, sem));
  const remainingSem = 8 - completedSem;
  const requiredAvg = (target * 8 - current * completedSem) / remainingSem;

  if (requiredAvg <= 10) {
    deltaEl.textContent = requiredAvg.toFixed(2);
    statusEl.textContent = "";

    if (requiredAvg <= 7.5) {
      card.classList.add("cgpa-green");
    } else if (requiredAvg <= 8.5) {
      card.classList.add("cgpa-yellow");
    } else {
      card.classList.add("cgpa-red");
    }
  } else {
    deltaEl.textContent = genZMode ? "It's Over 💀" : "Not Achievable";
    statusEl.textContent = "Beyond 10.0 SGPA";
    card.classList.add("cgpa-red");
  }
}

function resetCgpaCalc() {
  const cur = document.getElementById("cgpaCurrent");
  const tgt = document.getElementById("cgpaTarget");
  const sem = document.getElementById("semCompleted");
  if (cur) cur.value = "";
  if (tgt) tgt.value = "";
  if (sem) sem.value = "";
  renderCgpaCalc();
}

// ─────────────────────────────────────────────
