// 3. NAVIGATION & EVENT LISTENERS
// ─────────────────────────────────────────────
function navigateTo(page) {
  if (
    !guideMode &&
    (page === "prediction" || page === "analytics") &&
    (!STATE.subjects || STATE.subjects.length === 0)
  ) {
    document.getElementById("confirmTitle").innerHTML =
      '<i class="fas fa-file-excel text-yellow-400 mr-2"></i>Upload Required';

    document.getElementById("confirmMsg").innerHTML =
      "Please upload your attendance report from the Dashboard before using this feature.";

    document.getElementById("confirmOk").className = "btn-primary";
    document.getElementById("confirmOk").textContent = "Go to Dashboard";

    document.getElementById("confirmOk").onclick = () => {
      closeConfirm();
      navigateTo("dashboard");
    };

    document.getElementById("confirmModal").classList.add("open");
    return;
  }

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

  const navItem = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (navItem) navItem.classList.add("active");

  const mobileItem = document.querySelector(`.mobile-nav-item[data-page="${page}"]`);
  if (mobileItem) mobileItem.classList.add("active");

  if (
    page === "prediction" &&
    !STATE.week1TimetableId &&
    !STATE.week2TimetableId
  ) {
    showToast("Select a timetable first to access predictions.");
    navigateTo("timetable");
    return;
  }

  STATE.currentPage = page;
  saveState();
  closeSidebar();

  renderCurrentPage();
  if (page === "campus") {
    loadCampusPosts();
  }
}

function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("mobileOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("mobileOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

function setupGlobalEventListeners() {
  // Mobile Overlay
  const overlay = document.getElementById("mobileOverlay");
  if (overlay) {
    overlay.addEventListener("click", closeSidebar);
  }

  // Theme Toggle
  const themeBtn = document.getElementById("themeToggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", toggleTheme);
  }

  // Gen Z Mode
  const genZBtn = document.getElementById("genZBtn");
  if (genZBtn) {
    genZBtn.addEventListener("dblclick", toggleGenZMode);
  }

  // Unified Event Delegation
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action], [data-page], [data-t]");
    if (!target) return;

    // Handle Page Navigation
    if (target.dataset.page) {
      e.preventDefault();
      navigateTo(target.dataset.page);
      return;
    }

    // Handle Target Attendance Change
    if (target.dataset.t) {
      setTarget(parseInt(target.dataset.t));
      return;
    }

    // Handle Actions
    const action = target.dataset.action;
    if (action) {
      // Prevent bubbling for trigger-input if it's the actual input (unlikely but safe)
      if (action !== "trigger-input") e.preventDefault();

      switch (action) {
        case "open-sidebar":
          openSidebar();
          break;
        case "manage-data":
          openManageData();
          break;
        case "trigger-input":
          const inputId = target.dataset.target;
          if (inputId) document.getElementById(inputId).click();
          break;
        case "help":
          e.stopPropagation();
          const modalId = target.dataset.target;
          if (modalId) openHelpModal(modalId);
          break;
        case "toggle-dropdown":
          const ddId = target.dataset.target;
          if (ddId) toggleDropdown(ddId);
          break;
        case "reset-quick-calc":
          resetQuickCalc();
          break;
        case "calc-total-minus":
          changeFutureTotal(-1);
          break;
        case "calc-total-plus":
          changeFutureTotal(1);
          break;
        case "calc-minus":
          changeFutureAttend(-1);
          break;
        case "calc-plus":
          changeFutureAttend(1);
          break;
        case "reset-calc":
          resetCalc();
          break;
        case "reset-cgpa-calc":
          resetCgpaCalc();
          break;
        case "add-calendar":
          addAllPredCardsToCalendar();
          break;
        case "toggle-daily-dropdown":
          toggleDailyDropdown();
          break;
        case "skip-guide":
          skipGuide();
          break;
        case "next-guide":
          nextGuide();
          break;
        case "start-guide":
          startGuide();
          break;
      }
    }
  });

  // Modal Close Buttons (Standard)
  document.querySelectorAll(".modal .btn-ghost").forEach(btn => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal-backdrop");
      if (modal) modal.classList.remove("open");
    });
  });

  const adsCloseBtn = document.getElementById("adsCloseBtn");
  if (adsCloseBtn) {
    adsCloseBtn.addEventListener("click", closeAdsPopup);
  }
}
