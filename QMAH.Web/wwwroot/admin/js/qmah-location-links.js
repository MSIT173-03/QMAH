(() => {
    "use strict";

    // 所有管理區共用同一套地點連結邏輯；活動、貼文、會員地址與未來商城地址
    // 只要提供 data-qmah-map-link，就不需要各自複製座標驗證與 OpenStreetMap URL 組合。
    function readField(link, selectorName, fallbackValue) {
        const selector = link.dataset[selectorName];
        if (!selector) return fallbackValue || "";

        try {
            const values = [...document.querySelectorAll(selector)]
                .map((field) => field.value?.trim())
                .filter(Boolean);
            return values.join(" ") || fallbackValue || "";
        } catch {
            return fallbackValue || "";
        }
    }

    function updateLink(link) {
        const location = readField(link, "qmahMapLocationInput", link.dataset.qmahMapLocation);
        const latitudeText = readField(link, "qmahMapLatitudeInput", link.dataset.qmahMapLatitude);
        const longitudeText = readField(link, "qmahMapLongitudeInput", link.dataset.qmahMapLongitude);
        const latitude = Number(latitudeText);
        const longitude = Number(longitudeText);
        // 空白座標不能轉成 0，避免尚未選址時誤開啟赤道地圖。
        const hasCoordinates = latitudeText.length > 0
            && longitudeText.length > 0
            && Number.isFinite(latitude)
            && Number.isFinite(longitude)
            && latitude >= -90
            && latitude <= 90
            && longitude >= -180
            && longitude <= 180;

        if (!location && !hasCoordinates) {
            link.hidden = true;
            link.removeAttribute("href");
            return;
        }

        const encodedLocation = encodeURIComponent(location);
        link.href = hasCoordinates
            ? `https://www.openstreetmap.org/?mlat=${latitude.toFixed(6)}&mlon=${longitude.toFixed(6)}#map=17/${latitude.toFixed(6)}/${longitude.toFixed(6)}`
            : `https://www.openstreetmap.org/search?query=${encodedLocation}`;
        link.hidden = false;
    }

    function updateFormLinks(target) {
        const form = target.closest("form");
        if (!form) return;
        form.querySelectorAll("[data-qmah-map-link]").forEach(updateLink);
    }

    document.querySelectorAll("[data-qmah-map-link]").forEach(updateLink);
    document.addEventListener("input", (event) => updateFormLinks(event.target));
    document.addEventListener("change", (event) => updateFormLinks(event.target));
})();
