// 13. ANALYTICS — BREAKDOWN CHART
// ─────────────────────────────────────────────
let attendanceChartInst = null;

function renderAnalyticsPage() {
  renderAttendanceBreakdownChart();

  dailySubjectMap = STATE.dailySubjectMap || {};
  dailyOverallMap = STATE.dailyOverallMap || {};

  if (Object.keys(dailySubjectMap).length) {
    populateDailySubjectSelect();
    updateDailyChartView();
  }
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
          tension: 0.4, // 0.3–0.5 looks good
          cubicInterpolationMode: "monotone",
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: document.body.classList.contains("light-theme")
              ? "#334155"
              : "#94a3b8",
            font: { size: 11 },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: document.body.classList.contains("light-theme")
              ? "#475569"
              : "#64748b",
          },
          grid: { display: false },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            color: document.body.classList.contains("light-theme")
              ? "#475569"
              : "#64748b",
          },
          grid: {
            color: document.body.classList.contains("light-theme")
              ? "#e2e8f0"
              : "rgba(255, 255, 255, 0.05)",
          },
        },
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
      const ttSubj = hourIdx >= 0 ? (ttHours[hourIdx] || "").trim() : "";

      const subj =
        STATE.subjects.find((s) =>
          s.name.toLowerCase().includes(ttSubj.toLowerCase()),
        )?.name || ttSubj;
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

  STATE.dailySubjectMap = dailySubjectMap;
  STATE.dailyOverallMap = dailyOverallMap;
  saveState();
  populateDailySubjectSelect();

  document.getElementById("dailyDropdownText").textContent = "Select Subject";
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

function updateDailyChartView(value) {
  if (!value || !dailySubjectMap[value]) {
    if (dailyChartInst) {
      dailyChartInst.destroy();
      dailyChartInst = null;
    }
    return;
  }

  renderSubjectDailyChart({
    [value]: dailySubjectMap[value],
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
    segment: {
      borderColor: (ctx) => {
        const y = ctx.p1.parsed.y;

        if (y < 60) return "#ef4444";
        if (y < 75) return "#f59e0b";
        return "#22c55e";
      },
    },
    tension: 0.4,
    borderWidth: 2,
    pointRadius: 0,
    spanGaps: true,
  }));

  dailyChartInst = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      animation: {
        x: {
          type: "number",
          easing: "easeOutQuart",
          duration: 1200,
          from: NaN,
          delay(ctx) {
            return ctx.dataIndex * 70;
          },
        },
        y: {
          type: "number",
          easing: "easeOutQuart",
          duration: 1200,
          from(ctx) {
            if (ctx.index === 0) return ctx.chart.scales.y.getPixelForValue(0);
            return ctx.chart
              .getDatasetMeta(ctx.datasetIndex)
              .data[ctx.index - 1]?.getProps(["y"], true).y;
          },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            usePointStyle: true,
            pointStyle: "line",
            boxWidth: 25,
            boxHeight: 10,
            color: document.body.classList.contains("light-theme")
              ? "#111827"
              : "#f1f5f9",
          },
        },
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            color: document.body.classList.contains("light-theme")
              ? "#475569"
              : "#64748b",
          },
          grid: {
            color: document.body.classList.contains("light-theme")
              ? "#e2e8f0"
              : "rgba(255, 255, 255, 0.05)",
          },
        },
        x: {
          ticks: {
            color: document.body.classList.contains("light-theme")
              ? "#475569"
              : "#64748b",
            maxRotation: 45,
          },
          grid: { display: false },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────
