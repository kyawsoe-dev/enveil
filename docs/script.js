const themeToggle = document.querySelector("#theme-toggle");
const savedTheme = localStorage.getItem("enveil-docs-theme") || "dark";
const menuButton = document.querySelector(".menu-button");
const mobileMenu = document.querySelector("#mobile-menu");
const mobileBackdrop = document.querySelector(".mobile-backdrop");
const primaryDownload = document.querySelector("#primary-download");
const downloadLabel = document.querySelector("#download-label");
const downloadSublabel = document.querySelector("#download-sublabel");
const downloadNote = document.querySelector("#download-note");
const downloadLinks = document.querySelectorAll("[data-download]");
const downloadCombo = document.querySelector("#download-combo");
const sectionLinks = document.querySelectorAll("[data-section]");
const mobileNavQuery = window.matchMedia("(max-width: 920px)");

const THEME_CYCLE = ["dark", "light"];

function setTheme(choice) {
  if (choice === "dark") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", choice);
  }

  localStorage.setItem("enveil-docs-theme", choice);
  if (themeToggle) {
    themeToggle.dataset.theme = choice;
  }
}

themeToggle?.addEventListener("click", () => {
  const current = localStorage.getItem("enveil-docs-theme") || "dark";
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];
  setTheme(next);
});

function setMenu(open) {
  if (!menuButton || !mobileMenu) return;
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Collapse navigation" : "Expand navigation");
  mobileMenu.dataset.open = String(open);
  mobileBackdrop?.setAttribute("data-open", String(open));
  document.body.classList.toggle("menu-open", open);
}

menuButton?.addEventListener("click", () => {
  setMenu(menuButton.getAttribute("aria-expanded") !== "true");
});

mobileBackdrop?.addEventListener("click", () => setMenu(false));

mobileMenu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuButton?.getAttribute("aria-expanded") === "true") {
    setMenu(false);
    menuButton.focus();
  }
});

const handleNavViewportChange = (event) => {
  if (!event.matches) setMenu(false);
};

if (mobileNavQuery.addEventListener) {
  mobileNavQuery.addEventListener("change", handleNavViewportChange);
} else {
  mobileNavQuery.addListener(handleNavViewportChange);
}

