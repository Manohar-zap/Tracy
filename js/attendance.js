// 4. SUBJECTS CRUD & HELPERS
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
  const a = (s.attended || 0) + (s.dutyLeave || 0);
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

function getStatusText(type) {
  if (!genZMode) {
    return {
      safe: "Safe ✓",
      warning: "Warning",
      risk: "At Risk",
    }[type];
  }

  return {
    safe: "Goated",
    warning: "Sketchy",
    risk: "Cooked",
  }[type];
}

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
  const attended = parseInt(document.getElementById("newSubjectAttended").value, 10) || 0;
  const total = parseInt(document.getElementById("newSubjectTotal").value, 10) || 0;

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

  const isDuplicate = STATE.subjects.some(s => s.name.toLowerCase() === name.toLowerCase());
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
  const attended = parseInt(document.getElementById("editSubjectAttended").value, 10) || 0;
  const total = parseInt(document.getElementById("editSubjectTotal").value, 10) || 0;

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

  const dup = STATE.subjects.find(s => s.id !== id && s.name.toLowerCase() === name.toLowerCase());
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

function toggleDropdown(id) {
  const menu = document.querySelector(`#${id} .dropdown-menu`);
  if (!menu) return;
  document.querySelectorAll(".dropdown-menu").forEach((m) => {
    if (m !== menu) m.classList.remove("show");
  });
  menu.classList.toggle("show");
}

function closeDropdown(id) {
  const menu = document.querySelector(`#${id} .dropdown-menu`);
  if (menu) menu.classList.remove("show");
}

document.addEventListener("click", (e) => {
  document.querySelectorAll(".custom-dropdown").forEach((drop) => {
    if (!drop.contains(e.target)) {
      drop.querySelector(".dropdown-menu")?.classList.remove("show");
    }
  });
});

function buildSchoolDropdown() {
  const menu = document.getElementById("schoolDropdownMenu");
  if (!menu) return;
  menu.innerHTML = "";
  const schools = [
    "All Schools",
    "School of Engineering",
    "School of Computer Science & Engineering",
    "School of Information Science",
    "School of Commerce & Economics",
    "School of Law",
    "School of Design",
    "School of Media Studies",
    "School of Management",
    "School of Liberal Arts & Sciences",
    "School of Allied Health Sciences",
    "School of Artificial Intelligence & Advanced Computing",
  ];
  schools.forEach((name) => {
    const div = document.createElement("div");
    div.className = "dropdown-item";
    div.textContent = name;
    div.onclick = () => {
      document.getElementById("schoolDropdownText").textContent = name;
      window.selectedSchool = name === "All Schools" ? "all" : name;
      closeDropdown("schoolDropdown");
      filterCampusPosts();
    };
    menu.appendChild(div);
  });
}

function buildYearDropdown() {
  const menu = document.getElementById("yearDropdownMenu");
  if (!menu) return;
  menu.innerHTML = "";
  const years = ["All Years", "1st Year", "2nd Year", "3rd Year", "4th Year"];
  years.forEach((name) => {
    const div = document.createElement("div");
    div.className = "dropdown-item";
    div.textContent = name;
    div.onclick = () => {
      document.getElementById("yearDropdownText").textContent = name;
      window.selectedYear = name === "All Years" ? "all" : name;
      closeDropdown("yearDropdown");
      filterCampusPosts();
    };
    menu.appendChild(div);
  });
}

function buildTimetableDropdown() {
  const menu = document.getElementById("ttDropdownMenu");
  if (!menu) return;
  menu.innerHTML = "";

  const manual = STATE.timetables.filter((t) => t.source !== "builtin");
  const items = [
    ...TIMETABLE_FILES.map((id) => ({
      id,
      label: id,
      source: "builtin",
      loaded: !!STATE.timetables.find((t) => t.id === id),
    })),
    ...manual,
  ].sort((a, b) => a.label.localeCompare(b.label));

  items.forEach((tt) => {
    const item = document.createElement("div");
    item.className = "dropdown-item";
    item.textContent = tt.label;
    item.onclick = async () => {
      document.getElementById("ttSearchInput").value = tt.label;
      closeDropdown("ttDropdown");
      if (tt.source === "builtin") {
        const loaded = await loadBuiltInTimetable(tt.id);
        if (!loaded) return;
      }
      setActiveTimetable(tt.id);
      renderTimetablePreview();
      renderPredictionPage();
    };
    menu.appendChild(item);
  });
}

function filterTimetableDropdown() {
  const input = document.getElementById("ttSearchInput");
  if (!input) return;
  const q = input.value.toLowerCase();
  document.querySelectorAll("#ttDropdownMenu .dropdown-item").forEach((item) => {
    item.style.display = item.textContent.toLowerCase().includes(q) ? "" : "none";
  });
}
