// 後台活動表單的地圖選點：Leaflet + OpenStreetMap，不需要 API 金鑰。
// 使用方式：在頁面放 <div data-qmah-location-picker data-location-input="#Location"
//   data-latitude-input="#Latitude" data-longitude-input="#Longitude"></div>，
// 點地圖或拖曳圖釘會填入緯度／經度，並用 Nominatim 反查地址文字填進地點欄位。
// Nominatim 有「每秒最多 1 次」的使用規範，所以只在點擊／拖曳／按搜尋時查詢。
(() => {
    'use strict';

    const root = document.querySelector('[data-qmah-location-picker]');
    if (!root) return;

    const locationInput = document.querySelector(root.dataset.locationInput);
    const latitudeInput = document.querySelector(root.dataset.latitudeInput);
    const longitudeInput = document.querySelector(root.dataset.longitudeInput);
    if (!locationInput || !latitudeInput || !longitudeInput) return;

    const LEAFLET_VERSION = '1.9.4';
    const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

    // 台灣地址組成「XX市XX區XX路XX巷XX號」；缺路名或不是台灣就退回 display_name。
    const formatAddress = (item) => {
        const fallback = typeof item.display_name === 'string' ? item.display_name.trim() : '';
        const a = item.address;
        if (!a || a.country_code !== 'tw' || !a.road) return fallback;
        const city = a.county || a.city || a.state || '';
        const district = a.city_district || a.town || a.township || (a.suburb && !/[里村]$/.test(a.suburb) ? a.suburb : '');
        const number = a.house_number ? (a.house_number.includes('號') ? a.house_number : `${a.house_number}號`) : '';
        return `${city}${district}${a.road}${number}`.trim() || fallback;
    };
    const DEFAULT_CENTER = [25.033, 121.5654];
    const MAX_LOCATION_LENGTH = 200; // 與 Event.Location 長度上限一致
    const PIN_HTML = '<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true" focusable="false" style="display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))"><path d="M14 0C6.3 0 0 6.2 0 13.8 0 24 14 36 14 36s14-12 14-22.2C28 6.2 21.7 0 14 0z" fill="#d9480f" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="#fff"/></svg>';

    // ---- 畫面骨架（只放固定文字；外部服務回傳的資料一律用 textContent，避免注入） ----
    root.innerHTML = `
        <div class="input-group mb-2">
            <input type="search" class="form-control" placeholder="搜尋場館或地址，例如：台北 101" aria-label="搜尋地點" data-picker-query>
            <button type="button" class="btn btn-outline-secondary" data-picker-search>搜尋</button>
        </div>
        <div class="list-group mb-2" data-picker-results hidden style="max-height: 11rem; overflow-y: auto;"></div>
        <div data-picker-map role="application" aria-label="地點選擇地圖：點擊地圖放置圖釘，或拖曳圖釘微調位置"
             style="height: 20rem; border: 1px solid var(--tblr-border-color, #dee2e6); border-radius: .5rem; isolation: isolate;"></div>
        <div class="d-flex justify-content-between align-items-center gap-2 mt-2">
            <span class="form-hint" data-picker-message aria-live="polite"></span>
            <button type="button" class="btn btn-sm btn-ghost-secondary" data-picker-clear hidden>清除位置</button>
        </div>`;

    const queryInput = root.querySelector('[data-picker-query]');
    const searchButton = root.querySelector('[data-picker-search]');
    const resultsBox = root.querySelector('[data-picker-results]');
    const mapBox = root.querySelector('[data-picker-map]');
    const messageBox = root.querySelector('[data-picker-message]');
    const clearButton = root.querySelector('[data-picker-clear]');

    const DEFAULT_MESSAGE = '點擊地圖放置圖釘，也可以拖曳圖釘微調位置。';
    const setMessage = (text) => { messageBox.textContent = text ?? DEFAULT_MESSAGE; };
    setMessage(null);

    // ---- 小工具 ----
    const round6 = (value) => Math.round(value * 1e6) / 1e6;
    const isValidPoint = (lat, lng) =>
        Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    const readNumber = (input) => {
        const text = input.value.trim();
        return text === '' ? Number.NaN : Number(text);
    };
    // 程式填值後也要通知其他監聽者（例如「在地圖查看位置」連結、表單驗證）。
    const writeValue = (input, value) => {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    let leafletPromise = null;
    const loadLeaflet = () => {
        if (leafletPromise) return leafletPromise;
        leafletPromise = new Promise((resolve, reject) => {
            if (window.L) { resolve(window.L); return; }
            const base = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist`;
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = `${base}/leaflet.css`;
            css.crossOrigin = '';
            document.head.appendChild(css);
            const script = document.createElement('script');
            script.src = `${base}/leaflet.js`;
            script.async = true;
            script.crossOrigin = '';
            script.onload = () => resolve(window.L);
            script.onerror = () => { leafletPromise = null; reject(new Error('Leaflet 載入失敗')); };
            document.head.appendChild(script);
        });
        return leafletPromise;
    };

    let map = null;
    let marker = null;
    let requestId = 0;

    const refreshClearButton = () => {
        clearButton.hidden = !isValidPoint(readNumber(latitudeInput), readNumber(longitudeInput));
    };

    const placeMarker = (lat, lng) => {
        if (!map) return;
        if (marker) { marker.setLatLng([lat, lng]); return; }
        const icon = window.L.divIcon({ className: '', html: PIN_HTML, iconSize: [28, 36], iconAnchor: [14, 36] });
        marker = window.L.marker([lat, lng], { icon, draggable: true, title: '活動地點（可拖曳）' }).addTo(map);
        marker.on('dragend', () => {
            const position = marker.getLatLng();
            selectPoint(position.lat, position.lng);
        });
    };

    // 點地圖／拖曳圖釘：先填座標，再反查地址；反查失敗時座標仍保留。
    const selectPoint = async (rawLat, rawLng) => {
        const lat = round6(rawLat);
        const lng = round6(rawLng);
        placeMarker(lat, lng);
        resultsBox.hidden = true;
        writeValue(latitudeInput, String(lat));
        writeValue(longitudeInput, String(lng));
        refreshClearButton();

        const id = ++requestId;
        setMessage('正在取得地址…');
        try {
            const response = await fetch(
                `${NOMINATIM_URL}/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=zh-TW&lat=${lat}&lon=${lng}`,
                { headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (id !== requestId) return;
            const name = formatAddress(data);
            if (name) {
                writeValue(locationInput, name.slice(0, MAX_LOCATION_LENGTH));
                setMessage(null);
            } else {
                setMessage('這個位置查不到地址，已記下座標；可以自己補上地址文字。');
            }
        } catch {
            if (id === requestId) setMessage('取得地址失敗（網路或服務忙碌），已記下座標；可以自己輸入地址文字。');
        }
    };

    const chooseResult = (result) => {
        resultsBox.hidden = true;
        const lat = round6(result.lat);
        const lng = round6(result.lng);
        if (map) map.setView([lat, lng], 17);
        placeMarker(lat, lng);
        writeValue(latitudeInput, String(lat));
        writeValue(longitudeInput, String(lng));
        writeValue(locationInput, result.name.slice(0, MAX_LOCATION_LENGTH));
        refreshClearButton();
        setMessage(null);
    };

    const search = async () => {
        const query = queryInput.value.trim();
        if (!query) return;
        const id = ++requestId;
        resultsBox.hidden = true;
        resultsBox.replaceChildren();
        setMessage('搜尋中…');
        try {
            const response = await fetch(
                `${NOMINATIM_URL}/search?format=jsonv2&addressdetails=1&countrycodes=tw&limit=5&accept-language=zh-TW&q=${encodeURIComponent(query)}`,
                { headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (id !== requestId) return;
            const found = data
                .map((item) => ({ name: formatAddress(item), lat: Number(item.lat), lng: Number(item.lon) }))
                .filter((item) => item.name && isValidPoint(item.lat, item.lng));
            for (const item of found) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'list-group-item list-group-item-action';
                button.textContent = item.name; // 外部資料只用 textContent
                button.addEventListener('click', () => chooseResult(item));
                resultsBox.appendChild(button);
            }
            resultsBox.hidden = found.length === 0;
            setMessage(found.length === 0 ? '找不到符合的地點，換個關鍵字試試，或直接在地圖上點選。' : null);
        } catch {
            if (id === requestId) setMessage('搜尋失敗（網路或服務忙碌），請稍後再試，或直接在地圖上點選。');
        }
    };

    searchButton.addEventListener('click', search);
    queryInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault(); // 避免 Enter 送出整張活動表單
        search();
    });

    clearButton.addEventListener('click', () => {
        if (marker) { marker.remove(); marker = null; }
        writeValue(latitudeInput, '');
        writeValue(longitudeInput, '');
        refreshClearButton();
        setMessage(null);
    });

    // 管理員也可能直接改緯度／經度欄位：圖釘跟著移動。
    const syncFromInputs = () => {
        refreshClearButton();
        const lat = readNumber(latitudeInput);
        const lng = readNumber(longitudeInput);
        if (!map) return;
        if (!isValidPoint(lat, lng)) {
            if (marker) { marker.remove(); marker = null; }
            return;
        }
        const current = marker ? marker.getLatLng() : null;
        if (current && round6(current.lat) === lat && round6(current.lng) === lng) return;
        placeMarker(lat, lng);
        map.setView([lat, lng], Math.max(map.getZoom(), 16));
    };
    latitudeInput.addEventListener('change', syncFromInputs);
    longitudeInput.addEventListener('change', syncFromInputs);

    // ---- 建立地圖 ----
    loadLeaflet().then((L) => {
        const lat = readNumber(latitudeInput);
        const lng = readNumber(longitudeInput);
        const hasPoint = isValidPoint(lat, lng);
        map = L.map(mapBox, { center: hasPoint ? [lat, lng] : DEFAULT_CENTER, zoom: hasPoint ? 16 : 13 });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 貢獻者'
        }).addTo(map);
        map.on('click', (event) => selectPoint(event.latlng.lat, event.latlng.lng));
        if (hasPoint) placeMarker(lat, lng);
        refreshClearButton();
    }).catch(() => {
        setMessage('地圖載入失敗，請檢查網路後重新整理；也可以直接手動輸入地址與座標。');
    });
})();
