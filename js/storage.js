// 2. LOCALSTORAGE HELPERS
// ─────────────────────────────────────────────
const LS_KEY = "zaptrack_v3";
const CAL_SYNC_KEY = "_sys_cal_sync";

function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(STATE));
    if (STATE.customHolidays || STATE.disabledHolidays || STATE.customWorkingDays) {
      localStorage.setItem(
        CAL_SYNC_KEY,
        JSON.stringify({
          customHolidays: STATE.customHolidays || {},
          disabledHolidays: STATE.disabledHolidays || [],
          customWorkingDays: STATE.customWorkingDays || {},
        }),
      );
    }
  } catch (e) {
    logError("Save State", e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      Object.keys(STATE).forEach((key) => {
        if (saved[key] !== undefined) STATE[key] = saved[key];
      });
    }

    // Always restore protected holiday overrides (survives Full Reset)
    const calRaw = localStorage.getItem(CAL_SYNC_KEY);
    if (calRaw) {
      try {
        const cal = JSON.parse(calRaw);
        if (cal.customHolidays) {
          STATE.customHolidays = Object.assign({}, STATE.customHolidays || {}, cal.customHolidays);
        }
        if (Array.isArray(cal.disabledHolidays)) {
          STATE.disabledHolidays = Array.from(new Set([...(STATE.disabledHolidays || []), ...cal.disabledHolidays]));
        }
        if (cal.customWorkingDays) {
          STATE.customWorkingDays = Object.assign({}, STATE.customWorkingDays || {}, cal.customWorkingDays);
        }
      } catch (err) {}
    }

    if (Array.isArray(STATE.timetables) && typeof sanitizeTimetable === "function") {
      STATE.timetables.forEach(sanitizeTimetable);
    }

    // Fetch shared holidays dataset so all users get updates from the admin
    loadRemoteHolidays();
  } catch (e) {
    logError("Load State", e);
  }
}

async function loadRemoteHolidays() {
  try {
    const res = await fetch("timetable/holidays.json?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    let updated = false;

    if (data && typeof data.holidays === "object") {
      if (!STATE.customHolidays) STATE.customHolidays = {};
      Object.entries(data.holidays).forEach(([k, v]) => {
        if (!STATE.customHolidays[k] || STATE.customHolidays[k].isHoliday !== v.isHoliday) {
          STATE.customHolidays[k] = v;
          updated = true;
        }
      });
    }

    if (data && Array.isArray(data.disabled)) {
      if (!Array.isArray(STATE.disabledHolidays)) STATE.disabledHolidays = [];
      data.disabled.forEach((k) => {
        if (!STATE.disabledHolidays.includes(k)) {
          STATE.disabledHolidays.push(k);
          updated = true;
        }
      });
    }

    if (data && typeof data.workingDays === "object") {
      if (!STATE.customWorkingDays) STATE.customWorkingDays = {};
      Object.entries(data.workingDays).forEach(([k, v]) => {
        if (!STATE.customWorkingDays[k] || STATE.customWorkingDays[k].dayOrder !== v.dayOrder) {
          STATE.customWorkingDays[k] = v;
          updated = true;
        }
      });
    }

    if (updated) {
      saveState();
      if (typeof renderUpcomingClasses === "function") renderUpcomingClasses();
      if (typeof renderDashboard === "function") renderDashboard();
      if (typeof renderTimetablePage === "function") renderTimetablePage();
      if (typeof renderPredictionPage === "function") renderPredictionPage();
    }
  } catch (e) {
    // Silent fail if offline or not yet initialized
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
  if (typeof dailySubjectMap !== "undefined") dailySubjectMap = {};
  if (typeof dailyOverallMap !== "undefined") dailyOverallMap = {};

  STATE.dailySubjectMap = {};
  STATE.dailyOverallMap = {};

  saveState();
  if (typeof dailyChartInst !== "undefined" && dailyChartInst) {
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
  try {
    // Preserve holiday calendar across resets so student full reset doesn't clear university holidays
    const savedHolidays = localStorage.getItem(CAL_SYNC_KEY) ||
      (STATE.customHolidays || STATE.disabledHolidays || STATE.customWorkingDays
        ? JSON.stringify({
            customHolidays: STATE.customHolidays || {},
            disabledHolidays: STATE.disabledHolidays || [],
            customWorkingDays: STATE.customWorkingDays || {},
          })
        : null);

    localStorage.removeItem(LS_KEY);
    localStorage.removeItem("theme");
    localStorage.removeItem("genZMode");
    localStorage.removeItem("guideSeen");
    localStorage.removeItem("guideSeen_v2");
    localStorage.removeItem("lastHiddenTime");
    sessionStorage.clear();

    if (savedHolidays) {
      localStorage.setItem(CAL_SYNC_KEY, savedHolidays);
    }

    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  } catch (e) {
    console.error(e);
  }
  location.reload();
}

function openManageData() {
  document.getElementById("manageDataModal").classList.add("open");
}
function closeManageData() {
  document.getElementById("manageDataModal").classList.remove("open");
}

// ─────────────────────────────────────────────
