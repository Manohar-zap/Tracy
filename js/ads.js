// 23. COLLEGE ADS SYSTEM
// ─────────────────────────────────────────────
let adsList = [];
let adsCurrentSlide = 0;
let adsMustSwipeAll = false;
let adsViewed = new Set();
let adsAutoSlide = null;

let inlineAdsAutoSlide = null;

async function initAdsSystem() {
  try {
    const sheet = await fetchSheetAds();
    adsList = sheet;

    renderInlineAdSlider();

    if (adsList.length > 1) {
      clearInterval(inlineAdsAutoSlide);

      inlineAdsAutoSlide = setInterval(() => {
        adsCurrentSlide = (adsCurrentSlide + 1) % adsList.length;

        renderInlineAdSlider();
      }, 3000);
    }

    if (!adsList.length) return;

    showAdsPopup();
  } catch (err) {
    logError("Ads System Initialization", err);
  }
}

async function fetchSheetAds() {
  try {
    const res = await fetch(CAMPUS_API);

    if (!res.ok) return [];

    const data = await res.json();

    return data.filter((ad) => ad.priority);
  } catch (e) {
    console.error(e);
    return [];
  }
}

function showAdsPopup() {
  if (!adsList.length) return;
  adsCurrentSlide = 0;
  adsViewed.clear();
  adsViewed.add(0);
  adsMustSwipeAll = true;
  const closeBtn = document.getElementById("adsCloseBtn");
  closeBtn?.classList.remove("visible");
  const ad = adsList[adsCurrentSlide];
  if (ad && ad.title) {
    new Image().src =
      CAMPUS_API + "?action=view&title=" + encodeURIComponent(ad.title);
  }

  const slidesEl = document.getElementById("adsSlides");
  const dotsEl = document.getElementById("adsDots");
  if (!slidesEl) return;

  slidesEl.innerHTML = "";
  if (dotsEl) dotsEl.innerHTML = "";

  adsList.forEach((ad, i) => {
    const slide = document.createElement("div");
    slide.className = `ads-slide ${i === 0 ? "active" : ""}`;
    slide.dataset.idx = i;

    let container = slide;
    if (ad.link && typeof validateUrl === "function" && validateUrl(ad.link)) {
      const a = document.createElement("a");
      a.href = ad.link;
      a.target = "_blank";
      a.onclick = () => trackAdClick(ad.title);
      slide.appendChild(a);
      container = a;
    }

    const img = document.createElement("img");
    img.src =
      typeof validateUrl === "function" && validateUrl(ad.poster)
        ? ad.poster
        : "";
    img.alt = ad.title || "";
    container.appendChild(img);

    const titleP = document.createElement("p");
    titleP.className = "text-sm text-gray-300 mt-2";
    titleP.textContent = ad.title || "";
    slide.appendChild(titleP);

    slidesEl.appendChild(slide);

    if (dotsEl) {
      const dot = document.createElement("div");
      dot.className = `ads-dot ${i === 0 ? "active" : ""}`;
      dot.onclick = () => adsGoTo(i);
      dotsEl.appendChild(dot);
    }
  });

  if (hintEl) hintEl.classList.toggle("hidden", !adsMustSwipeAll);
  updateAdsCloseBtn();
  document.getElementById("adsPopup")?.classList.add("open");

  clearInterval(adsAutoSlide);
  adsAutoSlide = setInterval(() => {
    adsNav(1);
  }, 2000);
  initAdsSwipe();
}

function trackAdClick(title) {
  new Image().src =
    CAMPUS_API + "?action=click&title=" + encodeURIComponent(title);
}

function updateAdsCloseBtn() {
  const btn = document.getElementById("adsCloseBtn");
  if (!btn) return;
  if (!adsMustSwipeAll) {
    btn.classList.add("visible");
    return;
  }
  const viewedAll = adsViewed.size >= adsList.length;
  btn.classList.toggle("visible", viewedAll);
}

function adsGoTo(idx) {
  adsCurrentSlide = Math.max(0, Math.min(idx, adsList.length - 1));
  document.querySelectorAll(".ads-slide").forEach((s, i) => {
    s.classList.toggle("active", i === adsCurrentSlide);
  });
  document.querySelectorAll(".ads-dot").forEach((d, i) => {
    d.classList.toggle("active", i === adsCurrentSlide);
    renderInlineAdSlider();
  });

  const ad = adsList[adsCurrentSlide];
  if (ad && ad.title) {
    new Image().src =
      CAMPUS_API + "?action=view&title=" + encodeURIComponent(ad.title);
  }
  adsViewed.add(adsCurrentSlide);
  updateAdsCloseBtn();
}

function adsNav(dir) {
  let next = adsCurrentSlide + dir;

  if (next >= adsList.length) next = 0;
  if (next < 0) next = adsList.length - 1;

  adsGoTo(next);

  clearInterval(adsAutoSlide);

  adsAutoSlide = setInterval(() => {
    adsNav(1);
  }, 2000);
}

function closeAdsPopup() {
  if (adsMustSwipeAll && adsViewed.size < adsList.length) {
    showToast("View all ads first");
    return;
  }
  clearInterval(adsAutoSlide);
  document.getElementById("adsPopup")?.classList.remove("open");
}

function initAdsSwipe() {
  const carousel = document.querySelector(".ads-carousel");
  if (!carousel) return;
  let startX = 0;
  carousel.ontouchstart = (e) => {
    startX = e.touches[0].clientX;
  };
  carousel.ontouchend = (e) => {
    const diff = e.changedTouches[0].clientX - startX;
    if (Math.abs(diff) > 50) adsNav(diff < 0 ? 1 : -1);
  };
}

// ─────────────────────────────────────────────
