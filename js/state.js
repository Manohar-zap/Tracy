const SITE_CLOSED = false;
const CAMPUS_API =
  "https://script.google.com/macros/s/AKfycbzJN3ifkutdyS5LfCOpS3iKClUPa2n3y9QV8Rlc5myvxTv6X6IwS_mykedcEr3hq6Ud/exec";

function validateUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (e) {
    return false;
  }
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const STATE = {
  subjects: [], // [{ id, name, attended, total }]
  profile: {}, // { name, dept, roll, batch, term, reg }
  timetables: [], // [{ id, label, rows: [{day, hours:[]}] }]
  week1TimetableId: null,
  week2TimetableId: null,
  target: 75, // global target — dashboard / attendance coloring
  quickCalcTarget: 75, // standalone calculator target toggle
  currentPage: "dashboard",
  dailySubjectMap: {},
  dailyOverallMap: {},
  skippedPredictions: {}, // { [subjectId]: ["date_hour", ...] }
  lastAttendanceReportDate: null,

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
  "1MTAIE01",
  "1MTDSC01",
  "3ADS01",
  "3ADS02",
  "3ADS03",
  "3CAI01",
  "3CAI02",
  "3CAI03",
  "3CAI04",
  "3CAI05",
  "3CAI06",
  "3CAI07",
  "3CBC01",
  "3CBD01",
  "3CCS01",
  "3CCS02",
  "3CCS03",
  "3CCS04",
  "3CDV01",
  "3CDV02",
  "3CIT01",
  "3CIT02",
  "3CSD01",
  "3CSD02",
  "3CSD03",
  "3CSD04",
  "3RAI01",
  "5CAI01",
  "5CAI02",
  "5CAI03",
  "5CAI04",
  "5CBC01",
  "5CBD01",
  "5CCS01",
  "5CCS02",
  "5CCS03",
  "5CDV01",
  "5CIT01",
  "5CIT02",
  "5CIT03",
  "5CSD01",
  "5CSD02",
  "5CSD03",
  "5CSD04",
  "7CAI01",
  "7CAI02",
  "7CAI03",
  "7CBC01",
  "7CBD01",
  "7CCS01",
  "7CCS02",
  "7CCS03",
  "7CDV01",
  "7CIT01",
  "7CIT02",
  "7CIT03",
  "7CSD01",
  "7CSD02",
  "7CSD03",
];

// runtime flag — do not persist to localStorage
let TIMETABLES_LOADED = false;
let genZMode = localStorage.getItem("genZMode") === "true";
let guideMode = false;
const timetableLoadPromises = new Map();

const HOUR_SCHEDULE = [
  { start: "08:50", end: "09:45", label: "Hr 1" },
  { start: "09:45", end: "10:40", label: "Hr 2" },
  { start: "10:50", end: "11:45", label: "Hr 3" },
  { start: "11:45", end: "12:35", label: "Hr 4" },
  { start: "12:35", end: "13:25", label: "Hr 5" },
  { start: "13:25", end: "14:20", label: "Hr 6" },
  { start: "14:30", end: "15:25", label: "Hr 7" },
  { start: "15:25", end: "16:15", label: "Hr 8" },
];

const SUBJECT_ALIASES = {
  eda: "exploratorydataanalysis",
  dbms: "databasemanagementsystems",
  sfds: "statisticalfoundationsfordatascience",
  apt: "aptitudetraining",
  ai: "analysisofalgorithms",
  ml: "machinelearning",
  cc: "cloudcomputing",
};

const clean = (str) =>
  String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function sanitizeSubjectCell(cell) {
  if (!cell || typeof cell !== "string") return cell || "";
  const trimmed = cell.trim();
  if (!trimmed) return "";

  // If cell contains delimiters like / or , or \n or whitespace or parentheses or puniv
  if (trimmed.includes("/") || trimmed.includes("&") || trimmed.includes("\n") || trimmed.includes(",") || trimmed.includes("(") || /\s{2,}/.test(trimmed) || /puniv/i.test(trimmed)) {
    const rawParts = trimmed.split(/[\/\n,&+()\s]+/).map((p) => p.trim()).filter(Boolean);
    // Filter out faculty codes (e.g. PUNIV01748) and registration/section IDs (e.g. 20243MAT0002 or pure numbers/long codes)
    const validParts = rawParts.filter(
      (p) => !/^puniv\w*$/i.test(p) && !/^\d{5,}\w*$/i.test(p)
    );
    if (validParts.length === 1) {
      return validParts[0];
    }
    if (validParts.length > 1) {
      return validParts.join("/");
    }
    return rawParts[rawParts.length - 1] || trimmed;
  }

  // Single token that is PUNIV or section code
  if (/^puniv\w*$/i.test(trimmed) || /^\d{5,}\w*$/i.test(trimmed)) {
    return "";
  }
  return trimmed;
}

function sanitizeTimetable(tt) {
  if (!tt || !Array.isArray(tt.rows)) return tt;
  tt.rows.forEach((row) => {
    if (Array.isArray(row.hours)) {
      row.hours = row.hours.map(sanitizeSubjectCell);
    }
  });
  return tt;
}

function normalizeDayName(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function weekdayOrderIndex(dayLabel) {
  const norm = normalizeDayName(dayLabel);
  const idx = DAY_ORDER.findIndex((d) => norm.includes(d) || d.includes(norm));
  if (idx === -1) return -1;
  return idx === 0 ? 7 : idx;
}

const UNIVERSITY_HOLIDAYS = [
  "2026-06-26", // Muharram
  "2026-08-15", // Independence Day
  "2026-08-26", // Eid Milad
  "2026-09-14", // Vinayaka Chaturthi
  "2026-10-02", // Gandhi Jayanti
  "2026-10-10", // Mahalaya Amavasye
  "2026-10-20", // Mahanavami & Vijayadashmi
  "2026-11-01", // Kannada Rajyotsava
  "2026-11-08", // Naraka Chaturdashi
  "2026-11-10", // Balipadyami / Diwali
  "2026-12-25", // Christmas
  "2027-01-01", // New Year
  "2027-01-15", // Makara Sankranti
  "2027-01-26", // Republic Day
  "2027-03-06", // Maha Shivaratri
  "2027-03-10", // Ramzan
  "2027-03-26", // Good Friday
  "2027-04-07", // Ugadi
  "2027-04-14", // Ambedkar Jayanthi
  "2027-05-01", // May Day
  "2027-05-17", // Bakrid
  "2027-06-15", // Muharram
];

function isUniversityHoliday(date) {
  if (!date) return false;
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return UNIVERSITY_HOLIDAYS.includes(key);
}

// ─────────────────────────────────────────────
// 22. SITE CONFIG (Google Forms URLs)
// ─────────────────────────────────────────────
let siteConfig = {};

function initSiteConfig() {
  const ttBtn = document.getElementById("requestTtBtn");

  if (ttBtn) {
    ttBtn.href =
      "https://docs.google.com/forms/d/e/1FAIpQLSfTu29FE7oib7PFiIdb14P-MZY5dV8rfTrsBjww3Lu-RAmS6A/viewform?usp=dialog";
    ttBtn.target = "_blank";
  }
}

// ─────────────────────────────────────────────
window.STATE = STATE;
window.escapeHtml = escapeHtml;
window.validateUrl = validateUrl;
window.clean = clean;
