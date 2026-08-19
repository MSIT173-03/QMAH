(() => {
    "use strict";

    const root = document.documentElement;
    const toggle = document.querySelector("[data-qmah-theme-toggle]");
    const wash = document.querySelector("[data-qmah-theme-wash]");
    const themeColor = document.querySelector("[data-qmah-theme-color]");
    const sidebarToggle = document.querySelector("[data-qmah-sidebar-toggle]");
    const mobileSidebarToggle = document.querySelector("[data-qmah-mobile-sidebar-toggle]");
    const mobileSidebar = document.querySelector("#admin-sidebar-menu");
    const mobileSidebarBackdrop = document.querySelector("[data-qmah-sidebar-backdrop]");
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const themeStorageKey = "qmah-admin-theme";
    let switchingTheme = false;

    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-qmah-image-preview]");
        const target = document.querySelector("[data-qmah-image-preview-target]");
        if (trigger && target) target.src = trigger.dataset.qmahImagePreview;
    });

    function syncThemeUi() {
        const isDark = root.dataset.bsTheme === "dark";
        toggle?.setAttribute("aria-pressed", String(isDark));
        toggle?.setAttribute("aria-label", isDark ? "切換淺色模式" : "切換深色模式");
        themeColor?.setAttribute("content", isDark ? "#10191c" : "#f3f6f4");
    }

    function applyTheme(theme, persist = true) {
        root.dataset.bsTheme = theme;
        root.style.colorScheme = theme;

        if (persist) {
            localStorage.setItem(themeStorageKey, theme);
        }

        syncThemeUi();
    }

    async function switchTheme(theme, persist = true) {
        if (switchingTheme) return;

        if (!wash || reduceMotion.matches) {
            applyTheme(theme, persist);
            return;
        }

        switchingTheme = true;
        toggle?.setAttribute("disabled", "");
        wash.style.backgroundColor = theme === "dark" ? "#10191c" : "#f3f6f4";

        try {
            const cover = wash.animate(
                [{ opacity: 0 }, { opacity: .90 }],
                {
                    duration: 360,
                    easing: "cubic-bezier(.4, 0, .2, 1)",
                    fill: "forwards"
                });

            await cover.finished;
            wash.style.opacity = ".90";
            cover.cancel();

            applyTheme(theme, persist);

            const reveal = wash.animate(
                [{ opacity: .90 }, { opacity: 0 }],
                {
                    duration: 640,
                    easing: "cubic-bezier(.16, 1, .3, 1)",
                    fill: "forwards"
                });

            await reveal.finished;
        } catch {
            applyTheme(theme, persist);
        } finally {
            wash?.getAnimations().forEach(animation => animation.cancel());
            if (wash) wash.style.opacity = "0";
            toggle?.removeAttribute("disabled");
            switchingTheme = false;
        }
    }

    applyTheme(root.dataset.bsTheme === "dark" ? "dark" : "light", false);

    toggle?.addEventListener("click", () => {
        const nextTheme = root.dataset.bsTheme === "dark" ? "light" : "dark";
        void switchTheme(nextTheme);
    });

    window.addEventListener("storage", (event) => {
        if (event.key !== themeStorageKey) return;
        if (event.newValue !== "dark" && event.newValue !== "light") return;
        if (event.newValue === root.dataset.bsTheme) return;
        void switchTheme(event.newValue, false);
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

    window.matchMedia("(max-width: 1199.98px)")
        .addEventListener("change", () => applyMobileSidebar(false));

    document.querySelectorAll('form[method="post"], form:not([method])').forEach((form) => {
        form.addEventListener("submit", (event) => {
            const submitter = event.submitter
                || form.querySelector('button[type="submit"], input[type="submit"]');

            const isDangerous = submitter?.classList.contains("btn-danger")
                || submitter?.classList.contains("btn-outline-danger");

            if (isDangerous && !form.classList.contains("qmah-is-submitting")) {
                const message = submitter.dataset.confirm
                    || `確定要${submitter.textContent.trim() || "執行這項操作"}嗎？`;

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

/* 共用列表排序 */
(() => {
    "use strict";

    const tableSelector = "table.qmah-crud-table, table.game-admin-table";
    const skipLabels = new Set(["操作", "處理"]);
    const collator = new Intl.Collator("zh-Hant", {
        numeric: true,
        sensitivity: "base"
    });

    const sortRules = {
        era: [
            "史前", "夏", "商", "周", "春秋", "戰國", "秦", "漢",
            "三國", "晉", "南北朝", "隋", "唐", "五代", "宋", "遼",
            "金", "元", "明", "清", "民國", "近代", "現代"
        ]
    };

    function getHeaderLabel(header) {
        return header.dataset.sortLabel
            || header.childNodes[0]?.textContent?.trim()
            || header.textContent.trim();
    }

    function shouldSkipHeader(header) {
        const label = getHeaderLabel(header);

        return !label
            || skipLabels.has(label)
            || header.classList.contains("w-1")
            || header.classList.contains("qmah-action-cell")
            || header.classList.contains("qmah-no-sort")
            || header.hasAttribute("data-sort-disabled");
    }

    function createSortIcon(direction) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("aria-hidden", "true");
        svg.classList.add("icon", "qmah-sort-icon");

        const paths = direction === "asc"
            ? ["M12 5l0 14", "M18 11l-6 -6", "M6 11l6 -6"]
            : direction === "desc"
                ? ["M12 5l0 14", "M18 13l-6 6", "M6 13l6 6"]
                : ["M3 9l4 -4l4 4", "M7 5l0 14", "M21 15l-4 4l-4 -4", "M17 19l0 -14"];

        paths.forEach((d) => {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", d);
            svg.append(path);
        });

        return svg;
    }

    function setSortIcon(header, direction) {
        header.dataset.sortDirection = direction || "";

        const oldIcon = header.querySelector(".qmah-sort-icon");
        const icon = createSortIcon(direction);
        oldIcon?.replaceWith(icon);

        header.setAttribute(
            "aria-sort",
            direction === "asc"
                ? "ascending"
                : direction === "desc"
                    ? "descending"
                    : "none");
    }

    function normalizeEra(value) {
        const index = sortRules.era.findIndex((term) => value.includes(term));
        return `${String(index < 0 ? 999 : index).padStart(3, "0")}-${value}`;
    }

    function getCellValue(header, cell) {
        if (!cell) return "";

        const explicit = cell.dataset.sortValue;
        const value = (explicit ?? cell.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim();

        const label = getHeaderLabel(header);

        if (label.includes("年代")) {
            return normalizeEra(value);
        }

        return value;
    }

    function resetHeaders(headers, activeHeader) {
        headers.forEach((item) => {
            if (item !== activeHeader) {
                setSortIcon(item, "");
            }
        });
    }

    function sortCurrentPage(table, header, columnIndex) {
        const body = table.querySelector("tbody");
        if (!body) return;

        const headers = [...table.querySelectorAll("thead th")];
        const ascending = header.dataset.sortDirection !== "asc";
        const direction = ascending ? "asc" : "desc";

        resetHeaders(headers, header);
        setSortIcon(header, direction);

        const rows = [...body.querySelectorAll(":scope > tr")];
        const sortableRows = [];
        const fixedRows = [];

        rows.forEach((row, originalIndex) => {
            const cell = row.cells[columnIndex];

            if (!cell || row.querySelector("td[colspan]")) {
                fixedRows.push(row);
                return;
            }

            sortableRows.push({
                row,
                originalIndex,
                value: getCellValue(header, cell)
            });
        });

        sortableRows.sort((left, right) => {
            const compared = collator.compare(left.value, right.value);

            if (compared !== 0) {
                return compared * (ascending ? 1 : -1);
            }

            return left.originalIndex - right.originalIndex;
        });

        sortableRows.forEach((item) => body.append(item.row));
        fixedRows.forEach((row) => body.append(row));
    }

    function sortOnServer(header) {
        const sortKey = header.dataset.sortKey;
        if (!sortKey) return;

        const url = new URL(window.location.href);
        const currentSort = url.searchParams.get("sort");
        const currentDirection = url.searchParams.get("direction");
        const defaultDirection = header.dataset.sortDefaultDirection === "desc"
            ? "desc"
            : "asc";

        const nextDirection = currentSort === sortKey
            ? (currentDirection === "asc" ? "desc" : "asc")
            : defaultDirection;

        url.searchParams.set("sort", sortKey);
        url.searchParams.set("direction", nextDirection);

        if (url.searchParams.has("page")) {
            url.searchParams.set("page", "1");
        }

        window.location.assign(url.toString());
    }

    function initializeServerState(header) {
        const sortKey = header.dataset.sortKey;
        if (!sortKey) return;

        const url = new URL(window.location.href);

        if (url.searchParams.get("sort") !== sortKey) {
            return;
        }

        const direction = url.searchParams.get("direction") === "desc"
            ? "desc"
            : "asc";

        setSortIcon(header, direction);
    }

    document.querySelectorAll(tableSelector).forEach((table) => {
        const headers = [...table.querySelectorAll("thead th")];
        const body = table.querySelector("tbody");

        if (!body || !headers.length) {
            return;
        }

        headers.forEach((header, index) => {
            if (shouldSkipHeader(header)) {
                return;
            }

            const label = getHeaderLabel(header);

            header.classList.add("qmah-sortable-header");
            header.setAttribute("role", "button");
            header.setAttribute("tabindex", "0");
            header.setAttribute("title", `依${label}排序`);
            header.setAttribute("aria-label", `依${label}排序`);
            header.setAttribute("aria-sort", "none");

            if (!header.querySelector(".qmah-sort-icon")) {
                header.append(createSortIcon(""));
            }

            initializeServerState(header);

            const activate = (event) => {
                if (event?.target?.closest("a, button, input, select, textarea")) {
                    return;
                }

                if (header.dataset.sortKey) {
                    sortOnServer(header);
                    return;
                }

                sortCurrentPage(table, header, index);
            };

            header.addEventListener("click", activate);

            header.addEventListener("keydown", (event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                    return;
                }

                event.preventDefault();
                activate();
            });
        });
    });
})();