function setActiveSection(sectionId) {
  sectionLinks.forEach((link) => {
    const isActive = link.dataset.section === sectionId;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function updateActiveSection() {
  const sectionIds = ["top", "features", "security", "development"];
  const current = sectionIds.reduce((active, sectionId) => {
    const section = document.querySelector(`#${sectionId}`);
    if (!section) return active;
    return section.getBoundingClientRect().top <= 120 ? sectionId : active;
  }, "top");

  setActiveSection(current);
}

let activeSectionFrame = null;
function requestActiveSectionUpdate() {
  if (activeSectionFrame) return;
  activeSectionFrame = requestAnimationFrame(() => {
    activeSectionFrame = null;
    updateActiveSection();
  });
}

window.addEventListener("scroll", requestActiveSectionUpdate, { passive: true });
window.addEventListener("resize", requestActiveSectionUpdate);

// --- Download logic ---

const ASSET_PATTERNS = {
  "mac-arm": "aarch64.dmg",
  "mac-intel": "x64.dmg",
  "windows-exe": "x64-setup.exe",
  "windows-msi": "x64_en-US.msi",
  "linux-deb": "amd64.deb",
  "linux-appimage": "amd64.AppImage",
  "linux-rpm": "x86_64.rpm",
};

const PLATFORM_INFO = {
  "mac-arm": { name: "macOS (Apple Silicon)", primary: true },
  "mac-intel": { name: "macOS (Intel)" },
  "windows-exe": { name: "Windows (EXE)" },
  "windows-msi": { name: "Windows (MSI)" },
  "linux-deb": { name: "Linux (Debian)" },
  "linux-appimage": { name: "Linux (AppImage)" },
  "linux-rpm": { name: "Linux (RPM)" },
};

function getPlatform() {
  const ua = (navigator.userAgent || "").toLowerCase();

  if (ua.includes("windows") || ua.includes("win64")) return "windows-exe";
  if (ua.includes("linux")) return "linux-deb";
  if (ua.includes("mac")) {
    const isArm = ua.includes("arm64") || ua.includes("aarch");
    return isArm ? "mac-arm" : "mac-intel";
  }
  return null;
}

async function fetchLatestRelease() {
  const cached = sessionStorage.getItem("enveil-release");
  if (cached) return JSON.parse(cached);

  try {
    const res = await fetch("https://api.github.com/repos/kyawsoe-dev/enveil/releases/latest");
    if (!res.ok) throw new Error("GitHub API error");
    const data = await res.json();
    const release = { assets: {} };
    for (const asset of data.assets) {
      for (const [key, pattern] of Object.entries(ASSET_PATTERNS)) {
        if (asset.name.endsWith(pattern)) {
          release.assets[key] = asset.browser_download_url;
          break;
        }
      }
    }
    sessionStorage.setItem("enveil-release", JSON.stringify(release));
    return release;
  } catch {
    return null;
  }
}

function closeDropdown() {
  if (downloadCombo) downloadCombo.dataset.open = "false";
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDropdown();
});

let closeTimer = null;

downloadCombo?.addEventListener("mouseenter", () => {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  if (downloadCombo) downloadCombo.dataset.open = "true";
});

downloadCombo?.addEventListener("mouseleave", () => {
  closeTimer = setTimeout(closeDropdown, 150);
});

function selectPlatform(key) {
  const info = PLATFORM_INFO[key];
  if (!info) return;
  downloadLabel.textContent = "Download ENVEIL";
  downloadSublabel.textContent = `For ${info.name}`;
  const link = downloadLinks ? Array.from(downloadLinks).find(l => l.dataset.download === key) : null;
  if (link && link.href && link.href !== "#") {
    primaryDownload.href = link.href;
  }
  primaryDownload.dataset.download = key;
  closeDropdown();
}

async function initDownloads() {
  const release = await fetchLatestRelease();
  const detectedKey = getPlatform();

  // Populate all download links
  if (release) {
    downloadLinks.forEach((link) => {
      const key = link.dataset.download;
      link.href = release.assets[key] || "https://github.com/kyawsoe-dev/enveil/releases/latest";
    });
  } else {
    downloadLinks.forEach((link) => {
      link.href = "https://github.com/kyawsoe-dev/enveil/releases/latest";
    });
  }

  // Update primary button and note
  if (primaryDownload && downloadLabel && downloadNote) {
    const primaryKey = primaryDownload.dataset.download;
    const targetKey = (detectedKey && release?.assets[detectedKey]) ? detectedKey : primaryKey;

    if (release?.assets[targetKey]) {
      primaryDownload.href = release.assets[targetKey];
    }

    if (targetKey !== primaryKey) {
      primaryDownload.dataset.download = targetKey;
    }

    if (detectedKey) {
      const detectedInfo = PLATFORM_INFO[detectedKey];
      downloadLabel.textContent = "Download ENVEIL";
      downloadSublabel.textContent = `For ${detectedInfo?.name || "your OS"}`;
      downloadNote.textContent = "";
    } else {
      downloadLabel.textContent = "Download ENVEIL";
      downloadSublabel.textContent = "Choose your platform";
      downloadNote.textContent = "";
    }
  }

  // Trigger click navigates to download (dropdown opens on hover instead)
  const trigger = downloadCombo?.querySelector(".download-trigger");

  // Select platform from dropdown
  downloadCombo?.querySelectorAll(".download-menu a").forEach((item) => {
    item.addEventListener("click", (event) => {
      const key = item.dataset.download;
      if (key) {
        selectPlatform(key);
        // Navigate to the download URL
        if (item.href && item.href !== "#") {
          window.location.href = item.href;
        }
      }
      event.preventDefault();
    });
  });
}

if (themeToggle) themeToggle.dataset.theme = savedTheme;
setTheme(savedTheme);
updateActiveSection();
initDownloads();

// --- Hero carousel ---

const carouselTrack = document.querySelector("#hero-carousel-track");
const carouselDots = document.querySelector("#hero-carousel-dots");

if (carouselTrack && carouselDots) {
  const slides = Array.from(carouselTrack.children);
  const total = slides.length;
  let current = 0;
  let autoTimer = null;

  // Clone first and last for infinite loop
  const firstClone = slides[0].cloneNode(true);
  const lastClone = slides[total - 1].cloneNode(true);
  carouselTrack.appendChild(firstClone);
  carouselTrack.insertBefore(lastClone, slides[0]);
  const allSlides = Array.from(carouselTrack.children);
  const slideCount = allSlides.length;

  // Start at real first slide (index 1)
  current = 1;
  carouselTrack.style.transform = `translateX(-${current * 100}%)`;

  // Build dots
  for (let i = 0; i < total; i++) {
    const dot = document.createElement("button");
    dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
    dot.addEventListener("click", () => goTo(i));
    carouselDots.appendChild(dot);
  }
  updateDots();

  function updateDots() {
    const dots = carouselDots.children;
    const realIndex = ((current - 1) % total + total) % total;
    for (let i = 0; i < dots.length; i++) {
      dots[i].toggleAttribute("data-active", i === realIndex);
    }
  }

  function goTo(index) {
    stopAuto();
    current = index + 1;
    carouselTrack.style.transition = "transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    carouselTrack.style.transform = `translateX(-${current * 100}%)`;
    updateDots();
    startAuto();
  }

  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(next, 4000);
  }

  function next() {
    current++;
    carouselTrack.style.transition = "transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    carouselTrack.style.transform = `translateX(-${current * 100}%)`;

    // When reaching the clone, jump to real slide without transition
    if (current === slideCount - 1) {
      setTimeout(() => {
        carouselTrack.style.transition = "none";
        current = 1;
        carouselTrack.style.transform = `translateX(-${current * 100}%)`;
      }, 500);
    }
    // When going backward past first clone
    if (current === 0) {
      setTimeout(() => {
        carouselTrack.style.transition = "none";
        current = slideCount - 2;
        carouselTrack.style.transform = `translateX(-${current * 100}%)`;
      }, 500);
    }

    updateDots();
  }

  // Pause on hover
  const carousel = document.querySelector("#hero-carousel");
  carousel?.addEventListener("mouseenter", stopAuto);
  carousel?.addEventListener("mouseleave", startAuto);

  // Touch swipe support
  let startX = 0;
  let isDragging = false;
  carouselTrack.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    isDragging = true;
    stopAuto();
  }, { passive: true });
  carouselTrack.addEventListener("touchend", (e) => {
    if (!isDragging) return;
    isDragging = false;
    const diff = e.changedTouches[0].clientX - startX;
    if (Math.abs(diff) > 50) {
      if (diff < 0) next();
      else {
        current--;
        carouselTrack.style.transition = "transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
        carouselTrack.style.transform = `translateX(-${current * 100}%)`;
        updateDots();
        // Clone jump back
        if (current === 0) {
          setTimeout(() => {
            carouselTrack.style.transition = "none";
            current = slideCount - 2;
            carouselTrack.style.transform = `translateX(-${current * 100}%)`;
          }, 500);
        }
      }
    }
    startAuto();
  }, { passive: true });

  startAuto();
}

