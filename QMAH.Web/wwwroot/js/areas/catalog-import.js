(() => {
    const form = document.getElementById('source-search');
    const status = document.getElementById('source-status');
    const previous = document.getElementById('source-prev');
    const next = document.getElementById('source-next');
    let page = 1;
    let lastQuery;
    let loading = false;
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
