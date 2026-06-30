const themeButtons = document.querySelectorAll("[data-theme-choice]");
const savedTheme = localStorage.getItem("enveil-docs-theme") || "system";
const menuButton = document.querySelector(".menu-button");
const mobileMenu = document.querySelector("#mobile-menu");
const mobileBackdrop = document.querySelector(".mobile-backdrop");
const primaryDownload = document.querySelector("#primary-download");
const downloadIcon = document.querySelector("#download-icon");
const downloadLabel = document.querySelector("#download-label");
const downloadNote = document.querySelector("#download-note");
const downloadCombo = document.querySelector(".download-combo");
const sectionLinks = document.querySelectorAll("[data-section]");
const mobileNavQuery = window.matchMedia("(max-width: 920px)");

function setTheme(choice) {
  if (choice === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", choice);
  }

  localStorage.setItem("enveil-docs-theme", choice);
  themeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === choice));
  });
}

themeButtons.forEach((button) => {
  button.addEventListener("click", () => setTheme(button.dataset.themeChoice));
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

  if (event.key === "Escape" && downloadCombo?.open) {
    downloadCombo.open = false;
  }
});

document.addEventListener("click", (event) => {
  if (downloadCombo?.open && !downloadCombo.contains(event.target)) {
    downloadCombo.open = false;
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
  const sectionIds = ["top", "features", "screenshots", "security", "development"];
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

function getPlatform() {
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  const agent = navigator.userAgent || "";
  const value = `${platform} ${agent}`.toLowerCase();

  if (value.includes("mac")) return { key: "mac", name: "macOS", asset: ".dmg" };
  if (value.includes("win")) return { key: "windows", name: "Windows", asset: ".msi" };
  if (value.includes("linux")) return { key: "linux", name: "Linux", asset: ".deb or AppImage" };
  return { key: "generic", name: "your OS", asset: "installer" };
}

const platform = getPlatform();
if (primaryDownload && downloadIcon && downloadLabel && downloadNote) {
  downloadIcon.className = `platform-icon download-icon ${platform.key}`;
  downloadLabel.textContent = `Download for ${platform.name}`;
  downloadNote.textContent = `We detected ${platform.name}. Choose the ${platform.asset} file on the latest GitHub release.`;
}

setTheme(savedTheme);
updateActiveSection();
