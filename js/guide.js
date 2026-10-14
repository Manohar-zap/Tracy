// ─────────────────────────────────────────────
// ONBOARDING & GETTING STARTED VISUAL GUIDE
// ─────────────────────────────────────────────

const GUIDE_STEPS = [
  {
    title: "1. Sign In to Linways AMS",
    caption: "Enter credentials & tap Sign In",
    text: "Visit the Linways portal, enter your student username and password, then tap <b>Sign in</b>.",
    img: "guide/image_01.jpg",
    linkText: "Open Linways Portal",
    linkUrl: "https://presidencyuniversity.linways.com",
  },
  {
    title: "2. Open Sidebar & Tap Attendance",
    caption: "Tap 'Attendance' in sidebar (Red Box)",
    text: "Tap the hamburger menu (☰) at top, then tap the highlighted <b>Attendance</b> section.",
    img: "guide/image_04.jpg",
  },
  {
    title: "3. Download Attendance Report",
    caption: "Tap the 'Export' button (Red Box)",
    text: "On the Attendance page, tap the purple <b>Export</b> button highlighted in red to download your <b>.xlsx</b> report.",
    img: "guide/image_05.jpg",
    linkText: "Direct Attendance Report Link",
    linkUrl: "https://presidencyuniversity.linways.com/ams/attendance/consolidated-attendance-report?redir=true",
  },
  {
    title: "4. Drop File in ZapTrack!",
    caption: "Drop or tap the upload box (Red Box)",
    text: "Return to ZapTrack and drop or tap the <b>dashed upload card</b> highlighted in red — your safe bunks and stats will load instantly!",
    img: "guide/image_06.jpg",
  },
];

let guideIndex = 0;
let guideTouchStartX = 0;
let guideTouchEndX = 0;
let guideGesturesInitialized = false;

// Preload images for instant switching
function preloadGuideImages() {
  GUIDE_STEPS.forEach((step) => {
    if (step.img) {
      const img = new Image();
      img.src = step.img;
    }
  });
}

function startGuide(startIndex = 0) {
  guideIndex = Math.max(0, Math.min(startIndex, GUIDE_STEPS.length - 1));
  guideMode = true;

  const modal = document.getElementById("guideModal");
  if (!modal) return;

  renderGuideDots();
  setupGuideGestures();

  modal.classList.add("open");
  showGuideStep();
}

function renderGuideDots() {
  const dotsContainer = document.getElementById("guideDots");
  if (!dotsContainer) return;

  dotsContainer.innerHTML = GUIDE_STEPS.map((_, idx) => `
    <button type="button" class="guide-dot ${idx === guideIndex ? 'active' : ''}" data-idx="${idx}" title="Go to step ${idx + 1}" aria-label="Step ${idx + 1}"></button>
  `).join("");

  dotsContainer.querySelectorAll(".guide-dot").forEach((dot) => {
    dot.addEventListener("click", (e) => {
      const idx = parseInt(e.currentTarget.dataset.idx, 10);
      if (!isNaN(idx)) goToGuideStep(idx);
    });
  });
}

