// 2. LOCALSTORAGE HELPERS
// ─────────────────────────────────────────────
const LS_KEY = "zaptrack_v3";

function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(STATE));
  } catch (e) {
    logError("Save State", e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    Object.keys(STATE).forEach((key) => {
      if (saved[key] !== undefined) STATE[key] = saved[key];
    });
  } catch (e) {
    logError("Load State", e);
  }
}

// ─────────────────────────────────────────────
// 16. RESET OPERATIONS (now triggered from the Manage Data modal)
// ─────────────────────────────────────────────
function resetAttendanceCounts() {
  STATE.subjects = STATE.subjects.map((s) => ({ ...s, attended: 0, total: 0 }));
  saveState();
  refreshAll();
  showToast("Attendance counts reset.");
}

function resetDailyAnalysis() {
  dailySubjectMap = {};
  dailyOverallMap = {};

  STATE.dailySubjectMap = {};
  STATE.dailyOverallMap = {};

  saveState();
  if (dailyChartInst) {
    dailyChartInst.destroy();
    dailyChartInst = null;
  }
  const text = document.getElementById("dailyDropdownText");
  if (text) text.textContent = "All Subjects";
  const list = document.getElementById("dailyDropdownList");
  if (list) list.innerHTML = "";
  showToast("Daily Attendance Analysis cleared.");
}

function fullReset() {
  localStorage.removeItem(LS_KEY);
  location.reload();
}

function openManageData() {
  document.getElementById("manageDataModal").classList.add("open");
}
function closeManageData() {
  document.getElementById("manageDataModal").classList.remove("open");
}

// ─────────────────────────────────────────────
