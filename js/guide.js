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
    pos: "center",
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
    page: "analytics",
    target: "#dailyUploadBtn",
    title: "📊 Daily Analysis",
    text: "Upload your Daily Attendance Excel to analyze your progress.",
  },
];

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

  modal.classList.remove("guide-bottom", "guide-top", "open");

  // Close any stray modals/overlays before moving to next step
  if (typeof closeConfirm === 'function') closeConfirm();
  if (typeof closeSidebar === 'function') closeSidebar();

  navigateTo(s.page);

  let attempts = 0;
  const findAndShow = () => {
    const target = s.target ? document.querySelector(s.target) : null;

    // Increased attempts and check for element existence/visibility
    if (s.target && (!target || target.offsetParent === null) && attempts < 15) {
      attempts++;
      setTimeout(findAndShow, 150);
      return;
    }

    document
      .querySelectorAll(".guide-highlight")
      .forEach((e) => e.classList.remove("guide-highlight"));

    if (target) {
      target.classList.add("guide-highlight");
      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      // Position modal away from target with a reliable delay
      setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        if (s.pos === "center") {
          // Keep it centered (remove both top/bottom)
        } else if (s.pos === "bottom") {
          modal.classList.add("guide-bottom");
        } else if (s.pos === "top") {
          modal.classList.add("guide-top");
        } else {
          // Auto logic
          if (rect.top < viewportHeight / 2) {
            modal.classList.add("guide-bottom");
          } else {
            modal.classList.add("guide-top");
          }
        }
        modal.classList.add("open");
      }, 400);
    } else {
      modal.classList.add("open");
    }

    document.getElementById("guideTitle").textContent = s.title;
    document.getElementById("guideText").innerText = s.text;
    document.getElementById("guideStep").textContent =
      `${guideIndex + 1}/${GUIDE_STEPS.length}`;

    document.getElementById("guideNextBtn").textContent =
      guideIndex === GUIDE_STEPS.length - 1 ? "Finish" : "Next";
  };

  // Initial delay to let page transition start
  setTimeout(findAndShow, 400);
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