function showGuideStep() {
  const step = GUIDE_STEPS[guideIndex];
  if (!step) return;

  const modal = document.getElementById("guideModal");
  if (!modal) return;

  const titleEl = document.getElementById("guideTitle");
  const textEl = document.getElementById("guideText");
  const captionEl = document.getElementById("guideCaption");
  const captionContainer = document.getElementById("guideCaptionContainer");
  const stepNumEl = document.getElementById("guideStepNum");
  const stepTotalEl = document.getElementById("guideStepTotal");
  const imgEl = document.getElementById("guideImage");
  const prevBtn = document.getElementById("guidePrevBtn");
  const nextBtn = document.getElementById("guideNextBtn");
  const nextLabel = document.getElementById("guideNextLabel");
  const nextIcon = document.getElementById("guideNextIcon");
  const linkContainer = document.getElementById("guideLinkContainer");
  const actionLink = document.getElementById("guideActionLink");
  const actionText = document.getElementById("guideActionText");
  const arrowPrev = modal.querySelector(".guide-nav-arrow.prev");
  const arrowNext = modal.querySelector(".guide-nav-arrow.next");

  if (titleEl) titleEl.textContent = step.title;
  if (textEl) textEl.innerHTML = step.text;
  if (captionEl) captionEl.textContent = step.caption || "";
  if (captionContainer) {
    if (step.caption) {
      captionContainer.classList.remove("hidden");
    } else {
      captionContainer.classList.add("hidden");
    }
  }
  if (stepNumEl) stepNumEl.textContent = guideIndex + 1;
  if (stepTotalEl) stepTotalEl.textContent = GUIDE_STEPS.length;

  // External Link button if available
  if (linkContainer && actionLink && actionText) {
    if (step.linkUrl && step.linkText) {
      actionLink.href = step.linkUrl;
      actionText.textContent = step.linkText;
      linkContainer.classList.remove("hidden");
    } else {
      linkContainer.classList.add("hidden");
    }
  }

  // Smooth image swap
  if (imgEl) {
    imgEl.classList.add("fade-out");
    setTimeout(() => {
      imgEl.src = step.img;
      imgEl.onload = () => imgEl.classList.remove("fade-out");
      // Fallback if cached or load already fired
      setTimeout(() => imgEl.classList.remove("fade-out"), 60);
    }, 100);
  }

  // Update dots
  const dots = document.querySelectorAll("#guideDots .guide-dot");
  dots.forEach((dot, idx) => {
    dot.classList.toggle("active", idx === guideIndex);
  });

  // Prev button state
  const isFirst = guideIndex === 0;
  if (prevBtn) {
    prevBtn.disabled = isFirst;
    prevBtn.classList.toggle("opacity-25", isFirst);
    prevBtn.classList.toggle("pointer-events-none", isFirst);
  }
  if (arrowPrev) {
    arrowPrev.classList.toggle("disabled", isFirst);
  }

  // Next button state
  const isLast = guideIndex === GUIDE_STEPS.length - 1;
  if (nextLabel) {
    nextLabel.textContent = isLast ? "Get Started 🚀" : "Next";
  }
  if (nextIcon) {
    nextIcon.className = isLast ? "fas fa-check text-[10px]" : "fas fa-arrow-right text-[10px]";
  }
  if (arrowNext) {
    arrowNext.classList.toggle("disabled", isLast);
  }
}

function nextGuide() {
  if (guideIndex < GUIDE_STEPS.length - 1) {
    guideIndex++;
    showGuideStep();
  } else {
    finishGuide();
  }
}

function prevGuide() {
  if (guideIndex > 0) {
    guideIndex--;
    showGuideStep();
  }
}

function goToGuideStep(idx) {
  if (idx >= 0 && idx < GUIDE_STEPS.length) {
    guideIndex = idx;
    showGuideStep();
  }
}

function finishGuide() {
  localStorage.setItem("guideSeen", "true");
  localStorage.setItem("guideSeen_v2", "true");

  const modal = document.getElementById("guideModal");
  if (modal) modal.classList.remove("open");

  guideMode = false;
  if (typeof showToast === "function") {
    showToast("Guide finished! Drop your Excel file to begin.");
  }
}

function skipGuide() {
  localStorage.setItem("guideSeen", "true");
  localStorage.setItem("guideSeen_v2", "true");

  const modal = document.getElementById("guideModal");
  if (modal) modal.classList.remove("open");

  guideMode = false;
}

function setupGuideGestures() {
  if (guideGesturesInitialized) return;
  guideGesturesInitialized = true;

  const wrapper = document.getElementById("guideImgWrapper");
  if (wrapper) {
    wrapper.addEventListener("touchstart", (e) => {
      guideTouchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    wrapper.addEventListener("touchend", (e) => {
      guideTouchEndX = e.changedTouches[0].screenX;
      handleGuideSwipe();
    }, { passive: true });
  }

  // Keyboard navigation when guideModal is open
  window.addEventListener("keydown", (e) => {
    const modal = document.getElementById("guideModal");
    if (!modal || !modal.classList.contains("open")) return;

    if (e.key === "ArrowRight") {
      nextGuide();
    } else if (e.key === "ArrowLeft") {
      prevGuide();
    } else if (e.key === "Escape") {
      skipGuide();
    }
  });

  // Click outside to close (backdrop click)
  const modal = document.getElementById("guideModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        skipGuide();
      }
    });
  }
}

function handleGuideSwipe() {
  const swipeDistance = guideTouchEndX - guideTouchStartX;
  if (Math.abs(swipeDistance) > 40) {
    if (swipeDistance < 0) {
      // Swiped left -> next
      nextGuide();
    } else {
      // Swiped right -> prev
      prevGuide();
    }
  }
}

// Preload images immediately
preloadGuideImages();
