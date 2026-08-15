const GUIDE_STEPS = [
  {
    page: "dashboard",
    target: "#uploadZone",
    title: "📄 Upload Attendance",
    text: "Upload your attendance report here.",
  },
  {
    page: "dashboard",
    target: ".help-btn",
    title: "ⓘ Help",
    text: "Need help getting your Excel report?\nTap here anytime.",
  },
  {
    page: "calculator",
    target: "#quickCalcHeading",
    title: "🧮 Quick Calculator",
    text: "Calculate attendance manually without an Excel upload.",
  },
  {
    page: "timetable",
    target: "#ttDropdown",
    title: "📅 Timetable",
    text: "Select your class timetable for accurate predictions.",
  },
  {
    page: "prediction",
    target: null,
    title: "📈 Prediction Engine",
    text: "View your attendance predictions and safe bunk limits.",
  },
  {
    page: "prediction",
    target: "#addCalendarBtn",
    title: "📆 Add to Calendar",
    text: "Add predicted classes to your calendar.",
  },
  {
    page: "analytics",
    target: "#dailyUploadBtn",
    title: "📊 Daily Analysis",
    text: "Upload your Daily Attendance Excel to analyze your progress.",
  },
];

let guideMode = false;
let guideIndex = 0;

function startGuide() {
  guideMode = true;
  guideIndex = 0;

  document.body.classList.add("guide-active");

  showGuideStep();
}

let tries = 0;

function showGuideStep() {
  const s = GUIDE_STEPS[guideIndex];
  const modal = document.getElementById("guideModal");

  modal.classList.toggle("guide-bottom", s.target === "#addCalendarBtn");
  navigateTo(s.page);

  setTimeout(() => {
    const target = s.target ? document.querySelector(s.target) : null;

    document
      .querySelectorAll(".guide-highlight")
      .forEach((e) => e.classList.remove("guide-highlight"));

    if (target) {
      target.classList.add("guide-highlight");

      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }

    document.getElementById("guideTitle").textContent = s.title;
    document.getElementById("guideText").innerText = s.text;
    document.getElementById("guideStep").textContent =
      `${guideIndex + 1}/${GUIDE_STEPS.length}`;

    document.getElementById("guideNextBtn").textContent =
      guideIndex === GUIDE_STEPS.length - 1 ? "Finish" : "Next";

    document.getElementById("guideModal").classList.add("open");
  }, 150);
}

function nextGuide() {
  guideIndex++;

  if (guideIndex >= GUIDE_STEPS.length) {
    localStorage.setItem("guideSeen", "true");

    document.getElementById("guideModal").classList.remove("open");

    document
      .querySelectorAll(".guide-highlight")
      .forEach((e) => e.classList.remove("guide-highlight"));

    guideMode = false;
    document.body.classList.remove("guide-active");

    navigateTo("dashboard");
    return;
  }

  showGuideStep();
}

function skipGuide() {
  localStorage.setItem("guideSeen", "true");

  document.getElementById("guideModal").classList.remove("open");

  document
    .querySelectorAll(".guide-highlight")
    .forEach((e) => e.classList.remove("guide-highlight"));

  guideMode = false;
  document.body.classList.remove("guide-active");
}
