// 25. ADD TO CALENDAR (prediction cards)
// ─────────────────────────────────────────────
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

function getNextDateForDay(dayName) {
  const norm = normalizeDayName(dayName);
  const dayIdx = DAY_ORDER.findIndex(
    (d) => norm.includes(d) || d.includes(norm),
  );
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
    extra = w1
      ? countSubjectInRows(
          w1.rows,
          s.name,
          todayIdx,
          STATE.weekOverrides.week1,
          0,
        )
      : 0;
  } else {
    const w1r = w1
      ? countSubjectInRows(
          w1.rows,
          s.name,
          todayIdx,
          STATE.weekOverrides.week1,
          1,
        )
      : 0;
    const w2f = w2
      ? countSubjectInRows(
          w2.rows,
          s.name,
          undefined,
          STATE.weekOverrides.week2,
        )
      : 0;
    extra = w1r + w2f;
  }

  const futureAttended = (s.attended || 0) + (s.dutyLeave || 0) + extra;
  const futureTotal = s.total + extra;
  const { need, bunk } = calcNeedAndBunk(
    { attended: futureAttended, total: futureTotal },
    STATE.target,
  );
  const statusText = need > 0 ? `+${need} needed` : `${bunk} safe bunk`;

  return { subject: s, statusText, tt: w1 };
}

function getCurrentHourIndex() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();

  for (let i = 0; i < HOUR_SCHEDULE.length; i++) {
    const [h, m] = HOUR_SCHEDULE[i].end.split(":").map(Number);
    const endMins = h * 60 + m;

    if (mins <= endMins) {
      return i;
    }
  }

  return -1; // all classes finished
}

function buildCalendarEventsForSubject(subjectId) {
  const info = getSubjectPredInfo(subjectId);
  if (!info || !info.tt) return [];

  const events = [];
  const clean = (str) =>
    String(str || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const sKey = clean(info.subject.name);

  const todayIdx = getTodayOrderIdx();
  const currentHour = getCurrentHourIndex();

  const searchFromDay =
    currentHour === -1 ? (todayIdx === 6 ? 1 : todayIdx + 1) : todayIdx;

  const nextRows = info.tt.rows
    .filter((r) => weekdayOrderIndex(r.day) >= searchFromDay)
    .sort((a, b) => weekdayOrderIndex(a.day) - weekdayOrderIndex(b.day))
    .slice(0, 1);

  nextRows.forEach((row) => {
    row.hours.forEach((cell, hIdx) => {
      if (
        weekdayOrderIndex(row.day) === todayIdx &&
        currentHour !== -1 &&
        hIdx < currentHour
      ) {
        return; // Skip classes that have already ended today
      }
      const text = String(cell || "").trim();
      if (!text || text.toLowerCase().includes("holiday")) return;

      const tKey = clean(text);
      if (!(sKey.includes(tKey) || tKey.includes(sKey))) return;

      const sched = HOUR_SCHEDULE[hIdx] || {
        start: "09:00",
        end: "10:00",
        label: `Hr ${hIdx + 1}`,
      };

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
    showToast("No upcoming classes found today.");
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
  downloadIcs(
    events,
    `zaptrack-${(s?.name || "subject").replace(/\W+/g, "-").slice(0, 20)}.ics`,
  );
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

