const CAMPUS_API =
  "https://script.google.com/macros/s/AKfycbzJN3ifkutdyS5LfCOpS3iKClUPa2n3y9QV8Rlc5myvxTv6X6IwS_mykedcEr3hq6Ud/exec";

function validateUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (e) {
    return false;
  }
}

function renderCampusPosts(posts) {
  const grid = document.getElementById("clubGrid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!posts.length) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "col-span-full text-center text-gray-500 py-8";
    emptyDiv.textContent = "No events available.";
    grid.appendChild(emptyDiv);
    return;
  }

  posts.forEach((post) => {
    const card = document.createElement("div");
    card.className = `club-card overflow-hidden rounded-2xl shadow-lg ${
      post.priority
        ? "bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-700 text-black border border-yellow-200"
        : "card"
    }`;

    if (post.title) {
      new Image().src =
        CAMPUS_API + "?action=view&title=" + encodeURIComponent(post.title);
    }

    card.innerHTML = `
<div class="club-card-inner">
    <!-- FRONT -->
    <div class="club-card-front flex flex-col">
       <img class="post-poster w-full h-96 object-cover object-top" />
       <div class="p-4 flex flex-col flex-1">
            <div class="flex justify-between items-center mb-2">
                <span class="post-status text-xs font-semibold px-2 py-1 rounded-full"></span>
                <button class="flip-btn" onclick="this.closest('.club-card').classList.add('flipped')">
                    <i class="fas fa-rotate"></i>
                </button>
            </div>
            <h3 class="post-title text-lg font-bold mb-2"></h3>
            <p class="post-school text-sm truncate">🎓 </p>
            <p class="post-year text-sm">👨‍🎓 </p>
            <p class="post-date text-sm text-gray-600 mb-4">📅 Ends: </p>
            <div class="post-action mt-auto"></div>
        </div>
    </div>
    <!-- BACK -->
    <div class="club-card-back">
        <div class="p-4 flex justify-between items-center border-b border-gray-200/20 shrink-0 sticky top-0 z-10">
            <h3 class="post-back-title font-bold text-lg truncate pr-2"></h3>
            <button class="flip-btn shrink-0" onclick="this.closest('.club-card').classList.remove('flipped')">
                <i class="fas fa-arrow-left"></i>
            </button>
        </div>
        <div class="club-card-back-content">
            <div class="campus-caption"></div>
        </div>
    </div>
</div>
`;

    // Populate data safely
    const posterImg = card.querySelector(".post-poster");
    posterImg.src = validateUrl(post.poster) ? post.poster : "";
    posterImg.alt = post.title || "";

    const statusSpan = card.querySelector(".post-status");
    statusSpan.textContent =
      post.status === "Open" ? "Open" : "Registration Ended";
    statusSpan.className +=
      post.status === "Open"
        ? " bg-green-100 text-green-700"
        : " bg-red-100 text-red-700";

    const titleEl = card.querySelector(".post-title");
    titleEl.textContent = post.title || "";
    if (post.priority) titleEl.classList.add("text-black");

    const schoolEl = card.querySelector(".post-school");
    schoolEl.appendChild(document.createTextNode(post.school || ""));
    schoolEl.title = post.school || "";
    if (post.priority) schoolEl.classList.add("text-black/80");
    else schoolEl.classList.add("text-gray-600");

    const yearEl = card.querySelector(".post-year");
    yearEl.appendChild(document.createTextNode(post.year || ""));
    if (post.priority) yearEl.classList.add("text-black/80");
    else yearEl.classList.add("text-gray-600");

    const dateEl = card.querySelector(".post-date");
    dateEl.appendChild(document.createTextNode(post.endDate || ""));

    const actionDiv = card.querySelector(".post-action");
    if (post.status === "Open") {
      const link = document.createElement("a");
      link.href = validateUrl(post.link) ? post.link : "#";
      link.target = "_blank";
      link.onclick = () => trackAdClick(post.title);
      link.className = `block w-full text-center py-2 rounded-xl font-semibold transition ${
        post.priority
          ? "bg-black text-yellow-300 hover:bg-gray-900"
          : "bg-blue-600 text-white hover:bg-blue-700"
      }`;
      link.textContent = "Register";
      actionDiv.appendChild(link);
    } else {
      const btn = document.createElement("button");
      btn.disabled = true;
      btn.className =
        "block w-full bg-gray-300 text-gray-600 py-2 rounded-xl cursor-not-allowed font-semibold";
      btn.textContent = "Registration Closed";
      actionDiv.appendChild(btn);
    }

    const backEl = card.querySelector(".club-card-back");
    if (post.priority)
      backEl.classList.add(
        "bg-gradient-to-br",
        "from-yellow-300",
        "via-amber-400",
        "to-yellow-700",
        "text-black",
      );

    const backTitle = card.querySelector(".post-back-title");
    backTitle.textContent = post.title || "";
    if (post.priority) backTitle.classList.add("text-black");

    const captionDiv = card.querySelector(".campus-caption");
    if (post.description) {
      post.description.split("\n").forEach((line, i, arr) => {
        captionDiv.appendChild(document.createTextNode(line));
        if (i < arr.length - 1)
          captionDiv.appendChild(document.createElement("br"));
      });
    } else {
      const noInfo = document.createElement("span");
      noInfo.className = "text-gray-400";
      noInfo.textContent = "No additional information available.";
      captionDiv.appendChild(noInfo);
    }

    grid.appendChild(card);
  });
}

let campusPosts = [];

async function loadCampusPosts() {
  if (campusPosts.length) {
    filterCampusPosts();
    return;
  }
  try {
    const response = await fetch(CAMPUS_API);

    if (!response.ok) {
      throw new Error("Failed to load events");
    }

    campusPosts = await response.json();

    filterCampusPosts();
  } catch (error) {
    console.error(error);

    document.getElementById("clubGrid").innerHTML = `
            <div class="text-center text-red-500 py-8">
                Unable to load events.
            </div>
        `;
  }
}

function filterCampusPosts() {
  const search = "";

  const school = (window.selectedSchool || "all").trim().toLowerCase();
  const year = (window.selectedYear || "all").trim().toLowerCase();

  const filtered = campusPosts.filter((post) => {
    const matchName = !search || post.title.toLowerCase().includes(search);

    const selected = school.trim().toLowerCase();
    const matchSchool =
      selected === "all" ||
      post.school
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .includes(selected);

    const matchYear = year === "all" || post.year.trim().toLowerCase() === year;
    return matchName && matchSchool && matchYear;
  });

  renderCampusPosts(filtered);
}

