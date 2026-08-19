(() => {
    "use strict";

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
