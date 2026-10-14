// ─────────────────────────────────────────────
// ADMIN CONTROL PANEL (Secret 5s hold on thunder logo)
// ─────────────────────────────────────────────

(function () {
  const HOLD_DURATION = 4800; // ~5 seconds with generous completion margin
  let holdTimer = null;
  let holdStartTime = 0;
  let isHolding = false;

  function initAdmin() {
    const logoContainer = document.getElementById("tracyLogoContainer");
    const thunderBtn = document.getElementById("genZBtn");
    const triggerEl = logoContainer || thunderBtn;

    if (triggerEl) {
      // Modern pointer events
      triggerEl.addEventListener("pointerdown", (e) => {
        try {
          if (triggerEl.setPointerCapture && e.pointerId) {
            triggerEl.setPointerCapture(e.pointerId);
          }
        } catch (err) {}
        startAdminHold(e);
      });
      window.addEventListener("pointerup", cancelAdminHold);
      window.addEventListener("pointercancel", cancelAdminHold);

      // Desktop mouse events fallback
      triggerEl.addEventListener("mousedown", startAdminHold);
      window.addEventListener("mouseup", cancelAdminHold);

      // Mobile touch events fallback
      triggerEl.addEventListener("touchstart", startAdminHold, { passive: true });
      window.addEventListener("touchend", cancelAdminHold);
      window.addEventListener("touchcancel", cancelAdminHold);

      // Prevent mobile long-press context menu
      triggerEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        return false;
      });
    }

    // Modal close buttons
    document.querySelectorAll("[data-action='close-admin-modal']").forEach((btn) => {
      btn.addEventListener("click", closeAdminModal);
    });

    const adminModal = document.getElementById("adminModal");
    if (adminModal) {
      adminModal.addEventListener("click", (e) => {
        if (e.target === adminModal) closeAdminModal();
      });
    }

    // Modal action buttons
    const toggleTomorrowBtn = document.getElementById("adminToggleTomorrowBtn");
    if (toggleTomorrowBtn) {
      toggleTomorrowBtn.addEventListener("click", () => {
        const d = getTomorrowDate();
        const key = formatDateKey(d);
        const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
        toggleHolidayKey(key, `${dayName} Holiday`);
      });
    }

    const toggleTodayBtn = document.getElementById("adminToggleTodayBtn");
    if (toggleTodayBtn) {
      toggleTodayBtn.addEventListener("click", () => {
        const d = new Date();
        const key = formatDateKey(d);
        const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
        toggleHolidayKey(key, `${dayName} Holiday`);
      });
    }

    const addBtn = document.getElementById("adminAddHolidayBtn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const dateInput = document.getElementById("adminCustomDate");
        const nameInput = document.getElementById("adminCustomName");
        const dateVal = dateInput ? dateInput.value.trim() : "";
        const nameVal = nameInput ? nameInput.value.trim() : "";

        if (!dateVal) {
          if (typeof showToast === "function") showToast("Please select a date.");
          return;
        }

        const d = new Date(dateVal + "T00:00:00");
        const dayName = !isNaN(d.getTime()) ? d.toLocaleDateString("en-US", { weekday: "long" }) : "";
        const finalName = nameVal || `${dayName || "Custom"} Holiday`;

        setCustomHoliday(dateVal, true, finalName);
        if (nameInput) nameInput.value = "";
      });
    }

    // Keyboard ESC to close admin
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const modal = document.getElementById("adminModal");
        if (modal && modal.classList.contains("open")) {
          closeAdminModal();
        }
      }
    });
  }

  function startAdminHold(e) {
    // If already holding, ignore
    if (isHolding) return;
    isHolding = true;
    holdStartTime = Date.now();

    const logoContainer = document.getElementById("tracyLogoContainer");
    const holdSvg = document.getElementById("adminHoldSvg");
    const holdProgress = document.getElementById("adminHoldProgress");

    if (logoContainer) {
      logoContainer.classList.add("admin-hold-active");
    }

    if (holdSvg && holdProgress) {
      holdSvg.classList.remove("opacity-0");
      holdSvg.classList.add("opacity-100");
      holdProgress.style.transition = `stroke-dashoffset ${HOLD_DURATION}ms linear`;
      // Force reflow
      void holdProgress.offsetWidth;
      holdProgress.style.strokeDashoffset = "0";
    }

    holdTimer = setTimeout(() => {
      completeAdminHold();
    }, HOLD_DURATION);
  }

  function resetHoldVisuals() {
    isHolding = false;
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }

    const logoContainer = document.getElementById("tracyLogoContainer");
    const holdSvg = document.getElementById("adminHoldSvg");
    const holdProgress = document.getElementById("adminHoldProgress");

    if (logoContainer) {
      logoContainer.classList.remove("admin-hold-active");
    }

    if (holdSvg && holdProgress) {
      holdProgress.style.transition = "none";
      holdProgress.style.strokeDashoffset = "94.25";
      holdSvg.classList.remove("opacity-100");
      holdSvg.classList.add("opacity-0");
    }
  }

  function cancelAdminHold() {
    if (!isHolding) return;

    // If held for almost full duration (within 200ms), treat as successful complete
    if (Date.now() - holdStartTime >= HOLD_DURATION - 200) {
      completeAdminHold();
      return;
    }

    resetHoldVisuals();
  }

  function completeAdminHold() {
    resetHoldVisuals();

    // Haptic feedback if supported
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate([100, 60, 120]);
      } catch (err) {}
    }

    // Close mobile sidebar if open
    if (typeof closeSidebar === "function") {
      closeSidebar();
    }

    openAdminModal();
    if (typeof showToast === "function") {
      showToast("⚡ Admin Control Panel Activated");
    }
  }

  function openAdminModal() {
    const modal = document.getElementById("adminModal");
    if (!modal) return;

    renderAdminModal();
    modal.classList.add("open");

    // Set default custom date to tomorrow
    const customDateInput = document.getElementById("adminCustomDate");
    if (customDateInput && !customDateInput.value) {
      customDateInput.value = formatDateKey(getTomorrowDate());
    }
  }

  function closeAdminModal() {
    const modal = document.getElementById("adminModal");
    if (modal) modal.classList.remove("open");
  }

  function getTomorrowDate() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatDateKey(d) {
    if (typeof d === "string") return d.slice(0, 10);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function formatDisplayDate(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function toggleHolidayKey(key, defaultName) {
    if (!STATE.customHolidays) STATE.customHolidays = {};
    if (!Array.isArray(STATE.disabledHolidays)) STATE.disabledHolidays = [];

    const currentlyHoliday = isUniversityHoliday(key);

    if (currentlyHoliday) {
      // Turn into a Working Day
      STATE.customHolidays[key] = {
        name: "Working Day Override",
        isHoliday: false,
      };
      if (Array.isArray(window.UNIVERSITY_HOLIDAYS) && window.UNIVERSITY_HOLIDAYS.includes(key)) {
        if (!STATE.disabledHolidays.includes(key)) {
          STATE.disabledHolidays.push(key);
        }
      }
      if (typeof showToast === "function") {
        showToast(`Marked ${key} as a Working Day.`);
      }
    } else {
      // Turn into a Holiday
      STATE.customHolidays[key] = {
        name: defaultName || "Declared Holiday",
        isHoliday: true,
      };
      // If was previously disabled from university list, re-enable
      STATE.disabledHolidays = STATE.disabledHolidays.filter((k) => k !== key);
      if (typeof showToast === "function") {
        showToast(`Marked ${key} as Holiday 🎉`);
      }
    }

    applyChanges();
  }

  function setCustomHoliday(key, isHoliday, name) {
    if (!STATE.customHolidays) STATE.customHolidays = {};
    if (!Array.isArray(STATE.disabledHolidays)) STATE.disabledHolidays = [];

    STATE.customHolidays[key] = {
      name: name || (isHoliday ? "Holiday" : "Working Day Override"),
      isHoliday: Boolean(isHoliday),
    };

    if (isHoliday) {
      STATE.disabledHolidays = STATE.disabledHolidays.filter((k) => k !== key);
      if (typeof showToast === "function") {
        showToast(`Added holiday for ${key}: ${name}`);
      }
    } else {
      if (Array.isArray(window.UNIVERSITY_HOLIDAYS) && window.UNIVERSITY_HOLIDAYS.includes(key)) {
        if (!STATE.disabledHolidays.includes(key)) STATE.disabledHolidays.push(key);
      }
      if (typeof showToast === "function") {
        showToast(`Overridden ${key} as Working Day`);
      }
    }

    applyChanges();
  }

  function removeHolidayOverride(key) {
    if (STATE.customHolidays) {
      delete STATE.customHolidays[key];
    }
    if (Array.isArray(STATE.disabledHolidays)) {
      STATE.disabledHolidays = STATE.disabledHolidays.filter((k) => k !== key);
    }
    if (typeof showToast === "function") {
      showToast(`Reset override for ${key}`);
    }

    applyChanges();
  }

  function applyChanges() {
    if (typeof saveState === "function") saveState();

    // Re-render everything affected
    if (typeof renderUpcomingClasses === "function") renderUpcomingClasses();
    if (typeof renderDashboard === "function") renderDashboard();
    if (typeof renderTimetablePage === "function") renderTimetablePage();
    if (typeof renderPredictionPage === "function") renderPredictionPage();
    if (typeof renderAnalyticsPage === "function") renderAnalyticsPage();
    if (typeof renderCalc === "function") renderCalc();

    renderAdminModal();
  }

  function renderAdminModal() {
    const today = new Date();
    const todayKey = formatDateKey(today);
    const tomorrow = getTomorrowDate();
    const tomorrowKey = formatDateKey(tomorrow);

    const isTodayHoliday = isUniversityHoliday(todayKey);
    const isTomorrowHoliday = isUniversityHoliday(tomorrowKey);

    // ── Tomorrow Section ──
    const tomLabel = document.getElementById("adminTomorrowLabel");
    const tomDateStr = document.getElementById("adminTomorrowDateStr");
    const tomBadge = document.getElementById("adminTomorrowBadge");
    const tomBtn = document.getElementById("adminToggleTomorrowBtn");
    const tomBtnText = document.getElementById("adminTomorrowBtnText");

    if (tomLabel) {
      const tomDay = tomorrow.toLocaleDateString("en-US", { weekday: "long" });
      tomLabel.textContent = `Tomorrow (${tomDay})`;
    }
    if (tomDateStr) {
      tomDateStr.textContent = formatDisplayDate(tomorrowKey);
    }
    if (tomBadge) {
      tomBadge.className = isTomorrowHoliday
        ? "text-[10px] px-2 py-0.5 rounded-md font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30"
        : "text-[10px] px-2 py-0.5 rounded-md font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
      tomBadge.textContent = isTomorrowHoliday ? "🏖️ Holiday" : "💼 Working Day";
    }
    if (tomBtn) {
      tomBtn.className = isTomorrowHoliday
        ? "btn-ghost border border-white/20 text-gray-300 hover:text-white text-xs py-1.5 px-3 w-full flex items-center justify-center gap-1.5"
        : "btn-primary text-xs py-1.5 px-3 w-full flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 border-none text-white";
    }
    if (tomBtnText) {
      tomBtnText.textContent = isTomorrowHoliday ? "Set as Working Day" : "Mark as Holiday 🎉";
    }

    // ── Today Section ──
    const todayDateStr = document.getElementById("adminTodayDateStr");
    const todayBadge = document.getElementById("adminTodayBadge");
    const todayBtn = document.getElementById("adminToggleTodayBtn");
    const todayBtnText = document.getElementById("adminTodayBtnText");

    if (todayDateStr) {
      todayDateStr.textContent = formatDisplayDate(todayKey);
    }
    if (todayBadge) {
      todayBadge.className = isTodayHoliday
        ? "text-[10px] px-2 py-0.5 rounded-md font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30"
        : "text-[10px] px-2 py-0.5 rounded-md font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
      todayBadge.textContent = isTodayHoliday ? "🏖️ Holiday" : "💼 Working Day";
    }
    if (todayBtn) {
      todayBtn.className = isTodayHoliday
        ? "btn-ghost border border-white/20 text-gray-300 hover:text-white text-xs py-1.5 px-3 w-full flex items-center justify-center gap-1.5"
        : "btn-primary text-xs py-1.5 px-3 w-full flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 border-none text-white";
    }
    if (todayBtnText) {
      todayBtnText.textContent = isTodayHoliday ? "Set as Working Day" : "Mark as Holiday 🎉";
    }

    // ── Active Holidays & Overrides List ──
    renderHolidaysList(todayKey);
  }

  function renderHolidaysList(todayKey) {
    const listEl = document.getElementById("adminHolidaysList");
    const countEl = document.getElementById("adminHolidayCount");
    if (!listEl) return;

    // Gather all upcoming holidays
    const itemsMap = new Map();

    // 1. Built-in holidays
    if (Array.isArray(window.UNIVERSITY_HOLIDAYS)) {
      window.UNIVERSITY_HOLIDAYS.forEach((k) => {
        const isDisabled = Array.isArray(STATE.disabledHolidays) && STATE.disabledHolidays.includes(k);
        itemsMap.set(k, {
          key: k,
          name: "University Calendar",
          source: "builtin",
          isHoliday: !isDisabled,
        });
      });
    }

    // 2. Custom entries
    if (STATE.customHolidays) {
      Object.entries(STATE.customHolidays).forEach(([k, val]) => {
        itemsMap.set(k, {
          key: k,
          name: val.name || "Custom Holiday",
          source: "custom",
          isHoliday: Boolean(val.isHoliday),
        });
      });
    }

    // Filter to future and recent (from today onwards, up to next 90 days)
    const sorted = Array.from(itemsMap.values())
      .filter((item) => item.key >= todayKey)
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(0, 20);

    if (countEl) {
      const activeCount = sorted.filter((s) => s.isHoliday).length;
      countEl.textContent = `${activeCount} upcoming`;
    }

    if (sorted.length === 0) {
      listEl.innerHTML = `<p class="text-xs text-gray-500 py-3 text-center">No upcoming holidays scheduled.</p>`;
      return;
    }

    listEl.innerHTML = sorted
      .map((item) => {
        const isCustom = item.source === "custom";
        const isHoliday = item.isHoliday;

        const badgeHtml = isHoliday
          ? isCustom
            ? `<span class="text-[10px] px-2 py-0.5 rounded font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">Custom Holiday</span>`
            : `<span class="text-[10px] px-2 py-0.5 rounded font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">University</span>`
          : `<span class="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Working Day Override</span>`;

        return `
        <div class="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition">
          <div class="min-w-0 pr-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-white">${formatDisplayDate(item.key)}</span>
              ${badgeHtml}
            </div>
            <div class="text-[11px] text-gray-400 truncate mt-0.5">${escapeHtml(item.name)}</div>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            ${
              isCustom
                ? `<button type="button" class="btn-ghost text-xs p-1.5 text-red-400 hover:text-red-300" onclick="window.AdminControl.remove('${item.key}')" title="Delete Override">
                    <i class="fas fa-trash-can text-xs"></i>
                  </button>`
                : `<button type="button" class="btn-ghost text-xs py-1 px-2.5 ${isHoliday ? 'text-amber-400' : 'text-emerald-400'}" onclick="window.AdminControl.toggle('${item.key}', '${escapeHtml(item.name)}')" title="Toggle Working Day">
                    ${isHoliday ? 'Make Working' : 'Make Holiday'}
                  </button>`
            }
          </div>
        </div>
      `;
      })
      .join("");
  }

  // Public API
  window.AdminControl = {
    open: openAdminModal,
    close: closeAdminModal,
    toggle: toggleHolidayKey,
    set: setCustomHoliday,
    remove: removeHolidayOverride,
    init: initAdmin,
  };

  // Initialize once DOM is loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdmin);
  } else {
    initAdmin();
  }
})();
