let ttFileChosen = null;
let previewWeekNum = 1;
let dailyOverallMap = {};

function buildTimetableRows(sheet) {
  const raw = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  });

  const rows = [];

  // Skip header row
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];

    const dayRaw = String(row[0] || "").trim();
    if (!dayRaw) continue;

    const hours = row.slice(1).map((v) => String(v || "").trim());

    const isHoliday = hours.some((v) => v.toLowerCase().includes("holiday"));

    rows.push({
      day: dayRaw,
      hours,
      isHoliday,
    });
  }

  return rows;
}

async function loadBuiltInTimetables() {
  const manual = STATE.timetables.filter((t) => t.source !== "builtin");

  STATE.timetables = manual;
  TIMETABLES_LOADED = true;

  buildTimetableDropdown();
  renderTimetableList();
  renderTimetablePreview();

  const activeIds = [STATE.week1TimetableId, STATE.week2TimetableId].filter(
    Boolean,
  );

  for (const id of activeIds) {
    if (TIMETABLE_FILES.includes(id)) {
      await loadBuiltInTimetable(id);
    }
  }

  renderTimetablePage();
  refreshAll();
}

async function loadBuiltInTimetable(fileName) {
  if (!TIMETABLE_FILES.includes(fileName)) {
    logError("Built-in Timetable", `Unknown file: ${fileName}`);
    return null;
  }

  const existing = STATE.timetables.find(
    (t) => t.id === fileName && t.source === "builtin",
  );

  if (existing) return existing;

  if (timetableLoadPromises.has(fileName)) {
    return timetableLoadPromises.get(fileName);
  }

  const promise = (async () => {
    try {
      const response = await fetch(`timetable/${fileName}.xlsx`, {
        cache: "default",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = await response.arrayBuffer();

      const wb = XLSX.read(buffer, {
        type: "array",
      });

      const sheet = wb.Sheets[wb.SheetNames[0]];

      if (!sheet) {
        throw new Error("No worksheet found");
      }

      const rows = buildTimetableRows(sheet);

      if (!rows.length) {
        throw new Error("Timetable has no rows");
      }

      const timetable = {
        id: fileName,
        label: fileName,
        rows,
        source: "builtin",
      };

      STATE.timetables.push(timetable);

      saveState();
      renderTimetableList();

      return timetable;
    } catch (err) {
      logError("Timetable Load", { file: fileName, error: err.message });

      showToast(`Unable to load ${fileName} timetable.`);

      return null;
    } finally {
      timetableLoadPromises.delete(fileName);
    }
  })();

  timetableLoadPromises.set(fileName, promise);

  return promise;
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
    const rows = buildTimetableRows(sheet);

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

  renderTimetablePreview();
  renderPredictionPage();

  // Refresh prediction week selector state
  const week = document.getElementById("predCardsWeekSelect");
  if (week) {
    week.dispatchEvent(new Event("change"));
  }
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
  buildTimetableDropdown();
  renderTimetablePreview();
}

function renderTimetableList() {
  const el = document.getElementById("ttList");

  if (!el) return;

  const manual = STATE.timetables.filter((t) => t.source !== "builtin");

  const loadedBuiltinIds = new Set(
    STATE.timetables.filter((t) => t.source === "builtin").map((t) => t.id),
  );

  const totalLoaded = loadedBuiltinIds.size + manual.length;

  if (!totalLoaded) {
    el.innerHTML = "";
    const p = document.createElement("p");
    p.className = "text-xs text-gray-500";
    p.textContent = "No timetables loaded yet.";
    el.appendChild(p);
    return;
  }

  const loadedBuiltins = TIMETABLE_FILES.filter((id) =>
    loadedBuiltinIds.has(id),
  )
    .map((id) => STATE.timetables.find((t) => t.id === id))
    .filter(Boolean);

  const all = [...loadedBuiltins, ...manual];

  el.innerHTML = "";
  all
    .sort((a, b) => a.label.localeCompare(b.label))
    .forEach((t) => {
      const row = document.createElement("div");
      row.className =
        "flex items-center justify-between py-2 border-b border-white/5";

      const left = document.createElement("div");
      const nameP = document.createElement("p");
      nameP.className = "text-sm font-medium";
      nameP.textContent = t.label + " ";

      const sourceSpan = document.createElement("span");
      sourceSpan.className = `text-xs font-normal ${
        t.source === "builtin" ? "text-indigo-400" : "text-gray-500"
      }`;
      sourceSpan.textContent = `(${
        t.source === "builtin" ? "built-in" : "uploaded"
      })`;
      nameP.appendChild(sourceSpan);
      left.appendChild(nameP);

      const infoP = document.createElement("p");
      infoP.className = "text-xs text-gray-500";
      infoP.textContent = `${t.rows.length} day rows`;
      left.appendChild(infoP);
      row.appendChild(left);

      if (t.source !== "builtin") {
        const btn = document.createElement("button");
        btn.className = "btn-danger text-xs";
        btn.style.padding = "4px 8px";
        btn.onclick = () => deleteTimetable(t.id);
        const i = document.createElement("i");
        i.className = "fas fa-trash";
        btn.appendChild(i);
        row.appendChild(btn);
      }
      el.appendChild(row);
    });
}

let deferredPrompt = null;

const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();

  deferredPrompt = e;

  const installBtn = document.getElementById("installBtn");

  if (installBtn && !isStandalone) {
    installBtn.classList.remove("hidden");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const installBtn = document.getElementById("installBtn");

  if (!installBtn || isStandalone) return;

  // Show button on iOS immediately since it doesn't support beforeinstallprompt
  if (isIOS) {
    installBtn.classList.remove("hidden");
  }

  installBtn.addEventListener("click", async () => {
    // iOS
    if (isIOS) {
      alert(
        "To install Tracy:\n\n" +
          "1. Tap the Share button in Safari.\n" +
          "2. Tap 'Add to Home Screen'.\n" +
          "3. Tap 'Add'.",
      );
      return;
    }

    // Android / supported browsers
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    await deferredPrompt.userChoice;

    deferredPrompt = null;

    installBtn.classList.add("hidden");
  });
});

function renderTimetablePreview() {
  const el = document.getElementById("ttPreviewGrid");
  if (!el) return;
  const id = STATE.week1TimetableId;
  const tt = getTimetableById(id);

  if (!tt) {
    el.innerHTML = "";
    const p = document.createElement("p");
    p.className = "text-center text-gray-500 text-sm py-8";
    p.textContent = "Select a timetable to preview.";
    el.appendChild(p);
    return;
  }

  const maxHours = Math.max(...tt.rows.map((r) => r.hours.length));

  const table = document.createElement("table");
  table.className = "tt-table w-full";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const thDay = document.createElement("th");
  thDay.textContent = "Day";
  headerRow.appendChild(thDay);

  for (let h = 1; h <= maxHours; h++) {
    const th = document.createElement("th");
    th.textContent = `Hour ${h}`;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  tt.rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = "tt-row";

    const tdDay = document.createElement("td");
    tdDay.className = "font-medium text-gray-300";
    tdDay.textContent = row.day;
    tr.appendChild(tdDay);

    const universityHoliday =
      typeof isUniversityHoliday === "function" &&
      typeof getDateForTimetableDay === "function"
        ? isUniversityHoliday(
            getDateForTimetableDay(row.day, previewWeekNum - 1),
          )
        : false;

    if (row.isHoliday || universityHoliday) {
      const tdHoliday = document.createElement("td");
      tdHoliday.colSpan = maxHours;
      tdHoliday.className = "text-center text-yellow-400 font-semibold";
      tdHoliday.textContent = "Holiday";
      tr.appendChild(tdHoliday);
    } else {
      for (let h = 0; h < maxHours; h++) {
        const v = row.hours[h] || "";
        const td = document.createElement("td");
        if (v.toLowerCase().includes("holiday")) {
          td.className = "opacity-40 line-through";
        }
        td.textContent = v;
        tr.appendChild(td);
      }
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  el.innerHTML = "";
  el.appendChild(table);
}

function renderInlineAdSlider() {
  const el = document.getElementById("inlineAdsSlides");
  if (!el || !adsList.length) return;

  const ad = adsList[adsCurrentSlide];
  if (ad && ad.title) {
    new Image().src =
      CAMPUS_API + "?action=view&title=" + encodeURIComponent(ad.title);
  }

  el.innerHTML = "";
  if (ad) {
    const a = document.createElement("a");
    a.href =
      typeof validateUrl === "function" && validateUrl(ad.link)
        ? ad.link
        : "#";
    a.target = "_blank";
    a.onclick = () => trackAdClick(ad.title);

    const img = document.createElement("img");
    img.src =
      typeof validateUrl === "function" && validateUrl(ad.poster)
        ? ad.poster
        : "";
    img.style.width = "100%";

    a.appendChild(img);
    el.appendChild(a);
  }
}
// ─────────────────────────────────────────────
