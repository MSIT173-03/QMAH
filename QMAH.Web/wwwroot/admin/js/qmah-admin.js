(() => {
    "use strict";

    const root = document.documentElement;
    const toggle = document.querySelector("[data-qmah-theme-toggle]");
    const label = toggle?.querySelector("[data-qmah-theme-label]");
    const sidebarToggle = document.querySelector("[data-qmah-sidebar-toggle]");

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
    toggle?.addEventListener("click", async () => {
        const nextTheme = root.dataset.bsTheme === "dark" ? "light" : "dark";
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (!document.startViewTransition || reduceMotion) {
            applyTheme(nextTheme);
            return;
        }

        const rect = toggle.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const radius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y));
        const switchingToDark = nextTheme === "dark";
        const transition = document.startViewTransition(() => applyTheme(nextTheme));

        await transition.ready;
        root.animate(
            {
                clipPath: switchingToDark
                    ? [`circle(${radius}px at ${x}px ${y}px)`, `circle(0 at ${x}px ${y}px)`]
                    : [`circle(0 at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]
            },
            {
                duration: 520,
                easing: "cubic-bezier(.4, 0, .2, 1)",
                pseudoElement: switchingToDark
                    ? "::view-transition-old(root)"
                    : "::view-transition-new(root)"
            });
    });

    function applySidebar(collapsed) {
        if (collapsed) {
            root.dataset.qmahSidebar = "collapsed";
        } else {
            delete root.dataset.qmahSidebar;
        }

        localStorage.setItem("qmah-admin-sidebar", collapsed ? "collapsed" : "expanded");

        if (sidebarToggle) {
            sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
            sidebarToggle.setAttribute("aria-label", collapsed ? "展開側邊欄" : "收合側邊欄");
            sidebarToggle.setAttribute("title", collapsed ? "展開側邊欄" : "收合側邊欄");
        }

    }

    applySidebar(root.dataset.qmahSidebar === "collapsed");
    sidebarToggle?.addEventListener("click", () => {
        applySidebar(root.dataset.qmahSidebar !== "collapsed");
    });
})();
