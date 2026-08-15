// 5. EXCEL IMPORT — ATTENDANCE REPORT
// ─────────────────────────────────────────────
function toggleDailyDropdown() {
  document.getElementById("dailyDropdownList").classList.toggle("show");
}

function populateDailySubjectSelect() {
  const list = document.getElementById("dailyDropdownList");
  list.innerHTML = "";

  const items = [];

  Object.keys(dailySubjectMap)
    .sort()
    .forEach((s) => {
      const displayText = s.replace(/\s*\([^)]+\)\s*$/, "");

      items.push({
        value: s,
        text: displayText,
      });
    });

  items.forEach((item) => {
    const div = document.createElement("div");

    div.className =
      "px-4 py-2 hover:bg-indigo-600 cursor-pointer whitespace-pre-line";

    div.textContent = item.text;

    div.onclick = () => {
      document.getElementById("dailyDropdownText").textContent =
        item.value.replace(/\s*\([^)]+\)\s*$/, "");

      document.getElementById("dailyDropdownList").classList.remove("show");
      updateDailyChartView(item.value);
    };

    list.appendChild(div);
  });
}

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

    // Save the actual upload date
    STATE.lastAttendanceReportDate = new Date().toISOString();
    saveState();

    // Extract subjects
    const subjects = [];

    XLSX.utils.sheet_to_json(sheet).forEach((row) => {
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
    STATE.subjects = subjects;
    saveState();

    refreshAll();
    checkAttendanceReportStatus();

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

