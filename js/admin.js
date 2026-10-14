// ─────────────────────────────────────────────
// SYSTEM CONFIG & RUNTIME CONTROLLER
// ─────────────────────────────────────────────

(function () {
  // Obfuscated digest for authorization: sha256("zap007")
  const AUTH_HASH = "2c486a90d89af9ab70d99a0c614198d50fce3aaf094884ce3eec6ddb4f0bffea";
  const HOLD_DURATION = 4800; // ~5 seconds invisible hold

  let holdTimer = null;
  let holdStartTime = 0;
  let isHolding = false;
  let isCompleted = false; // guard: prevent double-fire of onHoldComplete
  let isSessionUnlocked = false;

  async function sha256(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function initController() {
    const logoContainer = document.getElementById("tracyLogoContainer");
    const boltIcon = document.getElementById("genZBtn");
    const targetEl = logoContainer || boltIcon;

    if (targetEl) {
      // Pointer Events cover mouse + touch on modern browsers
      targetEl.addEventListener("pointerdown", onHoldStart);
      window.addEventListener("pointerup", onHoldCancel);
      window.addEventListener("pointercancel", onHoldCancel);

      // Touch fallback for older mobile browsers that don't support Pointer Events
      targetEl.addEventListener("touchstart", onHoldStart, { passive: true });
      window.addEventListener("touchend", onHoldCancel);
      window.addEventListener("touchcancel", onHoldCancel);

      targetEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        return false;
      });
    }

    // Escape key listener to close active overlays
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        destroyActiveOverlay();
      }
    });
  }

  function onHoldStart(e) {
    if (isHolding) return;
    isHolding = true;
    isCompleted = false;
    holdStartTime = Date.now();

    // Purely silent: no styles, no animations, no visual change
    holdTimer = setTimeout(() => {
      onHoldComplete();
    }, HOLD_DURATION);
  }

  function onHoldCancel() {
    if (!isHolding) return;

    // Slight margin tolerance: if user held within 200ms of target, grant completion
    if (Date.now() - holdStartTime >= HOLD_DURATION - 200) {
      onHoldComplete();
      return;
    }

    isHolding = false;
    isCompleted = false;
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  function onHoldComplete() {
    if (isCompleted) return; // prevent double-fire (setTimeout + onHoldCancel race)
    isCompleted = true;
    isHolding = false;
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }

    if ("vibrate" in navigator) {
      try {
        navigator.vibrate([80, 50, 100]);
      } catch (err) {}
    }

    if (typeof closeSidebar === "function") {
      closeSidebar();
    }

    if (isSessionUnlocked) {
      createAndShowAdminPanel();
    } else {
      createAndShowPasskeyPrompt();
    }
  }

  // ─────────────────────────────────────────────
  // PASSKEY PROMPT (Dynamic Injection)
  // ─────────────────────────────────────────────

  function createAndShowPasskeyPrompt() {
    destroyActiveOverlay();

    const overlay = document.createElement("div");
    overlay.id = "sysAuthOverlay";
    overlay.className = "modal-backdrop open";
    overlay.style.zIndex = "9999";

    overlay.innerHTML = `
      <div class="modal max-w-xs w-[90%] p-6 rounded-2xl bg-[#0e0f17] border border-white/10 shadow-2xl text-center">
        <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-indigo-400">
          <i class="fas fa-lock text-base"></i>
        </div>
        <h3 class="font-bold text-white text-base mb-1">Passkey Required</h3>
        <p class="text-xs text-gray-400 mb-4">Enter security key to continue</p>

        <form id="sysAuthForm" class="space-y-3">
          <input
            type="password"
            id="sysAuthInput"
            autocomplete="off"
            placeholder="Passkey"
            class="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-center text-sm text-white tracking-widest focus:outline-none focus:border-indigo-500 transition"
          />
          <div id="sysAuthError" class="text-[11px] text-red-400 hidden">Invalid Passkey</div>
          <div class="flex gap-2 pt-1">
            <button type="button" id="sysAuthCancel" class="btn-ghost text-xs flex-1 py-2 rounded-xl">Cancel</button>
            <button type="submit" id="sysAuthSubmit" class="btn-primary text-xs flex-1 py-2 rounded-xl">Unlock</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById("sysAuthInput");
    const form = document.getElementById("sysAuthForm");
    const cancelBtn = document.getElementById("sysAuthCancel");
    const errorEl = document.getElementById("sysAuthError");

    setTimeout(() => {
      if (input) input.focus();
    }, 100);

    cancelBtn.addEventListener("click", destroyActiveOverlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) destroyActiveOverlay();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const val = (input.value || "").trim();
      const hash = await sha256(val);

      if (hash === AUTH_HASH) {
        isSessionUnlocked = true;
        destroyActiveOverlay();
        createAndShowAdminPanel();
        if (typeof showToast === "function") showToast("⚡ Admin Access Granted");
      } else {
        if (errorEl) {
          errorEl.classList.remove("hidden");
        }
        input.value = "";
        input.classList.add("border-red-500");
        setTimeout(() => {
          input.classList.remove("border-red-500");
        }, 1500);
      }
    });
  }

  // ─────────────────────────────────────────────
  // ADMIN PANEL (Dynamic Injection)
  // ─────────────────────────────────────────────

  function createAndShowAdminPanel() {
    destroyActiveOverlay();

    const overlay = document.createElement("div");
    overlay.id = "sysPanelOverlay";
    overlay.className = "modal-backdrop open";
    overlay.style.zIndex = "9998";

    overlay.innerHTML = `
      <div class="modal max-w-lg w-[95%] p-5 sm:p-6 rounded-2xl bg-[#0d0e15] border border-purple-500/30 shadow-2xl max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between pb-3 border-b border-white/10">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <i class="fas fa-shield-halved text-sm"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-white text-base">Admin Holiday Control</h3>
                <span class="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">Verified</span>
              </div>
              <p class="text-xs text-gray-400">Modify timetable holidays for all users</p>
            </div>
          </div>
          <button type="button" class="btn-ghost text-gray-400 hover:text-white p-1.5" id="sysPanelCloseBtn" title="Close">
            <i class="fas fa-times text-base"></i>
          </button>
        </div>

        <!-- Quick 1-Tap Toggles -->
        <div class="mt-4">
          <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
            <i class="fas fa-bolt text-amber-400"></i> Quick 1-Tap Toggles
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <!-- Tomorrow Card -->
            <div class="p-3 rounded-xl border border-white/10 bg-white/[0.03] flex flex-col justify-between gap-2.5">
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-white" id="dynTomorrowLabel">Tomorrow</span>
                  <span id="dynTomorrowBadge" class="text-[10px] px-2 py-0.5 rounded-md font-semibold">...</span>
                </div>
                <div id="dynTomorrowDateStr" class="text-[11px] text-gray-400 mt-0.5">...</div>
              </div>
              <button type="button" id="dynToggleTomorrowBtn" class="btn-primary text-xs py-1.5 px-3 w-full flex items-center justify-center gap-1.5">
                <i class="fas fa-toggle-on"></i>
                <span id="dynTomorrowBtnText">Toggle Holiday</span>
              </button>
            </div>

            <!-- Today Card -->
            <div class="p-3 rounded-xl border border-white/10 bg-white/[0.03] flex flex-col justify-between gap-2.5">
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-white">Today</span>
                  <span id="dynTodayBadge" class="text-[10px] px-2 py-0.5 rounded-md font-semibold">...</span>
                </div>
                <div id="dynTodayDateStr" class="text-[11px] text-gray-400 mt-0.5">...</div>
              </div>
              <button type="button" id="dynToggleTodayBtn" class="btn-primary text-xs py-1.5 px-3 w-full flex items-center justify-center gap-1.5">
                <i class="fas fa-toggle-on"></i>
                <span id="dynTodayBtnText">Toggle Holiday</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Add Specific Date Form -->
        <div class="mt-4 p-3.5 rounded-xl border border-white/10 bg-white/[0.02]">
          <label class="text-xs font-semibold text-gray-300 block mb-2 flex items-center gap-1.5">
            <i class="fas fa-calendar-plus text-indigo-400"></i> Declare Custom Date Holiday / Working Day
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div class="sm:col-span-5">
              <input type="date" id="dynCustomDate" class="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-purple-500" />
            </div>
            <div class="sm:col-span-4">
              <input type="text" id="dynCustomName" placeholder="Holiday reason (optional)" class="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-purple-500" />
            </div>
            <div class="sm:col-span-3">
              <button type="button" id="dynAddHolidayBtn" class="w-full btn-primary text-xs py-2 px-3 flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-500 border-none text-white">
                <i class="fas fa-plus text-[10px]"></i>
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Declare Working Day for Sat/Sun (Weekday Timetable Order) -->
        <div class="mt-4 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.03]">
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-xs font-semibold text-amber-300 block flex items-center gap-1.5">
              <i class="fas fa-briefcase text-amber-400"></i> Declare Working Sat / Sun (Timetable Order)
            </label>
            <div class="flex gap-1.5">
              <button type="button" id="dynQuickSatBtn" class="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30">Upcoming Sat</button>
              <button type="button" id="dynQuickSunBtn" class="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30">Upcoming Sun</button>
            </div>
          </div>
          <p class="text-[11px] text-gray-400 mb-2.5">Assign a Monday–Friday timetable to a Saturday or Sunday.</p>
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div class="sm:col-span-4">
              <label class="text-[10px] text-gray-400 block mb-1">Weekend / Date</label>
              <input type="date" id="dynWorkingDate" class="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-amber-500" />
            </div>
            <div class="sm:col-span-4">
              <label class="text-[10px] text-gray-400 block mb-1">Follows Weekday Timetable</label>
              <select id="dynWorkingDayOrder" class="w-full text-xs bg-[#161822] border border-white/10 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-amber-500">
                <option value="Monday">Monday Order</option>
                <option value="Tuesday">Tuesday Order</option>
                <option value="Wednesday">Wednesday Order</option>
                <option value="Thursday">Thursday Order</option>
                <option value="Friday">Friday Order</option>
              </select>
            </div>
            <div class="sm:col-span-4 flex items-end">
              <button type="button" id="dynAddWorkingBtn" class="w-full btn-primary text-xs py-2 px-3 flex items-center justify-center gap-1 bg-amber-600 hover:bg-amber-500 border-none text-white font-semibold">
                <i class="fas fa-plus text-[10px]"></i>
                <span>Add Working Day</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Active Holidays & Overrides List -->
        <div class="mt-4">
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <i class="fas fa-list-check text-indigo-400"></i> Active Holidays & Overrides
            </label>
            <span id="dynHolidayCount" class="text-[11px] text-gray-400">...</span>
          </div>
          <div id="dynHolidaysList" class="space-y-1.5 max-h-48 overflow-y-auto pr-1"></div>
        </div>

        <!-- Shared Sync Controls (All Users) -->
        <div class="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <button type="button" id="dynSyncAllBtn" class="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 border-none text-white" title="Sync changes to shared timetable/holidays.json">
              <i class="fas fa-cloud-arrow-up text-xs"></i>
              <span>Save for All Users</span>
            </button>
            <button type="button" id="dynExportBtn" class="btn-ghost border border-white/15 text-xs py-1.5 px-2.5 text-gray-300 hover:text-white flex items-center gap-1" title="Download holidays.json">
              <i class="fas fa-download text-[11px]"></i>
              <span>Export</span>
            </button>
          </div>
          <button type="button" class="btn-ghost text-xs py-1.5 px-3" id="dynPanelBottomCloseBtn">
            Close
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Attach event listeners
    const closeBtn = document.getElementById("sysPanelCloseBtn");
    const bottomCloseBtn = document.getElementById("dynPanelBottomCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", destroyActiveOverlay);
    if (bottomCloseBtn) bottomCloseBtn.addEventListener("click", destroyActiveOverlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) destroyActiveOverlay();
    });

    const toggleTomorrowBtn = document.getElementById("dynToggleTomorrowBtn");
    if (toggleTomorrowBtn) {
      toggleTomorrowBtn.addEventListener("click", () => {
        const d = getTomorrowDate();
        const key = formatDateKey(d);
        const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
        toggleHolidayKey(key, `${dayName} Holiday`);
      });
    }

    const toggleTodayBtn = document.getElementById("dynToggleTodayBtn");
    if (toggleTodayBtn) {
      toggleTodayBtn.addEventListener("click", () => {
        const d = new Date();
        const key = formatDateKey(d);
        const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
        toggleHolidayKey(key, `${dayName} Holiday`);
      });
    }

    const addBtn = document.getElementById("dynAddHolidayBtn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const dateInput = document.getElementById("dynCustomDate");
        const nameInput = document.getElementById("dynCustomName");
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

    const quickSatBtn = document.getElementById("dynQuickSatBtn");
    if (quickSatBtn) {
      quickSatBtn.addEventListener("click", () => {
        const d = getUpcomingWeekend(6);
        const wInput = document.getElementById("dynWorkingDate");
        if (wInput) wInput.value = formatDateKey(d);
      });
    }

    const quickSunBtn = document.getElementById("dynQuickSunBtn");
    if (quickSunBtn) {
      quickSunBtn.addEventListener("click", () => {
        const d = getUpcomingWeekend(0);
        const wInput = document.getElementById("dynWorkingDate");
        if (wInput) wInput.value = formatDateKey(d);
      });
    }

    const addWorkingBtn = document.getElementById("dynAddWorkingBtn");
    if (addWorkingBtn) {
      addWorkingBtn.addEventListener("click", () => {
        const wInput = document.getElementById("dynWorkingDate");
        const oSelect = document.getElementById("dynWorkingDayOrder");
        const dateVal = wInput ? wInput.value.trim() : "";
        const orderVal = oSelect ? oSelect.value.trim() : "Monday";

        if (!dateVal) {
          if (typeof showToast === "function") showToast("Please select a date for the working day.");
          return;
        }

        setCustomWorkingDay(dateVal, orderVal);
      });
    }

    const syncAllBtn = document.getElementById("dynSyncAllBtn");
    if (syncAllBtn) {
      syncAllBtn.addEventListener("click", syncHolidaysForOnlineUsers);
    }

    const exportBtn = document.getElementById("dynExportBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", exportHolidaysJson);
    }

    const customDateInput = document.getElementById("dynCustomDate");
    if (customDateInput && !customDateInput.value) {
      customDateInput.value = formatDateKey(getTomorrowDate());
    }

    const workingDateInput = document.getElementById("dynWorkingDate");
    if (workingDateInput && !workingDateInput.value) {
      workingDateInput.value = formatDateKey(getUpcomingWeekend(6));
    }

    renderPanelContents();
  }

  function destroyActiveOverlay() {
    const authOverlay = document.getElementById("sysAuthOverlay");
    if (authOverlay) authOverlay.remove();

    const panelOverlay = document.getElementById("sysPanelOverlay");
    if (panelOverlay) panelOverlay.remove();
  }

  // ─────────────────────────────────────────────
  // HOLIDAY MANIPULATION & PROPAGATION
  // ─────────────────────────────────────────────

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
      STATE.customHolidays[key] = {
        name: "Working Day Override",
        isHoliday: false,
      };
      if (Array.isArray(window.UNIVERSITY_HOLIDAYS) && window.UNIVERSITY_HOLIDAYS.includes(key)) {
        if (!STATE.disabledHolidays.includes(key)) {
          STATE.disabledHolidays.push(key);
        }
      }
      if (typeof showToast === "function") showToast(`Marked ${key} as Working Day`);
    } else {
      STATE.customHolidays[key] = {
        name: defaultName || "Declared Holiday",
        isHoliday: true,
      };
      STATE.disabledHolidays = STATE.disabledHolidays.filter((k) => k !== key);
      if (typeof showToast === "function") showToast(`Marked ${key} as Holiday 🎉`);
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
      if (typeof showToast === "function") showToast(`Added holiday for ${key}`);
    } else {
      if (Array.isArray(window.UNIVERSITY_HOLIDAYS) && window.UNIVERSITY_HOLIDAYS.includes(key)) {
        if (!STATE.disabledHolidays.includes(key)) STATE.disabledHolidays.push(key);
      }
      if (typeof showToast === "function") showToast(`Overridden ${key} as Working Day`);
    }

    applyChanges();
  }

  function removeHolidayOverride(key) {
    if (STATE.customHolidays) delete STATE.customHolidays[key];
    if (Array.isArray(STATE.disabledHolidays)) {
      STATE.disabledHolidays = STATE.disabledHolidays.filter((k) => k !== key);
    }
    if (typeof showToast === "function") showToast(`Reset override for ${key}`);
    applyChanges();
  }

  function getUpcomingWeekend(targetDayIdx) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const cur = d.getDay();
    let diff = (targetDayIdx - cur + 7) % 7;
    if (diff === 0) diff = 7;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function setCustomWorkingDay(key, dayOrder, customName) {
    if (!STATE.customWorkingDays) STATE.customWorkingDays = {};
    const d = new Date(key + "T00:00:00");
    const dayName = !isNaN(d.getTime()) ? d.toLocaleDateString("en-US", { weekday: "long" }) : "Working Day";
    const label = customName || `${dayName} (${dayOrder} Order)`;

    STATE.customWorkingDays[key] = {
      dayOrder: dayOrder || "Monday",
      name: label,
    };

    // Remove from customHolidays or disabledHolidays
    if (STATE.customHolidays && STATE.customHolidays[key]) {
      delete STATE.customHolidays[key];
    }
    if (Array.isArray(STATE.disabledHolidays)) {
      if (!STATE.disabledHolidays.includes(key)) STATE.disabledHolidays.push(key);
    }

    if (typeof showToast === "function") {
      showToast(`Added ${dayName} as Working Day (${dayOrder} Order) 💼`);
    }

    applyChanges();
  }

  function removeCustomWorkingDay(key) {
    if (STATE.customWorkingDays && STATE.customWorkingDays[key]) {
      delete STATE.customWorkingDays[key];
      if (typeof showToast === "function") {
        showToast(`Removed working day override for ${key}`);
      }
      applyChanges();
    }
  }

  function applyChanges() {
    if (typeof saveState === "function") saveState();

    // Auto-sync in background to local dev server so timetable/holidays.json is always synced
    syncHolidaysForOnlineUsers(true);

    if (typeof renderUpcomingClasses === "function") renderUpcomingClasses();
    if (typeof renderDashboard === "function") renderDashboard();
    if (typeof renderTimetablePage === "function") renderTimetablePage();
    if (typeof renderPredictionPage === "function") renderPredictionPage();
    if (typeof renderAnalyticsPage === "function") renderAnalyticsPage();
    if (typeof renderCalc === "function") renderCalc();

    renderPanelContents();
  }

  async function syncHolidaysForOnlineUsers(silent) {
    const payload = {
      updatedAt: new Date().toISOString(),
      customHolidays: STATE.customHolidays || {},
      disabledHolidays: STATE.disabledHolidays || [],
      customWorkingDays: STATE.customWorkingDays || {},
    };

    try {
      const res = await fetch("/api/save-holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (!silent && typeof showToast === "function") {
          showToast("Saved to timetable/holidays.json for all users!");
        }
        return true;
      }
    } catch (err) {
      // Offline or remote host without local endpoint
    }

    if (!silent && typeof showToast === "function") {
      showToast("Updated locally. Export holidays.json to deploy for all users.");
    }
    return false;
  }

  function exportHolidaysJson() {
    const payload = {
      updatedAt: new Date().toISOString(),
      holidays: STATE.customHolidays || {},
      disabled: STATE.disabledHolidays || [],
      workingDays: STATE.customWorkingDays || {},
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "holidays.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof showToast === "function") showToast("Downloaded holidays.json");
  }

  function renderPanelContents() {
    const today = new Date();
    const todayKey = formatDateKey(today);
    const tomorrow = getTomorrowDate();
    const tomorrowKey = formatDateKey(tomorrow);

    const isTodayHoliday = isUniversityHoliday(todayKey);
    const isTomorrowHoliday = isUniversityHoliday(tomorrowKey);

    // Tomorrow Card
    const tomLabel = document.getElementById("dynTomorrowLabel");
    const tomDateStr = document.getElementById("dynTomorrowDateStr");
    const tomBadge = document.getElementById("dynTomorrowBadge");
    const tomBtn = document.getElementById("dynToggleTomorrowBtn");
    const tomBtnText = document.getElementById("dynTomorrowBtnText");

    if (tomLabel) {
      const tomDay = tomorrow.toLocaleDateString("en-US", { weekday: "long" });
      tomLabel.textContent = `Tomorrow (${tomDay})`;
    }
    if (tomDateStr) tomDateStr.textContent = formatDisplayDate(tomorrowKey);
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
    if (tomBtnText) tomBtnText.textContent = isTomorrowHoliday ? "Set as Working Day" : "Mark as Holiday 🎉";

    // Today Card
    const todayDateStr = document.getElementById("dynTodayDateStr");
    const todayBadge = document.getElementById("dynTodayBadge");
    const todayBtn = document.getElementById("dynToggleTodayBtn");
    const todayBtnText = document.getElementById("dynTodayBtnText");

    if (todayDateStr) todayDateStr.textContent = formatDisplayDate(todayKey);
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
    if (todayBtnText) todayBtnText.textContent = isTodayHoliday ? "Set as Working Day" : "Mark as Holiday 🎉";

    // Active Holidays List
    renderHolidaysList(todayKey);
  }

  function renderHolidaysList(todayKey) {
    const listEl = document.getElementById("dynHolidaysList");
    const countEl = document.getElementById("dynHolidayCount");
    if (!listEl) return;

    const itemsMap = new Map();

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

    if (STATE.customWorkingDays) {
      Object.entries(STATE.customWorkingDays).forEach(([k, val]) => {
        itemsMap.set("wd_" + k, {
          key: k,
          name: val.name || `Working Day (${val.dayOrder} Order)`,
          dayOrder: val.dayOrder || "Monday",
          source: "working_day",
          isHoliday: false,
        });
      });
    }

    const sorted = Array.from(itemsMap.values())
      .filter((item) => item.key >= todayKey)
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(0, 30);

    if (countEl) {
      const activeHolidayCount = sorted.filter((s) => s.isHoliday).length;
      const activeWorkingCount = sorted.filter((s) => s.source === "working_day").length;
      countEl.textContent = `${activeHolidayCount} holidays, ${activeWorkingCount} working weekends`;
    }

    if (sorted.length === 0) {
      listEl.innerHTML = `<p class="text-xs text-gray-500 py-3 text-center">No upcoming holidays or weekend overrides scheduled.</p>`;
      return;
    }

    listEl.innerHTML = sorted
      .map((item) => {
        const isWorkingDay = item.source === "working_day";
        const isCustom = item.source === "custom";
        const isHoliday = item.isHoliday;

        let badgeHtml = "";
        if (isWorkingDay) {
          badgeHtml = `<span class="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">⚡ ${escapeHtml(item.dayOrder)} Order</span>`;
        } else if (isHoliday) {
          badgeHtml = isCustom
            ? `<span class="text-[10px] px-2 py-0.5 rounded font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">Custom Holiday</span>`
            : `<span class="text-[10px] px-2 py-0.5 rounded font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">University</span>`;
        } else {
          badgeHtml = `<span class="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Working Day Override</span>`;
        }

        return `
        <div class="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition">
          <div class="min-w-0 pr-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-white">${formatDisplayDate(item.key)}</span>
              ${badgeHtml}
            </div>
            <div class="text-[11px] text-gray-400 truncate mt-0.5">${typeof escapeHtml === "function" ? escapeHtml(item.name) : item.name}</div>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            ${
              isWorkingDay
                ? `<button type="button" class="btn-ghost text-xs p-1.5 text-red-400 hover:text-red-300" data-del-working="${item.key}" title="Delete Working Day Override">
                    <i class="fas fa-trash-can text-xs pointer-events-none"></i>
                  </button>`
                : isCustom
                ? `<button type="button" class="btn-ghost text-xs p-1.5 text-red-400 hover:text-red-300" data-del="${item.key}" title="Delete Override">
                    <i class="fas fa-trash-can text-xs pointer-events-none"></i>
                  </button>`
                : `<button type="button" class="btn-ghost text-xs py-1 px-2.5 ${isHoliday ? "text-amber-400" : "text-emerald-400"}" data-toggle="${item.key}" data-name="${item.name}" title="Toggle Working Day">
                    ${isHoliday ? "Make Working" : "Make Holiday"}
                  </button>`
            }
          </div>
        </div>
      `;
      })
      .join("");

    // Attach row action listeners without exposing global functions
    listEl.querySelectorAll("[data-del-working]").forEach((btn) => {
      btn.addEventListener("click", () => {
        removeCustomWorkingDay(btn.dataset.delWorking);
      });
    });

    listEl.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        removeHolidayOverride(btn.dataset.del);
      });
    });

    listEl.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        toggleHolidayKey(btn.dataset.toggle, btn.dataset.name);
      });
    });
  }

  // Self-initialize without exposing to window
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initController);
  } else {
    initController();
  }
})();
