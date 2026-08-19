(() => {
    "use strict";

    const root = document.documentElement;
    const toggle = document.querySelector("[data-qmah-theme-toggle]");
    const label = toggle?.querySelector("[data-qmah-theme-label]");
    const sidebarToggle = document.querySelector("[data-qmah-sidebar-toggle]");
    const mobileSidebarToggle = document.querySelector("[data-qmah-mobile-sidebar-toggle]");
    const mobileSidebar = document.querySelector("#admin-sidebar-menu");
    const mobileSidebarBackdrop = document.querySelector("[data-qmah-sidebar-backdrop]");
    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-qmah-image-preview]");
        const target = document.querySelector("[data-qmah-image-preview-target]");
        if (trigger && target) target.src = trigger.dataset.qmahImagePreview;
    });
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

    document.querySelectorAll('form[method="post"], form:not([method])').forEach((form) => {
        form.addEventListener("submit", (event) => {
            const submitter = event.submitter || form.querySelector('button[type="submit"], input[type="submit"]');
            const isDangerous = submitter?.classList.contains("btn-danger") || submitter?.classList.contains("btn-outline-danger");

            if (isDangerous && !form.classList.contains("qmah-is-submitting")) {
                const message = submitter.dataset.confirm || `確定要${submitter.textContent.trim() || "執行這項操作"}嗎？`;
                if (!window.confirm(message)) {
                    event.preventDefault();
                    return;
                }
            }

            if (form.classList.contains("qmah-is-submitting")) {
                event.preventDefault();
                return;
            }

            form.classList.add("qmah-is-submitting");
            form.setAttribute("aria-busy", "true");
            if (submitter && !submitter.disabled) {
                submitter.disabled = true;
                submitter.textContent = "處理中…";
            }
        });
    });
})();

// 共用管理清單排序：不改動既有查詢與 CRUD，只重新排列目前頁面的資料列。
(() => {
    // 可持續擴充的管理清單排序規則；未列出的值會回到一般繁中排序。
    const sortRules = {
        era: ["史前", "夏", "商", "周", "春秋", "戰國", "秦", "漢", "三國", "晉", "南北朝", "隋", "唐", "五代", "宋", "遼", "金", "元", "明", "清", "民國", "近代", "現代"],
        category: []
    };
    const getSortValue = (header, value) => {
        const label = header.textContent.trim();
        if (label.includes("年代")) {
            const index = sortRules.era.findIndex((term) => value.includes(term));
            return `${String(index < 0 ? 999 : index).padStart(3, "0")}-${value}`;
        }
        if (label.includes("分類")) {
            const index = sortRules.category.indexOf(value);
            return `${String(index < 0 ? 999 : index).padStart(3, "0")}-${value}`;
        }
        return value;
    };
    const tables = document.querySelectorAll("table.qmah-crud-table, table.game-admin-table");
    tables.forEach((table) => {
        const headers = table.querySelectorAll("thead th");
        const body = table.querySelector("tbody");
        if (!body || !headers.length) return;

        headers.forEach((header, index) => {
            const label = header.textContent.trim();
            if (!label || label === "操作" || label === "處理" || header.classList.contains("w-1")) return;
            header.classList.add("qmah-sortable-header");
            header.setAttribute("role", "button");
            header.setAttribute("tabindex", "0");
            header.setAttribute("title", `依${label}排序`);
            const icon = document.createElement("i");
            icon.className = "ti ti-selector qmah-sort-icon ms-1";
            icon.setAttribute("aria-hidden", "true");
            header.append(icon);

            const sort = () => {
                const ascending = header.dataset.sortDirection !== "asc";
                headers.forEach((item) => {
                    item.dataset.sortDirection = "";
                    const oldIcon = item.querySelector(".qmah-sort-icon");
                    if (oldIcon) oldIcon.className = "ti ti-selector qmah-sort-icon ms-1";
                });
                header.dataset.sortDirection = ascending ? "asc" : "desc";
                icon.className = `ti ti-chevron-${ascending ? "up" : "down"} qmah-sort-icon ms-1`;
                [...body.querySelectorAll(":scope > tr")]
                    .sort((a, b) => {
                        const left = getSortValue(header, a.cells[index]?.textContent.trim() ?? "");
                        const right = getSortValue(header, b.cells[index]?.textContent.trim() ?? "");
                        return left.localeCompare(right, "zh-Hant", { numeric: true, sensitivity: "base" }) * (ascending ? 1 : -1);
                    })
                    .forEach((row) => body.append(row));
            };
            header.addEventListener("click", sort);
            header.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); sort(); }
            });
        });
    });
})();
