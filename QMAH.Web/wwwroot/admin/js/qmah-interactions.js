(() => {
    "use strict";

    // 確認視窗是漸進增強；Tabler 未載入、載入失敗或新分頁操作仍沿用原始連結。
    document.querySelectorAll("a[data-qmah-site-switch]").forEach((link) => {
        link.addEventListener("click", (event) => {
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            const element = document.getElementById(link.dataset.qmahSiteSwitch);
            const Modal = window.bootstrap?.Modal ?? window.tabler?.Modal;
            if (!element || !Modal) return;
            try {
                Modal.getOrCreateInstance(element).show(link);
                event.preventDefault();
            } catch {
                // 保留原始連結，避免確認視窗的錯誤封鎖站台切換。
            }
        });
    });

    const Tooltip = window.bootstrap?.Tooltip;
    if (Tooltip) {
        document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((element) => {
            Tooltip.getOrCreateInstance(element);
        });
    }

    document.querySelectorAll(".navbar-vertical .nav-link").forEach((link) => {
        link.addEventListener("pointerdown", () => {
            link.classList.add("qmah-nav-pressed");
        });

        ["pointerup", "pointerleave", "blur"].forEach((eventName) => {
            link.addEventListener(eventName, () => {
                link.classList.remove("qmah-nav-pressed");
            });
        });
    });
})();
