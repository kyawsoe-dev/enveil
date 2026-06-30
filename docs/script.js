const themeButtons = document.querySelectorAll("[data-theme-choice]");
const savedTheme = localStorage.getItem("enveil-docs-theme") || "system";
const menuButton = document.querySelector(".menu-button");
const mobileMenu = document.querySelector("#mobile-menu");
const primaryDownload = document.querySelector("#primary-download");
const downloadNote = document.querySelector("#download-note");

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
  mobileMenu.dataset.open = String(open);
}

menuButton?.addEventListener("click", () => {
  setMenu(menuButton.getAttribute("aria-expanded") !== "true");
});

mobileMenu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
});

function getPlatform() {
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  const agent = navigator.userAgent || "";
  const value = `${platform} ${agent}`.toLowerCase();

  if (value.includes("mac")) return { name: "macOS", asset: ".dmg" };
  if (value.includes("win")) return { name: "Windows", asset: ".msi" };
  if (value.includes("linux")) return { name: "Linux", asset: ".deb or AppImage" };
  return { name: "your OS", asset: "installer" };
}

const platform = getPlatform();
if (primaryDownload && downloadNote) {
  primaryDownload.textContent = `Download for ${platform.name}`;
  downloadNote.textContent = `We detected ${platform.name}. Choose the ${platform.asset} file on the latest GitHub release.`;
}

setTheme(savedTheme);
