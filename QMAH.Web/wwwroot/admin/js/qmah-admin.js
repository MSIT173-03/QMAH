(() => {
    "use strict";

    const root = document.documentElement;
    const toggle = document.querySelector("[data-qmah-theme-toggle]");
    const label = toggle?.querySelector("[data-qmah-theme-label]");
    const sidebarToggle = document.querySelector("[data-qmah-sidebar-toggle]");
    const mobileSidebarToggle = document.querySelector("[data-qmah-mobile-sidebar-toggle]");
    const mobileSidebar = document.querySelector("#admin-sidebar-menu");
    const mobileSidebarBackdrop = document.querySelector("[data-qmah-sidebar-backdrop]");
    const themeSwitchingClass = "qmah-theme-switching";

    function applyTheme(theme) {
        const isDark = theme === "dark";
        root.dataset.bsTheme = theme;
        root.style.colorScheme = theme;
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
    async function switchTheme(nextTheme) {
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

        root.dataset.qmahThemeTransition = switchingToDark ? "to-dark" : "to-light";
        root.classList.add(themeSwitchingClass);
        try {
            const transition = document.startViewTransition(() => applyTheme(nextTheme));
            await transition.ready;
            const reveal = root.animate(
                {
                    clipPath: switchingToDark
                        ? [
                            `circle(${radius}px at ${x}px ${y}px)`,
                            `circle(0px at ${x}px ${y}px)`
                        ]
                        : [
                            `circle(0px at ${x}px ${y}px)`,
                            `circle(${radius}px at ${x}px ${y}px)`
                        ]
                },
                {
                    duration: 720,
                    easing: "cubic-bezier(.4, 0, .2, 1)",
                    fill: "both",
                    pseudoElement: switchingToDark
                        ? "::view-transition-old(root)"
                        : "::view-transition-new(root)"
                });

            await Promise.allSettled([transition.finished, reveal.finished]);
        } catch {
            applyTheme(nextTheme);
        } finally {
            delete root.dataset.qmahThemeTransition;
            root.classList.remove(themeSwitchingClass);
        }
    }

    toggle?.addEventListener("click", () => {
        if (root.classList.contains(themeSwitchingClass)) {
            return;
        }

        void switchTheme(root.dataset.bsTheme === "dark" ? "light" : "dark");
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

    function isDrawerLayout() {
        return window.matchMedia("(max-width: 1199.98px)").matches;
    }

    function applyMobileSidebar(open) {
        if (!mobileSidebar || !mobileSidebarToggle || !mobileSidebarBackdrop) {
            return;
        }

        if (!isDrawerLayout()) {
            mobileSidebar.classList.remove("show");
            mobileSidebar.removeAttribute("aria-hidden");
            mobileSidebarBackdrop.classList.remove("is-visible");
            document.body.classList.remove("qmah-sidebar-open");
            return;
        }

        mobileSidebar.classList.toggle("show", open);
        mobileSidebar.setAttribute("aria-hidden", String(!open));
        mobileSidebarToggle.setAttribute("aria-expanded", String(open));
        mobileSidebarToggle.setAttribute("aria-label", open ? "關閉側邊導覽" : "開啟側邊導覽");
        mobileSidebarBackdrop.classList.toggle("is-visible", open);
        document.body.classList.toggle("qmah-sidebar-open", open);
    }

    applyMobileSidebar(false);
    mobileSidebarToggle?.addEventListener("click", () => {
        applyMobileSidebar(!mobileSidebar?.classList.contains("show"));
    });
    mobileSidebarBackdrop?.addEventListener("click", () => applyMobileSidebar(false));
    mobileSidebar?.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => applyMobileSidebar(false));
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            applyMobileSidebar(false);
        }
    });
    window.matchMedia("(max-width: 1199.98px)").addEventListener("change", () => applyMobileSidebar(false));
})();