// --- Release bar ---

async function loadReleaseBar() {
  const versionEl = document.querySelector("#release-version");
  const summaryEl = document.querySelector("#release-summary");
  const itemsEl = document.querySelector("#release-items");
  if (!versionEl || !summaryEl || !itemsEl) return;

  try {
    const res = await fetch("https://api.github.com/repos/kyawsoe-dev/enveil/releases/latest");
    if (!res.ok) throw new Error("API error");
    const data = await res.json();

    versionEl.textContent = data.tag_name || "v0.0.0";

    const body = data.body || "";
    const lines = body.split("\n").filter(l => l.trim().startsWith("-") || l.trim().startsWith("*"));
    const bulletPoints = lines.slice(0, 4);

    itemsEl.innerHTML = "";
    if (bulletPoints.length > 0) {
      bulletPoints.forEach(line => {
        const li = document.createElement("li");
        li.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg><span>${line.replace(/^[-*\s]+/, "")}</span>`;
        itemsEl.appendChild(li);
      });
    } else {
      const li = document.createElement("li");
      li.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg><span>See the release page for details.</span>`;
      itemsEl.appendChild(li);
    }

    summaryEl.textContent = `Mirrored from the latest GitHub release — ${data.tag_name || ""}`;
  } catch {
    versionEl.textContent = "v0.0.0";
    summaryEl.textContent = "Could not load release information.";
  }
}

loadReleaseBar();

// --- Back to top ---
const backToTop = document.querySelector("#back-to-top");
if (backToTop) {
  backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  backToTop.toggleAttribute("data-visible", true);
}

// --- Particle wave background ---
(function () {
  const canvas = document.getElementById("bg-particle-wave");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H;
  let mouseX = -9999, mouseY = -9999;
  let hasInteraction = false;
  let particles = [];
  let frameId;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  window.addEventListener("resize", resize);
  resize();

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    hasInteraction = true;
  });

  document.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (t) { mouseX = t.clientX; mouseY = t.clientY; hasInteraction = true; }
  }, { passive: true });

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function Particle() {
    if (hasInteraction) {
      this.x = mouseX + rand(-10, 10);
      this.y = mouseY + rand(-10, 10);
    } else {
      this.x = rand(0, W);
      this.y = rand(0, H * 0.6);
    }
    this.r = rand(1.5, 4);
    this.rStart = this.r;
    this.vx = rand(-1.2, 1.2);
    this.vy = rand(-0.8, -0.2);
    this.gravity = 0.05;
    this.bounced = false;
    this.hue = Math.random() < 0.6 ? rand(150, 170) : rand(200, 230);
    this.light = rand(70, 95);
    this.opacity = 1;
    this.life = 0;
    this.maxLife = rand(40, 120);
    this.bounceDecay = rand(0.6, 0.85);
    this.twinkle = rand(0.02, 0.06);
    this.twinkleDir = 1;
  }

  Particle.prototype.draw = function () {
    this.x += this.vx;
    this.vy += this.gravity;
    this.y += this.vy;
    this.life++;

    const progress = this.life / this.maxLife;
    this.opacity = Math.max(0, 1 - progress);
    this.r = this.rStart * (1 - progress * 0.3);

    if (this.y + this.r > H) {
      this.y = H - this.r;
      this.vy *= -this.bounceDecay;
      this.vx *= 0.96;
      this.bounced = true;
    }

    if (this.r <= 0.3 || this.opacity <= 0 || this.life > this.maxLife) return false;

    const sparkle = 0.7 + Math.sin(this.life * this.twinkle) * 0.3;
    ctx.globalAlpha = this.opacity * 0.6 * sparkle;
    ctx.fillStyle = `hsla(${this.hue},80%,${this.light}%,1)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    return true;
  };

  let tick = 0;

  function loop() {
    ctx.clearRect(0, 0, W, H);

    tick++;
    if (tick % 3 === 0) {
      const count = hasInteraction ? 2 : 4;
      for (let i = 0; i < count; i++) particles.push(new Particle());
    }

    particles = particles.filter((p) => p.draw());
    if (particles.length > 400) particles.splice(0, particles.length - 400);

    frameId = requestAnimationFrame(loop);
  }

  loop();
})();
