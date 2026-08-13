(() => {
    "use strict";

    const root = document.documentElement;
    const toggle = document.querySelector("[data-qmah-theme-toggle]");
    const label = toggle?.querySelector("[data-qmah-theme-label]");

    function applyTheme(theme) {
        const isDark = theme === "dark";
        root.dataset.bsTheme = theme;
        localStorage.setItem("qmah-admin-theme", theme);

        if (toggle) {
            toggle.setAttribute("aria-pressed", String(isDark));
            toggle.setAttribute("aria-label", `切換為${isDark ? "淺色" : "深色"}模式`);
        }

        if (label) {
            label.textContent = isDark ? "淺色" : "深色";
        }
    }

    applyTheme(root.dataset.bsTheme === "dark" ? "dark" : "light");
    toggle?.addEventListener("click", () => {
        applyTheme(root.dataset.bsTheme === "dark" ? "light" : "dark");
    });
})();
