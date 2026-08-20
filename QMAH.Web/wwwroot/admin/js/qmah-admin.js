(() => {
    "use strict";

    const root = document.documentElement;
    const toggle = document.querySelector("[data-qmah-theme-toggle]");
    const themeColor = document.querySelector("[data-qmah-theme-color]");
    const sidebarToggle = document.querySelector("[data-qmah-sidebar-toggle]");
    const mobileSidebarToggles = [...document.querySelectorAll("[data-qmah-mobile-sidebar-toggle]")];
    const mobileSidebar = document.querySelector("#admin-sidebar-menu");
    const mobileSidebarBackdrop = document.querySelector("[data-qmah-sidebar-backdrop]");
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const themeStorageKey = "qmah-admin-theme";
    let switchingTheme = false;

    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-qmah-image-preview]");
        const target = document.querySelector("[data-qmah-image-preview-target]");
        if (trigger && target) {
            target.src = trigger.dataset.qmahImagePreview;
        }
    });

    function syncThemeUi() {
        const isDark = root.dataset.bsTheme === "dark";
        toggle?.setAttribute("aria-pressed", String(isDark));
        toggle?.setAttribute("aria-label", isDark ? "切換淺色模式" : "切換深色模式");
        themeColor?.setAttribute("content", isDark ? "#151c1f" : "#f3f6f4");
    }

    function applyTheme(theme, persist = true) {
        root.dataset.bsTheme = theme;
        root.style.colorScheme = theme;

        if (persist) {
            localStorage.setItem(themeStorageKey, theme);
        }

        syncThemeUi();
    }

    function getThemeTransitionGeometry() {
        const rect = toggle?.getBoundingClientRect();

        const x = rect
            ? rect.left + rect.width / 2
            : window.innerWidth - 40;

        const y = rect
            ? rect.top + rect.height / 2
            : 32;

        const radius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y));

        return { x, y, radius };
    }

    function canUseThemeViewTransition() {
        if (reduceMotion.matches || !document.startViewTransition) {
            return false;
        }

        // Chromium 對長頁或窄螢幕做 root snapshot 較容易增加 renderer / GPU 壓力。
        // 這些情況直接切換主題，優先確保展示穩定。
        const isNarrowViewport = window.matchMedia("(max-width: 1199.98px)").matches;
        const isLongPage = document.documentElement.scrollHeight > window.innerHeight * 4;
        const lowMemoryDevice = Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory <= 4;

        return !isNarrowViewport && !isLongPage && !lowMemoryDevice;
    }

    async function switchTheme(theme, persist = true) {
        if (switchingTheme) {
            return;
        }

        switchingTheme = true;

        if (toggle) {
            toggle.disabled = true;
        }

        try {
            if (!canUseThemeViewTransition()) {
                applyTheme(theme, persist);
                return;
            }

            const isDark = theme === "dark";
            const { x, y, radius } = getThemeTransitionGeometry();

            root.dataset.qmahThemeTransition =
                isDark ? "to-dark" : "to-light";

            root.classList.add("qmah-theme-switching");

            const transition = document.startViewTransition(() => {
                applyTheme(theme, persist);
            });

            await transition.ready;

            const full = `circle(${radius}px at ${x}px ${y}px)`;
            const point = `circle(0px at ${x}px ${y}px)`;

            const animation = root.animate(
                isDark
                    ? [
                        { clipPath: full },
                        { clipPath: point }
                    ]
                    : [
                        { clipPath: point },
                        { clipPath: full }
                    ],
                {
                    duration: isDark ? 360 : 420,
                    easing: isDark
                        ? "cubic-bezier(.4, 0, .2, 1)"
                        : "cubic-bezier(.16, 1, .3, 1)",
                    fill: "both",
                    pseudoElement: isDark
                        ? "::view-transition-old(root)"
                        : "::view-transition-new(root)"
                });

            await animation.finished;
            await transition.finished;
        } catch {
            if (root.dataset.bsTheme !== theme) {
                applyTheme(theme, persist);
            }
        } finally {
            delete root.dataset.qmahThemeTransition;
            root.classList.remove("qmah-theme-switching");

            if (toggle) {
                toggle.disabled = false;
            }

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
        if (!mobileSidebar || mobileSidebarToggles.length === 0 || !mobileSidebarBackdrop) {
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
        mobileSidebarToggles.forEach((button) => {
            button.setAttribute("aria-expanded", String(open));
            button.setAttribute("aria-label", open ? "關閉側邊導覽" : "開啟側邊導覽");
        });
        mobileSidebarBackdrop.classList.toggle("is-visible", open);
        document.body.classList.toggle("qmah-sidebar-open", open);
    }

    applyMobileSidebar(false);

    mobileSidebarToggles.forEach((button) => {
        button.addEventListener("click", () => {
            applyMobileSidebar(!mobileSidebar?.classList.contains("show"));
        });
    });

    mobileSidebarBackdrop?.addEventListener("click", () => applyMobileSidebar(false));

    mobileSidebar?.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => applyMobileSidebar(false));
    });

    document.querySelectorAll(".qmah-sidebar-subnav .nav-link").forEach((link) => {
        const press = () => {
            link.classList.add("qmah-nav-press");
            window.setTimeout(() => link.classList.remove("qmah-nav-press"), 160);
        };

        link.addEventListener("pointerdown", press, { passive: true });
        link.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                press();
            }
        });
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
            if (form.dataset.qmahConfirmPending === "true") {
                return;
            }

            if (form.classList.contains("qmah-is-submitting")) {
                event.preventDefault();
                return;
            }

            form.classList.add("qmah-is-submitting");
            form.setAttribute("aria-busy", "true");

            const submitter = event.submitter
                || form.querySelector('button[type="submit"], input[type="submit"]');

            if (submitter && !submitter.disabled) {
                submitter.disabled = true;
                submitter.textContent = "處理中…";
            }
        });
    });
})();

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
        const icon = document.createElement("i");
        icon.className = `ti ${
            direction === "asc"
                ? "ti-sort-ascending-2"
                : direction === "desc"
                    ? "ti-sort-descending-2"
                    : "ti-arrows-sort"
        } qmah-sort-icon`;
        icon.setAttribute("aria-hidden", "true");
        return icon;
    }

    function setSortIcon(header, direction) {
        header.dataset.sortDirection = direction || "";

        const oldIcon = header.querySelector(".qmah-sort-icon");
        const icon = createSortIcon(direction);

        if (oldIcon) {
            oldIcon.replaceWith(icon);
        } else {
            header.append(icon);
        }

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


(() => {
    "use strict";

    const listTables = document.querySelectorAll(".page-body table");

    listTables.forEach((table) => {
        if (table.hasAttribute("data-qmah-mobile-table-disabled")) {
            return;
        }

        const headers = [...table.querySelectorAll(":scope > thead th")];
        const rows = [...table.querySelectorAll(":scope > tbody > tr")];

        // 複合資料清單統一轉成手機卡片；簡單 1～2 欄資料表保留原樣。
        if (headers.length < 3 || rows.length === 0) {
            return;
        }

        table.classList.add("qmah-mobile-list");

        const labels = headers.map((header) => {
            const clone = header.cloneNode(true);
            clone.querySelectorAll(".qmah-sort-icon").forEach((icon) => icon.remove());
            return (clone.textContent || "").replace(/\s+/g, " ").trim();
        });

        rows.forEach((row) => {
            [...row.cells].forEach((cell, index) => {
                if (cell.hasAttribute("colspan")) {
                    return;
                }

                const explicit = cell.dataset.label?.trim();
                let label = explicit || labels[index] || "資料";

                if ((label === "預設排序" || label === "排序")
                    && cell.querySelector("img, .avatar, [data-qmah-image-preview]")) {
                    label = "圖片";
                }

                cell.dataset.qmahMobileLabel = label;

                const header = headers[index];
                const sortable = header?.classList.contains("qmah-sortable-header")
                    && !["操作", "處理", "圖片", "預設排序", "排序"].includes(label)
                    && !cell.querySelector("a, button, input, select, textarea, form, [data-qmah-image-preview]");

                if (sortable) {
                    cell.classList.add("qmah-mobile-sortable-cell");
                    cell.dataset.qmahMobileSortIndex = String(index);
                    cell.setAttribute("role", "button");
                    cell.setAttribute("tabindex", "0");
                    cell.setAttribute("title", `依${label}排序`);
                }
            });
        });

        async function requestMobileSort(cell) {
            if (!window.matchMedia("(max-width: 767.98px)").matches) {
                return;
            }

            const index = Number.parseInt(cell.dataset.qmahMobileSortIndex || "", 10);
            const header = headers[index];

            if (!header) {
                return;
            }

            const label = cell.dataset.qmahMobileLabel || "此欄位";
            const confirmed = await window.qmahConfirm({
                title: "排序清單",
                message: `要依「${label}」排序嗎？`,
                confirmText: "排序",
                danger: false,
                icon: "ti-arrows-sort"
            });

            if (confirmed) {
                header.click();
            }
        }

        table.addEventListener("click", (event) => {
            const cell = event.target.closest(".qmah-mobile-sortable-cell");
            if (!cell || !table.contains(cell)) {
                return;
            }

            if (event.target.closest("a, button, input, select, textarea, form, [data-qmah-image-preview]")) {
                return;
            }

            void requestMobileSort(cell);
        });

        table.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") {
                return;
            }

            const cell = event.target.closest(".qmah-mobile-sortable-cell");
            if (!cell || !table.contains(cell)) {
                return;
            }

            event.preventDefault();
            void requestMobileSort(cell);
        });
    });
})();


