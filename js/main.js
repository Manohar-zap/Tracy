// 19. UTILITIES & ERROR IDENTIFIER
window.__ERROR_LOGS = [];

function generateErrorId() {
  return "ERR-" + Math.random().toString(36).substring(2, 7).toUpperCase();
}

function logError(op, err) {
  const errId = generateErrorId();
  const timestamp = new Date().toISOString();
  const errMsg = err && (err.message || (typeof err === "string" ? err : JSON.stringify(err)));
  const errStack = err && err.stack ? err.stack : null;

  const logEntry = {
    id: errId,
    timestamp,
    operation: op,
    message: errMsg,
    stack: errStack,
  };

  console.error(`[Tracy Error] [${errId}] Operation: ${op}`, err);

  if (window.__ERROR_LOGS) {
    window.__ERROR_LOGS.unshift(logEntry);
    if (window.__ERROR_LOGS.length > 30) {
      window.__ERROR_LOGS.pop();
    }
  }

  return errId;
}

// Global Exception Handler
window.onerror = function(msg, url, line, col, error) {
  logError("Uncaught Global Error", { msg, url, line, col, error });
  return false;
};

window.onunhandledrejection = function(event) {
  logError("Unhandled Promise Rejection", event.reason);
};

// 20. INITIALIZATION
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  try {
    if (typeof SITE_CLOSED !== 'undefined' && SITE_CLOSED) {
      document.body.innerHTML = `
        <div style="
          min-height:100vh;
          display:flex;
          align-items:center;
          justify-content:center;
          text-align:center;
          padding:24px;
          background:#0a0a0b;
          color:#fff;
          font-family:system-ui,sans-serif;
        ">
          <div>
            <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
            <h1 style="font-size:28px;font-weight:700;margin-bottom:8px;">
              Tracy is temporarily unavailable
            </h1>
            <p style="color:#9ca3af;font-size:15px;">
              The site is temporarily closed for maintenance.<br>
              Please check back later.
            </p>
          </div>
        </div>
      `;
      return;
    }

    // Global Dropdown Close
    document.addEventListener("click", (e) => {
      const box = document.getElementById("dailyDropdown");
      if (box && !box.contains(e.target)) {
        const list = document.getElementById("dailyDropdownList");
        if (list) list.classList.remove("show");
      }
    });

    // Main File Input
    const mainInput = document.getElementById("mainFileInput");
    const uploadZone = document.getElementById("uploadZone");

    if (mainInput) {
      mainInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          parseAttendanceExcel(file);
          mainInput.value = "";
        }
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

    // Daily File Input
    const dailyInput = document.getElementById("dailyFileInput");
    if (dailyInput) {
      dailyInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          document.getElementById("dailyFileChosenLabel").textContent = "Upload";
          parseDailyExcel(file);
          dailyInput.value = "";
        }
      });
    }

    // Load State & Data
    loadState();
    checkAttendanceReportStatus();

    // Theme Restoration
    const saved = localStorage.getItem("theme");
    if (saved === "light") {
      document.body.classList.add("light-theme");
      const icon = document.getElementById("themeIcon");
      if (icon) icon.className = "fas fa-sun text-yellow-500";
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        "content",
        document.body.classList.contains("light-theme") ? "#f8fafc" : "#0a0a0b",
      );
    }

    dailySubjectMap = STATE.dailySubjectMap || {};
    dailyOverallMap = STATE.dailyOverallMap || {};

    updateTargetUI();

    // Navigation
    navigateTo(STATE.currentPage || "dashboard");

    // Feature Initialization
    loadBuiltInTimetables();
    initAdsSystem();
    if (typeof initSiteConfig === 'function') initSiteConfig();
    loadCampusPosts();
    if (typeof buildSchoolDropdown === 'function') buildSchoolDropdown();
    if (typeof buildYearDropdown === 'function') buildYearDropdown();

    // Register all Event Listeners
    setupGlobalEventListeners();

    // Gen Z Mode Button UI
    const btn = document.getElementById("genZBtn");
    if (btn) {
      btn.classList.toggle("bg-indigo-600", genZMode);
      btn.classList.toggle("text-white", genZMode);
      btn.classList.toggle("bg-white/5", !genZMode);
    }

    // Auto-start Guide for new users
    if (!localStorage.getItem("guideSeen_v2")) {
      setTimeout(startGuide, 700);
    }
  } catch (err) {
    logError("App Initialization", err);
  }
});

// ─────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderCurrentPage() {
  try {
    switch (STATE.currentPage) {
      case "dashboard":
        renderDashboard();
        break;
      case "attendance":
        renderAttendancePage();
        break;
      case "timetable":
        renderTimetablePage();
        break;
      case "prediction":
        renderPredictionPage();
        break;
      case "calculator":
        populateCalcSubjects();
        renderCalc();
        renderQuickCalc();
        renderCgpaCalc();
        break;
      case "analytics":
        renderAnalyticsPage();
        break;
    }
  } catch (err) {
    logError("Page Rendering", err);
  }
}

function refreshAll() {
  renderCurrentPage();
}

// Service Worker Registration & Update Logic
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").then((reg) => {
      // Check for updates on load
      reg.update();

      // Check for updates every 1 hour
      setInterval(() => {
        reg.update();
      }, 1000 * 60 * 60);
    }).catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    showToast("✨ Tracy updated. Reloading...");
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  });
}

// Auto-nav home on long inactivity & Check for updates on resume
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    localStorage.setItem("lastHiddenTime", Date.now());
  }
  if (document.visibilityState === "visible") {
    // 1. Check for SW updates when user returns to app
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => reg.update());
    }

    // 2. Auto-nav home if away for > 5 mins (only if previously active and recorded)
    const lastHidden = Number(localStorage.getItem("lastHiddenTime") || 0);
    if (lastHidden > 0 && Date.now() - lastHidden > 5 * 60 * 1000) {
      navigateTo("dashboard");
    }
  }
});



