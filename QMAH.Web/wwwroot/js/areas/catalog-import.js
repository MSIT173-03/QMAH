(() => {
    const form = document.getElementById('source-search');
    const status = document.getElementById('source-status');
    const previous = document.getElementById('source-prev');
    const next = document.getElementById('source-next');
    let page = 1;
    let lastQuery;
    let loading = false;
    const importForm = document.getElementById('source-import');
    // 僅保存此分頁工作階段的篩選設定，不保存檔案、確認碼或匯入狀態。
    const settingsKey = 'qmah-catalog-import-settings';
    const settings = [...importForm.querySelectorAll('input:not([type="hidden"]), select, textarea')];
    try {
        const saved = JSON.parse(sessionStorage.getItem(settingsKey) || 'null');
        if (saved) settings.forEach(input => {
            const value = saved[input.id || `${input.name}:${input.value}`];
            if (value === undefined) return;
            if (input.type === 'checkbox') input.checked = value;
            else input.value = value;
        });
    } catch { /* Storage may be disabled. */ }
    function saveSettings() {
        try {
            sessionStorage.setItem(settingsKey, JSON.stringify(Object.fromEntries(settings.map(input =>
                [input.id || `${input.name}:${input.value}`, input.type === 'checkbox' ? input.checked : input.value]))));
        } catch { /* Import remains usable without storage. */ }
    }
    importForm.addEventListener('change', saveSettings);
    importForm.addEventListener('submit', event => {
        if (!importForm.querySelector('[name="datasets"]:checked')) {
            event.preventDefault();
            const first = importForm.querySelector('[name="datasets"]');
            first.setCustomValidity('請至少選擇一個文物類別。');
            first.reportValidity();
            first.setCustomValidity('');
        }
        saveSettings();
    });
    document.getElementById('source-counts').addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        const countStatus = document.getElementById('counts-status');
        countStatus.textContent = '正在查詢各類別筆數…';
        const body = document.getElementById('counts-rows');
        body.replaceChildren();
        document.getElementById('counts-results').hidden = false;
        const categories = [...document.getElementById('browse-dataset').options];
        let failures = 0;
        // 各類別獨立回報結果，單一官方端點失敗不遮蔽其他類別；此流程只讀取資料。
        await Promise.all(categories.map(async category => {
            const row = body.insertRow();
            row.insertCell().textContent = category.text;
            const cells = Array.from({ length: 4 }, () => row.insertCell());
            cells.forEach(cell => { cell.textContent = '查詢中…'; });
            const actions = row.insertCell();
            try {
                const params = new URLSearchParams({ dataset: category.value, countsOnly: 'true' });
                const response = await fetch(`${form.action}?${params}`, { headers: { Accept: 'application/json' } });
                if (!response.ok) throw new Error();
                const data = await response.json();
                [data.count, data.uniqueCount, data.importedCount, data.pendingCount].forEach((value, index) => { cells[index].textContent = value; });
                for (const [label, action] of [
                    ['瀏覽', () => {
                        document.getElementById('browse-dataset').value = category.value;
                        document.getElementById('browse-query').value = '';
                        form.requestSubmit();
                    }],
                    ['接續新增', () => {
                        importForm.querySelectorAll('[name="datasets"]').forEach(input => { input.checked = input.value === category.value; });
                        document.getElementById('mode').value = 'new';
                        ['source-from', 'source-to', 'source-identifiers'].forEach(id => { document.getElementById(id).value = ''; });
                        saveSettings();
                        document.getElementById('maxItems').focus();
                    }]
                ]) {
                    const control = document.createElement('button');
                    control.type = 'button';
                    control.className = 'btn btn-sm btn-outline-primary me-2';
                    control.textContent = label;
                    control.addEventListener('click', action);
                    actions.append(control);
                }
            } catch {
                failures++;
                cells.forEach(cell => { cell.textContent = '無法取得'; });
            }
        }));
        countStatus.textContent = failures ? `${failures} 個類別查詢失敗，可再次查詢。` : '各類別筆數查詢完成，未修改任何資料。';
        button.disabled = false;
    });
    async function search(targetPage, query) {
        if (loading) return;
        loading = true;
        const button = form.querySelector('button');
        button.disabled = previous.disabled = next.disabled = true;
        form.setAttribute('aria-busy', 'true');
        status.textContent = '正在讀取故宮資料，請稍候…';
        document.getElementById('source-results').hidden = true;
        document.getElementById('source-pagination').hidden = true;
        try {
            const params = new URLSearchParams(query);
            params.set('page', targetPage);
            const response = await fetch(`${form.action}?${params}`, { headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('無法讀取官方資料，請稍後重新查詢。');
            const data = await response.json();
            const body = document.getElementById('source-rows');
            body.replaceChildren();
            for (const item of data.preview) {
                const row = body.insertRow();
                for (const value of [item.name, item.identifier, item.era]) row.insertCell().textContent = value || '未提供';
                const cell = row.insertCell();
                try {
                    const url = new URL(item.sourceUrl);
                    if (url.protocol === 'https:') {
                        const link = document.createElement('a');
                        link.href = url.href;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.textContent = '查看原始資料';
                        cell.append(link);
                    }
                } catch { /* Official rows may omit their source URL. */ }
            }
            page = data.page;
            lastQuery = query;
            status.textContent = data.matchedCount ? `找到 ${data.matchedCount} 件文物（此類別共 ${data.count} 件）。` : '沒有符合的文物，請更換關鍵字或類別。';
            document.getElementById('source-results').hidden = !data.matchedCount;
            document.getElementById('source-pagination').hidden = data.pages <= 1;
            document.getElementById('source-page').textContent = `第 ${page} / ${data.pages} 頁`;
            previous.disabled = page <= 1;
            next.disabled = page >= data.pages;
        } catch (error) {
            status.textContent = error.message;
        } finally {
            loading = false;
            button.disabled = false;
            form.removeAttribute('aria-busy');
        }
    }
    form.addEventListener('submit', event => {
        event.preventDefault();
        search(1, new URLSearchParams(new FormData(form)));
    });
    previous.addEventListener('click', () => search(page - 1, lastQuery));
    next.addEventListener('click', () => search(page + 1, lastQuery));
    document.querySelectorAll('form[method="post"]').forEach(post => {
        post.addEventListener('submit', event => {
            if (event.defaultPrevented) return;
            const button = post.querySelector('button[type="submit"]');
            if (!button) return;
            button.disabled = true;
            button.textContent = '正在處理，請稍候…';
            post.setAttribute('aria-busy', 'true');
        });
    });
    const preview = document.getElementById('import-preview');
    if (preview) {
        form.closest('section').before(preview);
        preview.classList.replace('mt-4', 'mb-4');
        preview.focus();
    }
})();
