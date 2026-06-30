/**
 * ZapTrack – main.js
 * ─────────────────────────────────────────────────────────
 * REVISION 2 — applies these corrections:
 *  1. Prediction engine redesigned from scratch (see PREDICTION ENGINE section
 *     for the exact logic and why it's correct).
 *  2. New standalone "Quick Calculator" page — pure freeform numbers,
 *     not linked to any saved subject.
 *  3. Timetable is now upload-only + select-only. No in-app cell editing,
 *     no drag/drop, no holiday-click toggles. You prepare the Excel exactly
 *     how you want it (including holidays as plain text in a cell) and the
 *     app just reads it.
 *  4. Settings page removed. Profile info still shows in the sidebar
 *     (auto-filled from your imported Excel). Reset controls moved into a
 *     small "Manage Data" modal on the Dashboard.
 *  5. Daily Analytics now supports Overall / All-Subjects / Single-Subject
 *     views. Subject-wise mapping needs a selected timetable (to know which
 *     subject occupied which hour on which weekday).
 * ─────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────
// 1. STATE
// ─────────────────────────────────────────────
const STATE = {
  subjects: [], // [{ id, name, attended, total }]
  profile: {}, // { name, dept, roll, batch, term, reg }
  timetables: [], // [{ id, label, rows: [{day, hours:[]}] }]
  week1TimetableId: null,
  week2TimetableId: null,
  target: 75, // global target — dashboard / attendance coloring
  quickCalcTarget: 75, // standalone calculator target toggle
  currentPage: "dashboard",
  weekOverrides: {
    week1: {
      saturday: [],
      sunday: [],
      suspendedDays: [],
      suspendedSubjects: {},
    },

    week2: {
      saturday: [],
      sunday: [],
      suspendedDays: [],
      suspendedSubjects: {},
    },
  },
};

const DAY_ORDER = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const TIMETABLE_FILES = [
  "4CSD01.xlsx",
  "2CSD01.xlsx",
  "4CSD02.xlsx",
  "2CSD02.xlsx",
  "4CSD03.xlsx",
  "2CSD03.xlsx",
];

// ─────────────────────────────────────────────
// 2. LOCALSTORAGE HELPERS
// ─────────────────────────────────────────────
const LS_KEY = "zaptrack_v3";

function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(STATE));
  } catch (e) {
    console.error("saveState error:", e);
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
    console.error("loadState error:", e);
  }
}

// ─────────────────────────────────────────────
// 3. NAVIGATION
// ─────────────────────────────────────────────
function navigateTo(page) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-link")
    .forEach((l) => l.classList.remove("active"));
  document
    .querySelectorAll(".mobile-nav-item")
    .forEach((l) => l.classList.remove("active"));

  const pageEl = document.getElementById("page-" + page);
  if (pageEl) pageEl.classList.add("active");

  const navItem = document.querySelector('.nav-link[data-page="' + page + '"]');
  if (navItem) navItem.classList.add("active");
  const mobileItem = document.querySelector(
    '.mobile-nav-item[data-page="' + page + '"]',
  );
  if (mobileItem) mobileItem.classList.add("active");

  STATE.currentPage = page;
  saveState();
  closeSidebar();

  if (page === "dashboard") renderDashboard();
  if (page === "attendance") renderAttendancePage();
  if (page === "timetable") renderTimetablePage();
  if (page === "prediction") renderPredictionPage();
  if (page === "calculator") {
    populateCalcSubjects();
    renderQuickCalc();
    renderCgpaCalc();
  }
  if (page === "analytics") renderAnalyticsPage();
  if (["about", "terms", "privacy", "disclaimer", "contact"].includes(page)) {
    closeSidebar();
  }
}

function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("mobileOverlay").classList.add("open");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("mobileOverlay").classList.remove("open");
}

// ─────────────────────────────────────────────
// 4. SUBJECTS CRUD
// ─────────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function openSubjectModal() {
  document.getElementById("newSubjectName").value = "";
  document.getElementById("newSubjectAttended").value = "";
  document.getElementById("newSubjectTotal").value = "";
  document.getElementById("subjectModal").classList.add("open");
}
function closeSubjectModal() {
  document.getElementById("subjectModal").classList.remove("open");
}

function saveNewSubject() {
  const name = document.getElementById("newSubjectName").value.trim();
  const attended =
    parseInt(document.getElementById("newSubjectAttended").value, 10) || 0;
  const total =
    parseInt(document.getElementById("newSubjectTotal").value, 10) || 0;

  if (!name) {
    showToast("Subject name is required.");
    return;
  }
  if (total < 0 || attended < 0) {
    showToast("Values cannot be negative.");
    return;
  }
  if (attended > total) {
    showToast("Attended cannot exceed total.");
    return;
  }

  const isDuplicate = STATE.subjects.some(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  );
  if (isDuplicate) {
    showToast("Subject already exists.");
    return;
  }

  STATE.subjects.push({ id: genId(), name, attended, total });
  saveState();
  closeSubjectModal();
  refreshAll();
  showToast("Subject added ✓");
}

function openEditSubjectModal(id) {
  const s = STATE.subjects.find((x) => x.id === id);
  if (!s) return;
  document.getElementById("editSubjectIndex").value = id;
  document.getElementById("editSubjectName").value = s.name;
  document.getElementById("editSubjectAttended").value = s.attended;
  document.getElementById("editSubjectTotal").value = s.total;
  document.getElementById("editSubjectModal").classList.add("open");
}
function closeEditSubjectModal() {
  document.getElementById("editSubjectModal").classList.remove("open");
}

function saveEditedSubject() {
  const id = document.getElementById("editSubjectIndex").value;
  const name = document.getElementById("editSubjectName").value.trim();
  const attended =
    parseInt(document.getElementById("editSubjectAttended").value, 10) || 0;
  const total =
    parseInt(document.getElementById("editSubjectTotal").value, 10) || 0;

  if (!name) {
    showToast("Subject name is required.");
    return;
  }
  if (attended < 0 || total < 0) {
    showToast("Values cannot be negative.");
    return;
  }
  if (attended > total) {
    showToast("Attended cannot exceed total.");
    return;
  }

  const dup = STATE.subjects.find(
    (s) => s.id !== id && s.name.toLowerCase() === name.toLowerCase(),
  );
  if (dup) {
    showToast("Another subject with this name exists.");
    return;
  }

  const idx = STATE.subjects.findIndex((s) => s.id === id);
  if (idx === -1) return;
  STATE.subjects[idx] = { ...STATE.subjects[idx], name, attended, total };
  saveState();
  closeEditSubjectModal();
  refreshAll();
  showToast("Subject updated ✓");
}

function deleteSubject(id) {
  confirmAction("Delete this subject and all its data?", () => {
    STATE.subjects = STATE.subjects.filter((s) => s.id !== id);
    saveState();
    refreshAll();
    showToast("Subject deleted");
  });
}

function markAttendance(id, type) {
  const s = STATE.subjects.find((x) => x.id === id);
  if (!s) return;
  if (type === "present") {
    s.total++;
    s.attended++;
  }
  if (type === "absent") {
    s.total++;
  }
  saveState();
  refreshAll();
}

// ─────────────────────────────────────────────
// 5. EXCEL IMPORT — ATTENDANCE REPORT
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const mainInput = document.getElementById("mainFileInput");
  const uploadZone = document.getElementById("uploadZone");

  if (mainInput) {
    mainInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      parseAttendanceExcel(file);
      mainInput.value = "";
    });
  }
  if (uploadZone) {
    uploadZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadZone.classList.add("drag-over");
    });
    uploadZone.addEventListener("dragleave", () =>
      uploadZone.classList.remove("drag-over"),
    );
    uploadZone.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadZone.classList.remove("drag-over");
      const file = e.dataTransfer.files[0];
      if (file) parseAttendanceExcel(file);
    });
  }

  const ttFileInput = document.getElementById("ttFileInput");
  if (ttFileInput) {
    ttFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      ttFileChosen = file || null;
      document.getElementById("ttFileChosenLabel").textContent = file
        ? file.name
        : "Choose Excel File";
    });
  }

  const dailyInput = document.getElementById("dailyFileInput");
  if (dailyInput) {
    dailyInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      document.getElementById("dailyFileChosenLabel").textContent = file.name;
      parseDailyExcel(file);
      dailyInput.value = "";
    });
  }

  // Init
  loadState();
  setDateDisplay();
  renderSidebarProfile();
  updateTargetUI();
  navigateTo(STATE.currentPage || "dashboard");
  loadBuiltInTimetables();
  initAdsSystem();
  initSiteConfig();
});

function parseAttendanceExcel(file) {
  const reader = new FileReader();
  reader.onload = (evt) => {
    const data = new Uint8Array(evt.target.result);
    const wb = XLSX.read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Extract profile
    const profile = {};
    raw.forEach((row) => {
      row.forEach((cell) => {
        const text = String(cell || "");
        if (text.includes("Student Name"))
          profile.name = text.split(":")[1]?.trim();
        if (text.includes("Roll No")) profile.roll = text.split(":")[1]?.trim();
        if (text.includes("Registration"))
          profile.reg = text.split(":")[1]?.trim();
        if (text.includes("Batch")) profile.batch = text.split(":")[1]?.trim();
        if (text.includes("Department"))
          profile.dept = text.split(":")[1]?.trim();
        if (text.includes("Term")) profile.term = text.split(":")[1]?.trim();
      });
    });
    if (Object.keys(profile).length) STATE.profile = profile;

    // Extract subjects
    const json = XLSX.utils.sheet_to_json(sheet);
    const subjects = [];

    json.forEach((row) => {
      const nameRaw = row["__EMPTY"];
      if (!nameRaw || nameRaw === "Course Name" || nameRaw === "Total") return;

      const total = Number(row["__EMPTY_1"]) || 0;
      const attended = Number(row["__EMPTY_2"]) || 0;
      const dutyLeave = Number(row["__EMPTY_3"]) || 0;
      if (total === 0) return;

      const existing = STATE.subjects.find(
        (s) => s.name.toLowerCase() === nameRaw.toLowerCase(),
      );
      subjects.push({
        id: existing?.id || genId(),
        name: nameRaw,
        attended,
        dutyLeave,
        total,
      });
    });

    if (!subjects.length) {
      showToast("No subjects found in file.");
      return;
    }
    console.table(subjects);
    STATE.subjects = subjects;
    saveState();

    const fnEl = document.getElementById("importedFileName");
    if (fnEl) {
      fnEl.textContent = "✓ " + file.name;
      fnEl.classList.remove("hidden");
    }

    renderSidebarProfile();
    refreshAll();
    showToast("Imported " + subjects.length + " subjects ✓");
  };
  reader.readAsArrayBuffer(file);
}

let ttFileChosen = null;
let previewWeekNum = 1;
let dailyOverallMap = {};

function buildTimetableRows(jsonData) {
  const rows = [];
  jsonData.forEach((row) => {
    const values = Object.values(row);
    const dayRaw = String(values[0] || "").trim();
    if (!dayRaw) return;
    const hours = values.slice(1).map((v) => String(v || "").trim());
    rows.push({ day: dayRaw, hours });
  });
  return rows;
}

async function loadTimetablesFromFolder(isManualRefresh) {
  try {
    const dirRes = await fetch("timetable/", { cache: "no-store" });
    if (!dirRes.ok)
      throw new Error("Cannot list timetable/ folder (" + dirRes.status + ")");
    const html = await dirRes.text();

    // Parse the server's auto-generated directory listing for .xlsx/.xls links.
    const doc = new DOMParser().parseFromString(html, "text/html");
    const anchors = Array.from(doc.querySelectorAll("a"));
    const fileNames = [
      ...new Set(
        anchors
          .map((a) => a.getAttribute("href") || "")
          .map((href) =>
            decodeURIComponent(href.split("/").filter(Boolean).pop() || ""),
          )
          .filter((name) => /\.(xlsx|xls)$/i.test(name)),
      ),
    ];

    if (!fileNames.length) {
      if (statusEl)
        statusEl.textContent =
          "No .xlsx files found in the timetable/ folder yet.";
      // Still drop any stale folder-sourced entries.
      STATE.timetables = STATE.timetables.filter((t) => t.source !== "folder");
      saveState();
      renderTimetablePage();
      return;
    }

    let loaded = 0,
      failed = 0;
    for (const fileName of fileNames) {
      const label = fileName.replace(/\.(xlsx|xls)$/i, "");
      try {
        const fileRes = await fetch("timetable/" + fileName, {
          cache: "no-store",
        });
        if (!fileRes.ok) {
          failed++;
          continue;
        }
        const buf = await fileRes.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        const rows = buildTimetableRows(json);
        if (!rows.length) {
          failed++;
          continue;
        }

        // Upsert: update if a folder-sourced entry with this label already exists, else insert.
        const existingIdx = STATE.timetables.findIndex(
          (t) => t.source === "folder" && t.label === label,
        );
        const record = {
          id: existingIdx >= 0 ? STATE.timetables[existingIdx].id : genId(),
          label,
          rows,
          source: "folder",
        };
        if (existingIdx >= 0) STATE.timetables[existingIdx] = record;
        else STATE.timetables.push(record);
        loaded++;
      } catch (e) {
        console.error("Failed to load timetable file", fileName, e);
        failed++;
      }
    }

    // Drop folder-sourced entries whose file is no longer present in the folder.
    STATE.timetables = STATE.timetables.filter(
      (t) =>
        t.source !== "folder" ||
        fileNames.some((f) => f.replace(/\.(xlsx|xls)$/i, "") === t.label),
    );

    saveState();
    renderTimetablePage();

    if (statusEl) {
      statusEl.textContent = failed
        ? `Found ${loaded + failed} file(s), loaded ${loaded}, ${failed} failed to parse.`
        : `Found ${loaded} file(s) in timetable/ ✓ — auto-loaded, nothing to configure.`;
    }
    if (isManualRefresh) showToast("Folder refreshed ✓");
  } catch (e) {
    console.warn("Could not list timetable/ folder.", e);
    if (statusEl) {
      statusEl.textContent =
        "Could not list the timetable/ folder. Either the app was opened directly as a file (use a local server instead — see README in that folder) or your server has directory listing turned off.";
    }
    if (isManualRefresh)
      showToast(
        "Could not read the timetable/ folder — see Timetable page for details.",
      );
  }
}

async function loadBuiltInTimetables() {
  STATE.timetables = STATE.timetables.filter((t) => t.source !== "builtin");

  for (const fileName of TIMETABLE_FILES) {
    try {
      const response = await fetch(`timetable/${fileName}`);

      if (!response.ok) continue;

      const buffer = await response.arrayBuffer();

      const wb = XLSX.read(buffer, {
        type: "array",
      });

      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      const rows = buildTimetableRows(json);

      STATE.timetables.push({
        id: fileName,
        label: fileName.replace(".xlsx", ""),
        rows,
        source: "builtin",
      });
    } catch (err) {
      console.error(fileName, err);
    }
  }

  saveState();
  renderTimetablePage();
}

function uploadTimetableFile() {
  const label = document.getElementById("ttLabelInput").value.trim();
  if (!label) {
    showToast("Give this timetable a label.");
    return;
  }
  if (!ttFileChosen) {
    showToast("Choose an Excel file.");
    return;
  }

  const dup = STATE.timetables.some(
    (t) => t.label.toLowerCase() === label.toLowerCase(),
  );
  if (dup) {
    showToast("A timetable with this label already exists.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (evt) => {
    const data = new Uint8Array(evt.target.result);
    const wb = XLSX.read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);
    const rows = buildTimetableRows(json);

    if (!rows.length) {
      showToast("No timetable rows found in file.");
      return;
    }

    STATE.timetables.push({ id: genId(), label, rows, source: "manual" });
    saveState();

    document.getElementById("ttLabelInput").value = "";
    ttFileChosen = null;
    document.getElementById("ttFileChosenLabel").textContent =
      "Choose Excel File";
    document.getElementById("ttFileInput").value = "";

    renderTimetablePage();
    showToast('Timetable "' + label + '" uploaded ✓');
  };
  reader.readAsArrayBuffer(ttFileChosen);
}

function deleteTimetable(id) {
  confirmAction("Delete this timetable?", () => {
    STATE.timetables = STATE.timetables.filter((t) => t.id !== id);
    if (STATE.week1TimetableId === id) STATE.week1TimetableId = null;
    if (STATE.week2TimetableId === id) STATE.week2TimetableId = null;
    saveState();
    renderTimetablePage();
    renderPredictionPage();
    showToast("Timetable deleted");
  });
}

function getTimetableById(id) {
  return STATE.timetables.find((t) => t.id === id);
}

function getWeekOverride(week) {
  return week === 1 ? STATE.weekOverrides.week1 : STATE.weekOverrides.week2;
}

function getCurrentDayIndex() {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

function isPastDay(day) {
  return weekdayOrderIndex(day) < getCurrentDayIndex();
}

function setActiveTimetable(id) {
  STATE.week1TimetableId = id || null;
  STATE.week2TimetableId = id || null;

  saveState();
  renderPredictionPage();
}

function setWeekTimetable(weekNum, id) {
  if (weekNum === 1) STATE.week1TimetableId = id || null;
  else STATE.week2TimetableId = id || null;
  saveState();
  renderPredictionPage();
}

function previewWeek(w) {
  previewWeekNum = w;
  document
    .querySelectorAll(".preview-tab")
    .forEach((b) => b.classList.toggle("active", Number(b.dataset.w) === w));
  renderTimetablePreview();
}

function renderTimetablePage() {
  renderTimetableList();
  renderTimetableSelects();
  renderTimetablePreview();
}

function filterTimetables(query) {
  const sel = document.getElementById("activeTimetableSelect");
  if (!sel) return;

  const q = query.toLowerCase().trim();

  sel.innerHTML =
    '<option value="">Select Class</option>' +
    STATE.timetables
      .filter((t) => t.label.toLowerCase().includes(q))
      .map(
        (t) => `
          <option value="${t.id}"
            ${t.id === STATE.week1TimetableId ? "selected" : ""}>
            ${t.label}
          </option>
        `,
      )
      .join("");
}

function renderTimetableList() {
  const el = document.getElementById("ttList");
  
  if (!el) return;
  if (!STATE.timetables.length) {
    el.innerHTML = '<p class="text-xs text-gray-500">None loaded yet.</p>';
    return;
  }
  el.innerHTML = STATE.timetables
    .map(
      (t) => `
    <div class="flex items-center justify-between py-2 border-b border-white/5">
      <div>
        <p class="text-sm font-medium">${t.label} <span class="text-xs font-normal ${t.source === "folder" ? "text-indigo-400" : "text-gray-500"}">(${t.source === "folder" ? "folder" : "uploaded"})</span></p>
        <p class="text-xs text-gray-500">${t.rows.length} day rows</p>
      </div>
      <button class="btn-danger text-xs" style="padding:4px 8px" onclick="deleteTimetable('${t.id}')"><i class="fas fa-trash"></i></button>
    </div>
  `,
    )
    .join("");
}

function renderInlineAds() {
  const el = document.getElementById("inlineAdsContainer");
  if (!el || !adsList.length) return;

  el.innerHTML = adsList
    .map(
      (ad) => `
      <div class="card overflow-hidden">
        <a href="${ad.linkUrl}"
           target="_blank"
           onclick="trackAdClick('${ad.title}')">
          <img src="${ad.image}" alt="${ad.title}" style="width:100%">
        </a>
      </div>
    `
    )
    .join("");
}

function renderTimetableSelects() {
  filterTimetables("");
}

function renderTimetablePreview() {
  const el = document.getElementById("ttPreviewGrid");
  if (!el) return;
  const id = STATE.week1TimetableId;
  const tt = getTimetableById(id);

  if (!tt) {
    el.innerHTML =
      '<p class="text-center text-gray-500 text-sm py-8">Select a timetable to preview.</p>';
    return;
  }
  

  const maxHours = Math.max(...tt.rows.map((r) => r.hours.length));
  let html = '<table class="tt-table w-full"><thead><tr><th>Day</th>';
  for (let h = 1; h <= maxHours; h++) html += `<th>Hour ${h}</th>`;
  html += "</tr></thead><tbody>";

  tt.rows.forEach((row) => {
    html +=
      '<tr class="tt-row"><td class="font-medium text-gray-300">' +
      row.day +
      "</td>";
    for (let h = 0; h < maxHours; h++) {
      const v = row.hours[h] || "";
      const isHoliday = v.toLowerCase().includes("holiday");
      html += `<td class="${isHoliday ? "opacity-40 line-through" : ""}">${v}</td>`;
    }
    html += "</tr>";
  });
  html += "</tbody></table>";
  el.innerHTML = html;
}

function renderInlineAdSlider() {
  const el = document.getElementById("inlineAdsSlides");
  if (!el || !adsList.length) return;

  const ad = adsList[adsCurrentSlide];
  new Image().src =
    "https://script.google.com/macros/s/AKfycbw5uW_Mtc2s3Uz9ZBRgyKKdo71jxSMgwluny58TKUNudKCOc8pBV9Cf3MOPXEkCG8D2/exec?action=view&title=" +
    encodeURIComponent(ad.title);

  el.innerHTML = `
    <a href="${ad.linkUrl}" target="_blank"
       onclick="trackAdClick('${ad.title}')">
      <img src="${ad.image}" style="width:100%">
    </a>
  `;
}
// ─────────────────────────────────────────────
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

function getTodayOrderIdx() {
  const d = new Date().getDay(); // 0 Sun .. 6 Sat
  return d === 0 ? 7 : d;
}

function countSubjectInRows(rows, subjectName, minOrderIdx, overrides) {
  const clean = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const SUBJECT_ALIASES = {
    eda: "exploratorydataanalysis",
    dbms: "databasemanagementsystems",
    sfds: "statisticalfoundationsfordatascience",
    apt: "aptitudetraining",
    ai: "analysisofalgorithms",
  };

  const sKey = clean(subjectName);
  let count = 0;

  rows.forEach((row) => {
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

      let tKey = clean(text);

      if (SUBJECT_ALIASES[tKey]) {
        tKey = SUBJECT_ALIASES[tKey];
      }

      const blocked = suspended.some(
        (subj) => clean(subj) === clean(subjectName),
      );

      if (blocked) return;

      if (sKey.includes(tKey) || tKey.includes(sKey)) {
        count++;
      }
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

function renderPredictionPage() {
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

  const todayIdx = getTodayOrderIdx();

  tbody.innerHTML = STATE.subjects
    .map((s) => {
      let extra;
      if (weekNum === 1) {
        extra = w1
          ? countSubjectInRows(
              w1.rows,
              s.name,
              todayIdx,
              STATE.weekOverrides.week1,
            )
          : 0;
      } else {
        const week1Remainder = w1
          ? countSubjectInRows(w1.rows, s.name, todayIdx, STATE.weekOverrides.week1)
          : 0;
       const week2Full = w2
         ? countSubjectInRows(
             w2.rows,
             s.name,
             undefined,
             STATE.weekOverrides.week2,
           )
         : 0;
        extra = week1Remainder + week2Full;
      }

      const newA = s.attended + extra;
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

      return `<tr class="border-b border-white/5">
      <td class="py-2 pr-2 max-w-[100px] truncate" title="${s.name}">${getShortSubjectName(s.name)}</td>
      <td class="py-2 text-indigo-400">+${extra}</td>
      <td class="py-2">${newA}</td>
      <td class="py-2">${newT}</td>
      <td class="py-2 font-semibold ${cls}">${pct.toFixed(1)}%</td>
      <td class="py-2 text-xs ${bunk > 0 ? "text-green-400" : "text-gray-500"}">${bunk > 0 ? bunk + " safe" : need > 0 ? "+" + need + " req" : "0"}</td>
    </tr>`;
    })
    .join("");
}

function renderPredCards() {
  const el = document.getElementById("predCards");
  if (!el) return;

  const week = document.getElementById("predCardsWeekSelect")?.value || "1";

  const w1 = getTimetableById(STATE.week1TimetableId);
  const w2 = getTimetableById(STATE.week2TimetableId);
  const todayIdx = getTodayOrderIdx();

  if (!STATE.subjects.length) {
    el.innerHTML =
      '<p class="text-gray-500 text-sm col-span-full">No subjects loaded.</p>';
    return;
  }

  el.innerHTML = [...STATE.subjects]
    .sort((a, b) => {
      const aPct = a.total ? (a.attended / a.total) * 100 : 0;
      const bPct = b.total ? (b.attended / b.total) * 100 : 0;
      return aPct - bPct; // ascending
    })
    .map((s) => {
      let extra = 0;

      if (week === "1") {
        extra = w1
          ? countSubjectInRows(
              w1.rows,
              s.name,
              todayIdx,
              STATE.weekOverrides.week1,
            )
          : 0;
      } else {
        const week1Remainder = w1
          ? countSubjectInRows(
              w1.rows,
              s.name,
              todayIdx,
              STATE.weekOverrides.week1,
            )
          : 0;

        const week2Full = w2
          ? countSubjectInRows(
              w2.rows,
              s.name,
              undefined,
              STATE.weekOverrides.week2,
            )
          : 0;

        extra = week1Remainder + week2Full;
      }

      const futureAttended = s.attended + extra;
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

      return `
      <div class="sub-card">
        <p class="text-xs font-medium truncate text-gray-300 mb-1">
          ${s.name}
        </p>

        <p class="text-xl font-bold ${cls} mb-1">
          ${pct.toFixed(1)}%
        </p>

        <p class="text-xs text-gray-500">
          ${futureAttended}/${futureTotal}
        </p>

        <p class="text-xs text-indigo-400 mt-1">
          +${extra} classes
        </p>

        <p class="text-xs mt-2 ${
          need > 0 ? "text-yellow-400" : "text-green-400"
        }">
        ${need > 0 ? `+${need} needed for ${STATE.target}%` : `${bunk} safe bunks`}
        </p>
      </div>
    `;
    })
    .join("");
}

// ─────────────────────────────────────────────
// 8. SHARED ATTENDANCE-MATH HELPERS
// ─────────────────────────────────────────────
function calcStats(subjects) {
  const totalAttended = subjects.reduce(
    (a, s) => a + (s.attended || 0) + (s.dutyLeave || 0),
    0,
  );
  const totalClasses = subjects.reduce((a, s) => a + (s.total || 0), 0);
  const overall = totalClasses === 0 ? 0 : (totalAttended / totalClasses) * 100;
  return { totalAttended, totalClasses, overall };
}

function pctClass(p) {
  if (p >= STATE.target) return "pct-safe";
  if (p >= STATE.target - 10) return "pct-warn";
  return "pct-danger";
}

function calcNeedAndBunk(s, target) {
  const a = s.attended || 0;
  const total = s.total || 0;

  if (!total) return { need: 0, bunk: 0 };

  const t = target / 100;

  let need = 0;

  if (a / total < t) {
    need = Math.ceil((t * total - a) / (1 - t));
  }

  let bunk = 0;

  if (a / total >= t) {
    bunk = Math.floor((a - t * total) / t);
  }

  return {
    need: Math.max(0, need),
    bunk: Math.max(0, bunk),
  };
}

// ─────────────────────────────────────────────
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
    statusEl.textContent = ok ? "Safe ✓" : "At Risk";
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

  listEl.innerHTML = STATE.subjects
    .map((s) => {
      const pct = s.total
        ? (((s.attended || 0) + (s.dutyLeave || 0)) / s.total) * 100
        : 0;
      const { need, bunk } = calcNeedAndBunk(s, STATE.target);
      const cls = pctClass(pct);
      return `<div class="card p-3 flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate">${s.name}</p>
        <div class="progress-track h-1 mt-1.5">
          <div class="progress-fill ${pct >= STATE.target ? "bg-green-500" : pct >= STATE.target - 10 ? "bg-yellow-500" : "bg-red-500"}" style="width:${pct.toFixed(1)}%"></div>
        </div>
      </div>
      <div class="text-right flex-shrink-0">
        <span class="text-sm font-bold ${cls}">${pct.toFixed(1)}%</span>
       <p class="text-xs text-gray-500">${(s.attended || 0) + (s.dutyLeave || 0)}/${s.total}</p>
      </div>
      <div class="text-right text-xs flex-shrink-0">
        ${need > 0 ? `<span class="text-yellow-400">Need +${need}</span>` : `<span class="text-green-400">${bunk} bunks safe</span>`}
      </div>
    </div>`;
    })
    .join("");
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

  tbody.innerHTML = STATE.subjects
    .map((s) => {
      const pct = s.total
        ? (((s.attended || 0) + (s.dutyLeave || 0)) / s.total) * 100
        : 0;
      const cls = pctClass(pct);
      return `<tr class="border-b border-white/5 hover:bg-white/2">
      <td class="px-4 py-3 text-sm font-medium">${s.name}</td>
      <td class="px-4 py-3 text-center text-sm">${(s.attended || 0) + (s.dutyLeave || 0)}</td>
      <td class="px-4 py-3 text-center text-sm">${s.total}</td>
      <td class="px-4 py-3 text-center"><span class="font-semibold text-sm ${cls}">${pct.toFixed(1)}%</span></td>
      <td class="px-4 py-3 text-right">
        <div class="flex gap-1 justify-end">
          <button class="btn-success text-xs" style="padding:4px 8px" onclick="markAttendance('${s.id}','present')" title="Present"><i class="fas fa-check"></i></button>
          <button class="btn-danger text-xs" style="padding:4px 8px" onclick="markAttendance('${s.id}','absent')" title="Absent"><i class="fas fa-times"></i></button>
          <button class="btn-ghost text-xs" style="padding:4px 8px" onclick="openEditSubjectModal('${s.id}')" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn-danger text-xs" style="padding:4px 8px" onclick="deleteSubject('${s.id}')" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
    })
    .join("");
}

// ─────────────────────────────────────────────
// 11. SUBJECT-LINKED MANUAL CALCULATOR (Attendance page)
// ─────────────────────────────────────────────
let calcState = { attended: 0, total: 0, min_attended: 0, min_total: 0 };
let calcChartInst = null;

function populateCalcSubjects() {
  const sel = document.getElementById("calcSubject");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Select Subject</option>';
  STATE.subjects.forEach((s, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = s.name;
    sel.appendChild(opt);
  });
  if (prev && sel.querySelector(`option[value="${prev}"]`)) sel.value = prev;
}

document.addEventListener("change", (e) => {
  if (e.target.id === "calcSubject") {
    const idx = e.target.value;
    if (idx === "") return;
    const s = STATE.subjects[parseInt(idx, 10)];
    if (!s) return;
    calcState = {
      attended: s.attended || 0,
      total: s.total || 0,
      min_attended: s.attended || 0,
      min_total: s.total || 0,
    };
    renderCalc();
  }
});

function updateSubjectCalc() {
  calcState.total =
    parseInt(document.getElementById("calcTotalInput").value, 10) || 0;
  calcState.attended =
    parseInt(document.getElementById("calcAttendedInput").value, 10) || 0;
  renderCalc();
}

let futureAttend = 0;

function changeFutureAttend(delta) {
  const attendedInput = document.getElementById("calcAttendedInput");
  const totalInput = document.getElementById("calcTotalInput");

  let attended = parseInt(attendedInput.value, 10) || 0;
  let total = parseInt(totalInput.value, 10) || 0;

  attended += delta;
  total += delta;

  // don't go below original sheet values
  attended = Math.max(calcState.min_attended, attended);
  total = Math.max(calcState.min_total, total);

  attendedInput.value = attended;
  totalInput.value = total;

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
    document.getElementById("calcStatus").textContent = "Select a subject";
    const needEl = document.getElementById("calcNeed");
    const bunkEl = document.getElementById("calcBunk");

    if (needEl) needEl.textContent = "--";
    if (bunkEl) bunkEl.textContent = "--";
    renderCalcChart();
    return;
  }

  const pct = (a / t) * 100;
  const pctEl = document.getElementById("calcPercent");
  pctEl.textContent = pct.toFixed(1) + "%";

  if (pct >= STATE.target) {
    pctEl.className = "text-3xl font-bold text-green-400";
    const calcStatus = document.getElementById("calcStatus");
    if (calcStatus) calcStatus.textContent = "Safe ✓";
  } else if (pct >= STATE.target - 10) {
    pctEl.className = "text-3xl font-bold text-yellow-400";
    document.getElementById("calcStatus").textContent = "Warning ⚠";
  } else {
    pctEl.className = "text-3xl font-bold text-red-400";
    document.getElementById("calcStatus").textContent = "At Risk ✗";
  }

  const { need, bunk } = calcNeedAndBunk(
    { attended: a, total: t },
    STATE.target,
  );

  const calcNeedEl = document.getElementById("calcNeed");
  const calcBunkEl = document.getElementById("calcBunk");

  if (calcNeedEl) calcNeedEl.textContent = need > 0 ? "+" + need : "0";

  if (calcBunkEl) calcBunkEl.textContent = bunk > 0 ? bunk + " bunks" : "0";
  renderCalcChart(a, t);
}

function renderCalcChart(a, t) {
  const ctx = document.getElementById("calcChart");
  if (!ctx) return;
  if (calcChartInst) {
    calcChartInst.destroy();
    calcChartInst = null;
  }

  const labels = [],
    data = [];
  if (t) {
    for (let i = 0; i <= 12; i++) {
      labels.push("+" + i);
      data.push((((a + i) / (t + i)) * 100).toFixed(1));
    }
  }
  const absent = Math.max(0, t - a);

  const { need, bunk } = calcNeedAndBunk(
    { attended: a, total: t },
    STATE.target,
  );

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
  document.getElementById("calcSubject").value = "";
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

let baseAttended = 0;
let baseTotal = 0;

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
    statusEl.textContent = "Safe ✓";
  } else if (pct >= quickCalcTarget - 10) {
    pctEl.className = "text-3xl font-bold text-yellow-400";
    statusEl.textContent = "Warning ⚠";
  } else {
    pctEl.className = "text-3xl font-bold text-red-400";
    statusEl.textContent = "At Risk ✗";
  }

  const { need, bunk } = calcNeedAndBunk({ attended, total }, quickCalcTarget);
  document.getElementById("qcNeed").textContent =
    need > 0 ? "+" + need + "" : "0";
  document.getElementById("qcBunk").textContent =
    bunk > 0 ? bunk + " bunks" : "0";

  renderQcChart(attended, total);
}

function renderQcChart(a, t) {
  const ctx = document.getElementById("qcChart");
  if (!ctx) return;
  if (qcChartInst) {
    qcChartInst.destroy();
    qcChartInst = null;
  }

  const labels = [],
    data = [];
  if (t) {
    for (let i = 0; i <= 12; i++) {
      labels.push("+" + i);
      data.push((((a + i) / (t + i)) * 100).toFixed(1));
    }
  }

 const absent = Math.max(0, t - a);

 const { need, bunk } = calcNeedAndBunk(
   { attended: a, total: t },
   quickCalcTarget,
 );

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

  document.getElementById("attendedLegend").innerHTML =
    `<span class="legend-dot" style="background:${colors[0]}"></span>`;

  document.getElementById("bunkLegend").innerHTML =
    `<span class="legend-dot" style="background:${colors[1]}"></span>`;

  document.getElementById("needLegend").innerHTML =
    `<span class="legend-dot" style="background:${colors[2]}"></span>`;

  document.getElementById("absentLegend").innerHTML =
    `<span class="legend-dot" style="background:${colors[3]}"></span>`;
}

function resetQuickCalc() {
  document.getElementById("qcTotal").value = "";
  document.getElementById("qcAttended").value = "";
  renderQuickCalc();
}

// ─────────────────────────────────────────────
// 13. ANALYTICS — BREAKDOWN CHART
// ─────────────────────────────────────────────
let attendanceChartInst = null;

function renderAnalyticsPage() {
  renderAttendanceBreakdownChart();

  if (Object.keys(dailySubjectMap).length)
    renderSubjectDailyChart(dailySubjectMap);
}

function renderAttendanceBreakdownChart() {
  const ctx = document.getElementById("attendanceChart");
  if (!ctx) return;
  if (attendanceChartInst) {
    attendanceChartInst.destroy();
    attendanceChartInst = null;
  }
  if (!STATE.subjects.length) return;

  const labels = STATE.subjects.map((s) => {
    const m = s.name.match(/\(([^)]+)\)/);
    return m
      ? m[1]
      : s.name.length > 10
        ? s.name.substring(0, 9) + "…"
        : s.name;
  });
  const present = STATE.subjects.map((s) => s.attended || 0);
  const duty = STATE.subjects.map((s) => s.dutyLeave || 0);
  const absent = STATE.subjects.map((s) =>
    Math.max(0, (s.total || 0) - (s.attended || 0) - (s.dutyLeave || 0)),
  );
  const minLine = STATE.subjects.map(
    (s) => (s.total || 0) * (STATE.target / 100),
  );

  attendanceChartInst = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Present",
          data: present,
          backgroundColor: "rgba(99,102,241,0.85)",
          borderRadius: 6,
          order: 2,
        },
        {
          type: "bar",
          label: "Duty Leave",
          data: duty,
          backgroundColor: "rgba(245,158,11,0.85)",
          borderRadius: 6,
          order: 2,
        },
        {
          type: "bar",
          label: "Absent",
          data: absent,
          backgroundColor: "rgba(239,68,68,0.75)",
          borderRadius: 6,
          order: 2,
        },
        {
          type: "line",
          label: `Min ${STATE.target}%`,
          data: minLine,
          borderColor: "#22c55e",
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 0,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#94a3b8", font: { size: 11 } } } },
      scales: {
        x: {
          stacked: true,
          ticks: { color: "#64748b" },
          grid: { display: false },
        },
        y: { stacked: true, beginAtZero: true, ticks: { color: "#64748b" } },
      },
    },
  });
}

// ─────────────────────────────────────────────
// 14. DAILY ATTENDANCE ANALYSIS (reset back to original behaviour:
//     upload a daily report → it maps each "Hour N" column to whichever
//     subject the selected timetable says was scheduled there on that
//     date's weekday, and draws one line per subject automatically.
//     No view toggle, no overall mode — straight subject-wise, like before.)
// ─────────────────────────────────────────────
let dailySubjectMap = {}; // subjectName -> { dateLabel -> pct }
let dailyChartInst = null;

function parseDailyExcel(file) {
  const tt = getTimetableById(STATE.week1TimetableId);
  if (!tt) {
    showToast("Select a timetable first (needed to map hours to subjects).");
    return;
  }

  const reader = new FileReader();
  reader.onload = (evt) => {
    const data = new Uint8Array(evt.target.result);
    const wb = XLSX.read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const startIdx = raw.findIndex((row) =>
      row.some((c) => String(c).toLowerCase().includes("date")),
    );
    if (startIdx === -1) {
      showToast("Could not find a Date column in this file.");
      return;
    }

    const headers = raw[startIdx];
    const rows = raw.slice(startIdx + 1).map((r) => {
      const o = {};
      headers.forEach((h, i) => {
        o[h] = r[i];
      });
      return o;
    });

    processDailyRows(rows, tt);
  };
  reader.readAsArrayBuffer(file);
}

function processDailyRows(rows, tt) {
  const ttByDay = {};
  tt.rows.forEach((r) => {
    ttByDay[normalizeDayName(r.day)] = r.hours;
  });

  const subjAgg = {}; // subject -> dateLabel -> {p,t}
  const overallAgg = {};

  rows.forEach((row) => {
    const dateKey = Object.keys(row).find((k) =>
      k.toLowerCase().includes("date"),
    );
    let rawDate = row[dateKey];
    if (!rawDate || rawDate === "Total" || rawDate === "Sl.No.") {
      return;
    }
    if (!rawDate) return;

    let dateObj;
    if (typeof rawDate === "number") {
      dateObj = new Date(Date.UTC(1899, 11, 30) + rawDate * 86400000);
    } else {
      const str = String(rawDate).trim();

      let m;

      // dd-mm-yyyy
      if ((m = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/))) {
        dateObj = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      }

      // dd/mm/yyyy
      else if ((m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
        dateObj = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      } else {
        dateObj = new Date(str);
      }
    }
    const validDate = !isNaN(dateObj.getTime());
    const dateLabel = validDate
      ? `${String(dateObj.getDate()).padStart(2, "0")}/${String(
          dateObj.getMonth() + 1,
        ).padStart(2, "0")}/${dateObj.getFullYear()}`
      : String(rawDate);
    const weekdayKey = validDate
      ? normalizeDayName(
          dateObj.toLocaleDateString("en-US", { weekday: "long" }),
        )
      : null;

    const ttHours = weekdayKey ? ttByDay[weekdayKey] : null;
    if (!ttHours) return;

    Object.keys(row).forEach((key) => {
      const kLow = key.toLowerCase();
      if (
        !kLow.includes("hour") &&
        !kLow.includes("slot") &&
        !kLow.includes("period")
      )
        return;

      const val = String(row[key] || "")
        .trim()
        .toUpperCase();
      const isP = val.startsWith("P");
      const isA = val.startsWith("A");
      if (!isP && !isA) return;

      const numMatch = kLow.match(/\d+/);
      const hourIdx = numMatch ? parseInt(numMatch[0], 10) - 1 : -1;
      const subj = hourIdx >= 0 ? (ttHours[hourIdx] || "").trim() : "";
      if (!subj || subj.toLowerCase().includes("holiday")) return;
      overallAgg[dateLabel] = overallAgg[dateLabel] || {
        p: 0,
        t: 0,
      };

      overallAgg[dateLabel].t++;

      if (isP) {
        overallAgg[dateLabel].p++;
      }

      subjAgg[subj] = subjAgg[subj] || {};
      subjAgg[subj][dateLabel] = subjAgg[subj][dateLabel] || { p: 0, t: 0 };
      subjAgg[subj][dateLabel].t++;
      if (isP) subjAgg[subj][dateLabel].p++;
    });
  });

  dailySubjectMap = {};

  Object.entries(subjAgg).forEach(([subj, dateObj]) => {
    dailySubjectMap[subj] = {};

    const dates = sortDateLabels(Object.keys(dateObj));

    let runningPresent = 0;
    let runningTotal = 0;

    dates.forEach((date) => {
      const rec = dateObj[date];

      runningPresent += rec.p;
      runningTotal += rec.t;

      dailySubjectMap[subj][date] = runningTotal
        ? (runningPresent / runningTotal) * 100
        : 0;
    });
  });

  dailyOverallMap = {};

  Object.entries(overallAgg).forEach(([date, obj]) => {
    dailyOverallMap[date] = obj.t > 0 ? (obj.p / obj.t) * 100 : 0;
  });

  console.log(dailySubjectMap);
  renderSubjectDailyChart(dailySubjectMap);
  showToast("Daily report processed ✓");
}

function renderDailyOverallChart() {
  const canvas = document.getElementById("dailyOverallChart");
  if (!canvas) return;

  if (window.dailyOverallChartInstance) {
    window.dailyOverallChartInstance.destroy();
  }

  const labels = sortDateLabels(Object.keys(dailyOverallMap));

  const values = labels.map((d) => dailyOverallMap[d]);

  window.dailyOverallChartInstance = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Overall Attendance %",
          data: values,
          borderColor: "#6366f1",
          backgroundColor: "rgba(99,102,241,0.15)",
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
        },
      },
    },
  });
}
function sortDateLabels(labels) {
  return labels.slice().sort((a, b) => {
    const sep = a.includes("/") ? "/" : "-";
    const [d1, m1, y1] = a.split(sep);
    const [d2, m2, y2] = b.split(sep);
    return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
  });
}

function renderSubjectDailyChart(subjectMap) {
  const ctx = document.getElementById("dailyChart");
  if (!ctx) return;
  if (dailyChartInst) {
    dailyChartInst.destroy();
    dailyChartInst = null;
  }

  const allDates = new Set();
  Object.values(subjectMap).forEach((m) =>
    Object.keys(m).forEach((d) => allDates.add(d)),
  );

  const labels = sortDateLabels(Array.from(allDates));
  const subjects = Object.keys(subjectMap);

  subjects.forEach((subj) => {
    let lastPct = null;

    labels.forEach((date) => {
      if (subjectMap[subj][date] != null) {
        lastPct = subjectMap[subj][date];
      } else if (lastPct != null) {
        subjectMap[subj][date] = lastPct;
      }
    });
  });

  if (!labels.length || !subjects.length) return;

  const colors = [
    "#6366f1",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#3b82f6",
    "#ec4899",
    "#14b8a6",
    "#a855f7",
  ];
  const datasets = subjects.map((s, i) => ({
    label: s,
    data: labels.map((d) =>
      subjectMap[s][d] != null ? subjectMap[s][d].toFixed(1) : null,
    ),
    borderColor: colors[i % colors.length],
    tension: 0.4,
    borderWidth: 2,
    pointRadius: 0,
    spanGaps: true,
  }));

  dailyChartInst = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            usePointStyle: true,
            boxWidth: 10,
            color: "#f1f5f9",
          },
        },
      },
      scales: {
        y: { min: 0, max: 100, ticks: { color: "#64748b" } },
        x: { ticks: { color: "#64748b", maxRotation: 45 } },
      },
    },
  });
}

// ─────────────────────────────────────────────
// 15. SIDEBAR PROFILE / TARGET
// ─────────────────────────────────────────────
function setTarget(t) {
  STATE.target = t;
  saveState();
  updateTargetUI();
  refreshAll();
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
// 16. RESET OPERATIONS (now triggered from the Manage Data modal)
// ─────────────────────────────────────────────
function resetAttendanceCounts() {
  STATE.subjects = STATE.subjects.map((s) => ({ ...s, attended: 0, total: 0 }));
  saveState();
  refreshAll();
  showToast("Attendance counts reset.");
}

function resetTimetables() {
  STATE.timetables = [];
  STATE.week1TimetableId = null;
  STATE.week2TimetableId = null;
  saveState();
  renderTimetablePage();
  renderPredictionPage();
  showToast("Timetables cleared.");
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
// 17. CONFIRM MODAL
// ─────────────────────────────────────────────
let _confirmCallback = null;

function confirmAction(msg, cb) {
  _confirmCallback = cb;
  document.getElementById("confirmMsg").textContent = msg;
  document.getElementById("confirmModal").classList.add("open");
}
function closeConfirm() {
  _confirmCallback = null;
  document.getElementById("confirmModal").classList.remove("open");
}
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("confirmOk").addEventListener("click", () => {
    if (_confirmCallback) _confirmCallback();
    closeConfirm();
  });
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

// ─────────────────────────────────────────────
// 19. UTILITIES
// ─────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setDateDisplay() {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const now = new Date();
  setText(
    "currentDate",
    `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`,
  );
}

function refreshAll() {
  if (STATE.currentPage === "dashboard") renderDashboard();
  if (STATE.currentPage === "attendance") renderAttendancePage();
  if (STATE.currentPage === "timetable") renderTimetablePage();
  if (STATE.currentPage === "prediction") renderPredictionPage();
  if (STATE.currentPage === "calculator") {
    renderQuickCalc();
    renderCgpaCalc();
  }
  if (STATE.currentPage === "analytics") renderAnalyticsPage();
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
// 21. TIMETABLE SEARCH
// ─────────────────────────────────────────────
function searchTimetable() {
  const q = document.getElementById("ttSearchInput")?.value || "";
  filterTimetables(q);
  showToast(q ? `Filtered: "${q}"` : "Showing all classes");
}

// ─────────────────────────────────────────────
// 22. SITE CONFIG (Google Forms URLs)
// ─────────────────────────────────────────────
let siteConfig = {};

async function initSiteConfig() {
  try {
    const res = await fetch("ads/config.json");
    if (res.ok) {
      siteConfig = await res.json();
      const ttBtn = document.getElementById("requestTtBtn");
      const formUrl = siteConfig.googleForms?.requestTimetable;
      if (ttBtn && formUrl && !formUrl.includes("PASTE_YOUR")) {
        ttBtn.href = formUrl;
      } else if (ttBtn) {
        ttBtn.href = "#";
        ttBtn.onclick = (e) => {
          e.preventDefault();
          showToast("Set requestTimetable URL in ads/config.json");
        };
      }
    }
  } catch (e) {
    console.warn("Could not load site config:", e);
  }
}

// ─────────────────────────────────────────────
// 23. COLLEGE ADS SYSTEM
// ─────────────────────────────────────────────
let adsList = [];
let adsCurrentSlide = 0;
let adsMustSwipeAll = false;
let adsViewed = new Set();
let adsAutoSlide = null;

let inlineAdsAutoSlide = null;

async function initAdsSystem() {
  const sheet = await fetchSheetAds();
  adsList = sheet;

  renderInlineAdSlider();

  if (adsList.length > 1) {
    clearInterval(inlineAdsAutoSlide);

    inlineAdsAutoSlide = setInterval(() => {
      adsCurrentSlide = (adsCurrentSlide + 1) % adsList.length;

      renderInlineAdSlider();
    }, 3000);
  }

  if (!adsList.length) return;

  showAdsPopup();
}

async function fetchSheetAds() {
  try {
    const cfgRes = await fetch("ads/config.json");
    if (!cfgRes.ok) return [];
    const cfg = await cfgRes.json();
    const url = cfg.googleSheets?.adsCsvUrl;
    if (!url || url.includes("PASTE_YOUR")) return [];

    const res = await fetch(url);
    if (!res.ok) return [];
    const text = await res.text();
    return parseAdsCsv(text);
  } catch {
    return [];
  }
}

function parseAdsCsv(csv) {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const ads = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 2) continue;
    const active = (cols[3] || "").toLowerCase();
    if (
    active !== "on" &&
    active !== "yes" &&
    active !== "true"
    ) continue;
    ads.push({
      title: cols[0] || "Ad",
      image: cols[1] || "",
      linkUrl: cols[2] || "",
      active: true,
    });
  }
  return ads;
}

function mergeAds(local, sheet) {
  const seen = new Set();
  const merged = [];
  [...sheet, ...local].forEach((ad) => {
    const key = ad.image || ad.title;
    if (!seen.has(key) && ad.image) {
      seen.add(key);
      merged.push(ad);
    }
  });
  return merged;
}

function showAdsPopup() {
  if (!adsList.length) return;
  adsCurrentSlide = 0;
  adsViewed.clear();
  adsViewed.add(0);
  adsMustSwipeAll = true;
  const closeBtn = document.getElementById("adsCloseBtn");
  closeBtn?.classList.remove("visible");
  const ad = adsList[adsCurrentSlide];
  new Image().src =
  "https://script.google.com/macros/s/AKfycbw5uW_Mtc2s3Uz9ZBRgyKKdo71jxSMgwluny58TKUNudKCOc8pBV9Cf3MOPXEkCG8D2/exec?action=view&title=" +
  encodeURIComponent(ad.title);

  console.log("Ad Viewed:", adsList[adsCurrentSlide].title);
  const slidesEl = document.getElementById("adsSlides");
  const dotsEl = document.getElementById("adsDots");
  const hintEl = document.getElementById("adsSwipeHint");
  if (!slidesEl) return;

  slidesEl.innerHTML = adsList
    .map(
      (ad, i) => `
    <div class="ads-slide ${i === 0 ? "active" : ""}" data-idx="${i}">
      ${
        ad.linkUrl
          ? `<a href="${ad.linkUrl}"target="_blank"onclick="trackAdClick('${ad.title}')">`: ""
      }
      <img src="${ad.image}" alt="${ad.title}" />
      ${ad.linkUrl ? "</a>" : ""}
      <p class="text-sm text-gray-300 mt-2">${ad.title}</p>
    </div>`,
    )
    .join("");

  dotsEl.innerHTML = adsList
    .map((_, i) => `<div class="ads-dot ${i === 0 ? "active" : ""}" onclick="adsGoTo(${i})"></div>`)
    .join("");

  if (hintEl) hintEl.classList.toggle("hidden", !adsMustSwipeAll);
  updateAdsCloseBtn();
  document.getElementById("adsPopup")?.classList.add("open");

  clearInterval(adsAutoSlide);
  adsAutoSlide = setInterval(() => {
    adsNav(1);
  }, 2000);
  initAdsSwipe();
}

function trackAdClick(title) {
  new Image().src =
    "https://script.google.com/macros/s/AKfycbw5uW_Mtc2s3Uz9ZBRgyKKdo71jxSMgwluny58TKUNudKCOc8pBV9Cf3MOPXEkCG8D2/exec?action=click&title=" +
    encodeURIComponent(title);
}

function updateAdsCloseBtn() {
  const btn = document.getElementById("adsCloseBtn");
  if (!btn) return;
  if (!adsMustSwipeAll) {
    btn.classList.add("visible");
    return;
  }
  const viewedAll = adsViewed.size >= adsList.length;
  btn.classList.toggle("visible", viewedAll);
}

function adsGoTo(idx) {
  adsCurrentSlide = Math.max(0, Math.min(idx, adsList.length - 1));
  document.querySelectorAll(".ads-slide").forEach((s, i) => {
    s.classList.toggle("active", i === adsCurrentSlide);
  });
  document.querySelectorAll(".ads-dot").forEach((d, i) => {
    d.classList.toggle("active", i === adsCurrentSlide);
    renderInlineAdSlider();
  });

  const ad = adsList[adsCurrentSlide];
  new Image().src =
    "https://script.google.com/macros/s/AKfycbw5uW_Mtc2s3Uz9ZBRgyKKdo71jxSMgwluny58TKUNudKCOc8pBV9Cf3MOPXEkCG8D2/exec?action=view&title=" +
    encodeURIComponent(ad.title);
  adsViewed.add(adsCurrentSlide);
  updateAdsCloseBtn();
}

function adsNav(dir) {
  let next = adsCurrentSlide + dir;

  if (next >= adsList.length) next = 0;
  if (next < 0) next = adsList.length - 1;

  adsGoTo(next);

  clearInterval(adsAutoSlide);

  adsAutoSlide = setInterval(() => {
    adsNav(1);
  }, 2000);
}

function closeAdsPopup() {
  if (adsMustSwipeAll && adsViewed.size < adsList.length) {
    showToast("View all ads first");
    return;
  }
 clearInterval(adsAutoSlide);
 document.getElementById("adsPopup")?.classList.remove("open");
}

function initAdsSwipe() {
  const carousel = document.querySelector(".ads-carousel");
  if (!carousel) return;
  let startX = 0;
  carousel.ontouchstart = (e) => { startX = e.touches[0].clientX; };
  carousel.ontouchend = (e) => {
    const diff = e.changedTouches[0].clientX - startX;
    if (Math.abs(diff) > 50) adsNav(diff < 0 ? 1 : -1);
  };
}

// ─────────────────────────────────────────────
// 24. CGPA CALCULATOR
// ─────────────────────────────────────────────

function renderCgpaCalc() {
  const curEl = document.getElementById("cgpaCurrent");
  const tgtEl = document.getElementById("cgpaTarget");
  const semEl = document.getElementById("semCompleted");
  if (!curEl || !tgtEl || !semEl) return;

  let current = parseFloat(curEl.value);
  let target = parseFloat(tgtEl.value);
  let sem = parseInt(semEl.value, 10);
  if (current > 10) {
    current = 10;
    curEl.value = 10;
  }

  if (target > 10) {
    target = 10;
    tgtEl.value = 10;
  }

  if (sem > 7) {
    sem = 7;
    semEl.value = 7;
  }

  if (current < 0) {
    current = 0;
    curEl.value = 0;
  }

  if (target < 0) {
    target = 0;
    tgtEl.value = 0;
  }

  if (isNaN(sem)) {
    sem = NaN;
  }

  const deltaEl = document.getElementById("cgpaDelta");
  const statusEl = document.getElementById("cgpaStatus");
  const gapEl = document.getElementById("cgpaGap10");

  if (isNaN(current) || isNaN(target) || isNaN(sem)) {
    deltaEl.textContent = "--";
    deltaEl.className = "text-3xl font-bold";
    if (statusEl) statusEl.textContent = "Enter values";
    if (gapEl) gapEl.textContent = "--";
    return;
  }

  current = Math.min(10, Math.max(0, current));
  target = Math.min(10, Math.max(0, target));
  const totalSem = 8;
  const completedSem = Math.min(totalSem - 1, Math.max(1, sem));

  const remainingSem = 8 - completedSem;

  const requiredAvg = (target * 8 - current * completedSem) / remainingSem;

  const gap10 = 10 - target;

  if (requiredAvg <= 10) {
    deltaEl.textContent = requiredAvg.toFixed(2);

    if (requiredAvg >= 9) {
      deltaEl.className = "text-3xl font-bold text-red-400";
    } else if (requiredAvg >= 8) {
      deltaEl.className = "text-3xl font-bold text-yellow-400";
    } else {
      deltaEl.className = "text-3xl font-bold text-green-400";
    }

    if (statusEl) statusEl.textContent = "";
  } else {
    deltaEl.textContent = "IMPOSSIBLE";
    deltaEl.className = "text-3xl font-bold text-red-400";
    if (statusEl) statusEl.textContent = "";
  }
  const card = document.getElementById("neededCgpaCard");

  card.classList.remove("cgpa-green", "cgpa-yellow", "cgpa-red");

  if (requiredAvg <= 7.5) {
    card.classList.add("cgpa-green");
  } else if (requiredAvg <= 8.5) {
    card.classList.add("cgpa-yellow");
  } else {
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
// 25. ADD TO CALENDAR (prediction cards)
// ─────────────────────────────────────────────
const HOUR_SCHEDULE = [
  { start: "08:50", end: "09:45", label: "Hr 1" },
  { start: "09:45", end: "10:40", label: "Hr 2" },
  { start: "10:50", end: "11:45", label: "Hr 3" },
  { start: "11:45", end: "12:35", label: "Hr 4" },
  { start: "12:35", end: "13:25", label: "Hr 5" },
  { start: "13:25", end: "13:20", label: "Hr 6" },
  { start: "14:30", end: "15:25", label: "Hr 7" },
  { start: "15:25", end: "16:15", label: "Hr 8" },
];

function getNextDateForDay(dayName) {
  const norm = normalizeDayName(dayName);
  const dayIdx = DAY_ORDER.findIndex((d) => norm.includes(d) || d.includes(norm));
  if (dayIdx === -1) return new Date();

  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    if (d.getDay() === dayIdx) return d;
  }
  return now;
}

function getSubjectPredInfo(subjectId) {
  const s = STATE.subjects.find((x) => x.id === subjectId);
  if (!s) return null;

  const week = document.getElementById("predCardsWeekSelect")?.value || "1";
  const w1 = getTimetableById(STATE.week1TimetableId);
  const w2 = getTimetableById(STATE.week2TimetableId);
  const todayIdx = getTodayOrderIdx();

  let extra = 0;
  if (week === "1") {
    extra = w1 ? countSubjectInRows(w1.rows, s.name, todayIdx, STATE.weekOverrides.week1) : 0;
  } else {
    const w1r = w1 ? countSubjectInRows(w1.rows, s.name, todayIdx, STATE.weekOverrides.week1) : 0;
    const w2f = w2 ? countSubjectInRows(w2.rows, s.name, undefined, STATE.weekOverrides.week2) : 0;
    extra = w1r + w2f;
  }

  const futureAttended = s.attended + extra;
  const futureTotal = s.total + extra;
  const { need, bunk } = calcNeedAndBunk(
    { attended: futureAttended, total: futureTotal },
    STATE.target,
  );
  const statusText = need > 0 ? `+${need} needed` : `${bunk} safe bunk`;

  return { subject: s, statusText, tt: w1 };
}

function buildCalendarEventsForSubject(subjectId) {
  const info = getSubjectPredInfo(subjectId);
  if (!info || !info.tt) return [];

  const events = [];
  const clean = (str) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const sKey = clean(info.subject.name);

  info.tt.rows.forEach((row) => {
    const dayOrder = weekdayOrderIndex(row.day);
    const todayIdx = getTodayOrderIdx();
    if (dayOrder !== -1 && dayOrder < todayIdx) return;

    row.hours.forEach((cell, hIdx) => {
      const text = String(cell || "").trim();
      if (!text || text.toLowerCase().includes("holiday")) return;
      const tKey = clean(text);
      if (!(sKey.includes(tKey) || tKey.includes(sKey))) return;

      const sched = HOUR_SCHEDULE[hIdx] || { start: "09:00", end: "10:00", label: `Hr ${hIdx + 1}` };
      const date = getNextDateForDay(row.day);
      const [sh, sm] = sched.start.split(":").map(Number);
      const [eh, em] = sched.end.split(":").map(Number);

      const start = new Date(date);
      start.setHours(sh, sm, 0, 0);
      const end = new Date(date);
      end.setHours(eh, em, 0, 0);

      events.push({
        title: `${sched.label}: ${info.subject.name} — ${info.statusText}`,
        start,
        end,
        day: row.day,
      });
    });
  });

  return events;
}

function formatIcsDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function downloadIcs(events, filename) {
  if (!events.length) {
    showToast("No upcoming classes found for this subject.");
    return;
  }

  let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ZapTrack//EN\r\n";
  events.forEach((ev) => {
    ics += "BEGIN:VEVENT\r\n";
    ics += `DTSTART:${formatIcsDate(ev.start)}\r\n`;
    ics += `DTEND:${formatIcsDate(ev.end)}\r\n`;
    ics += `SUMMARY:${ev.title.replace(/,/g, "\\,")}\r\n`;
    ics += `DESCRIPTION:ZapTrack attendance prediction\r\n`;
    ics += "END:VEVENT\r\n";
  });
  ics += "END:VCALENDAR";

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`Added ${events.length} event(s) to calendar file ✓`);
}

function addSubjectToCalendar(subjectId) {
  const events = buildCalendarEventsForSubject(subjectId);
  const s = STATE.subjects.find((x) => x.id === subjectId);
  downloadIcs(events, `zaptrack-${(s?.name || "subject").replace(/\W+/g, "-").slice(0, 20)}.ics`);
}

function addAllPredCardsToCalendar() {
  if (!STATE.subjects.length) {
    showToast("No subjects loaded.");
    return;
  }
  const allEvents = [];
  STATE.subjects.forEach((s) => {
    allEvents.push(...buildCalendarEventsForSubject(s.id));
  });
  downloadIcs(allEvents, "zaptrack-all-subjects.ics");
}