(() => {
    "use strict";

    const destructivePattern = /(刪除|移除|停用|停權|下架|取消|隱藏|封鎖|撤銷|清除)/;
    const inlineConfirmPattern = /(?:window\.)?confirm\s*\(\s*(['"])(.*?)\1\s*\)/i;
    let pendingResolve = null;

    function normalizeConfirmTriggers() {
        document.querySelectorAll("[onclick]").forEach((element) => {
            const source = element.getAttribute("onclick") || "";
            const match = source.match(inlineConfirmPattern);
            if (!match) return;

            element.dataset.qmahConfirm = match[2];
            element.removeAttribute("onclick");
        });
    }

    function ensureDialog() {
        let dialog = document.querySelector("[data-qmah-confirm-dialog]");
        if (dialog) return dialog;

        dialog = document.createElement("dialog");
        dialog.className = "qmah-native-dialog";
        dialog.dataset.qmahConfirmDialog = "";
        dialog.innerHTML = `
            <div class="qmah-native-dialog__panel">
                <div class="qmah-native-dialog__header">
                    <span class="qmah-native-dialog__icon" data-qmah-dialog-icon aria-hidden="true">
                        <i class="ti ti-alert-triangle"></i>
                    </span>
                    <h2 class="qmah-native-dialog__title" data-qmah-dialog-title>確認操作</h2>
                    <button type="button"
                            class="btn-close ms-auto"
                            data-qmah-dialog-cancel
                            aria-label="關閉"></button>
                </div>
                <div class="qmah-native-dialog__body">
                    <p class="qmah-native-dialog__message mb-0" data-qmah-dialog-message></p>
                </div>
                <div class="qmah-native-dialog__footer">
                    <button type="button"
                            class="btn btn-outline-secondary"
                            data-qmah-dialog-cancel>
                        取消
                    </button>
                    <button type="button"
                            class="btn btn-danger"
                            data-qmah-dialog-confirm>
                        確定
                    </button>
                </div>
            </div>`;

        document.body.append(dialog);

        const settle = (value) => {
            const resolve = pendingResolve;
            pendingResolve = null;

            if (dialog.open) {
                dialog.close();
            }

            resolve?.(value);
        };

        dialog.querySelectorAll("[data-qmah-dialog-cancel]").forEach((button) => {
            button.addEventListener("click", () => settle(false));
        });

        dialog.querySelector("[data-qmah-dialog-confirm]")?.addEventListener("click", () => {
            settle(true);
        });

        dialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            settle(false);
        });

        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) {
                settle(false);
            }
        });

        return dialog;
    }

    window.qmahConfirm = ({
        title = "確認操作",
        message,
        confirmText = "確定",
        danger = true,
        icon = "ti-alert-triangle"
    }) => {
        if (!message) {
            return Promise.resolve(false);
        }

        if (!("HTMLDialogElement" in window)) {
            return Promise.resolve(window.confirm(message));
        }

        const dialog = ensureDialog();
        const confirmButton = dialog.querySelector("[data-qmah-dialog-confirm]");
        const iconBox = dialog.querySelector("[data-qmah-dialog-icon]");
        const iconElement = iconBox?.querySelector("i");

        dialog.querySelector("[data-qmah-dialog-title]").textContent = title;
        dialog.querySelector("[data-qmah-dialog-message]").textContent = message;
        confirmButton.textContent = confirmText;

        confirmButton.classList.toggle("btn-danger", danger);
        confirmButton.classList.toggle("btn-primary", !danger);
        iconBox?.classList.toggle("qmah-native-dialog__icon--danger", danger);

        if (iconElement) {
            iconElement.className = `ti ${icon}`;
        }

        if (dialog.open) {
            dialog.close();
        }

        return new Promise((resolve) => {
            pendingResolve = resolve;
            dialog.showModal();
            confirmButton.focus();
        });
    };

    function getMessage(trigger) {
        const explicit = trigger.dataset.qmahConfirm?.trim();
        if (explicit) return explicit;

        const label = trigger.textContent?.replace(/\s+/g, " ").trim() || "執行這項操作";
        return `確定要${label}嗎？`;
    }

    normalizeConfirmTriggers();

    document.addEventListener("click", async (event) => {
        const trigger = event.target.closest("[data-qmah-confirm], .btn-danger, .btn-outline-danger");
        if (!trigger || trigger.dataset.qmahConfirmBypass === "true" || trigger.disabled) {
            return;
        }

        const form = trigger.closest("form");
        const isSubmitter = form
            && trigger.matches('button:not([type]), button[type="submit"], input[type="submit"]');

        if (!trigger.dataset.qmahConfirm
            && !isSubmitter
            && !trigger.matches("a[href]")) {
            return;
        }

        event.preventDefault();

        const message = getMessage(trigger);
        const destructive = trigger.classList.contains("btn-danger")
            || trigger.classList.contains("btn-outline-danger")
            || destructivePattern.test(message);

        const confirmed = await window.qmahConfirm({
            title: "確認操作",
            message,
            confirmText: "確定",
            danger: destructive
        });

        if (!confirmed) {
            return;
        }

        if (isSubmitter) {
            form.dataset.qmahConfirmPending = "true";

            try {
                form.requestSubmit(trigger);
            } finally {
                window.setTimeout(() => {
                    delete form.dataset.qmahConfirmPending;
                }, 0);
            }

            return;
        }

        if (trigger.matches("a[href]")) {
            window.location.assign(trigger.href);
            return;
        }

        trigger.dataset.qmahConfirmBypass = "true";
        trigger.click();
        delete trigger.dataset.qmahConfirmBypass;
    }, true);
})();
