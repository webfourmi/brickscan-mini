(() => {
  const data = Array.isArray(window.MINIFIG_DATA) ? window.MINIFIG_DATA : [];
  const seriesById = new Map(data.map(series => [series.id, series]));
  const seriesFilters = document.getElementById('seriesFilters');
  const grid = document.getElementById('collectionGrid');
  const stats = document.getElementById('collectionStats');
  if (!seriesFilters || !grid || !stats) return;

  let category = localStorage.getItem('brickscan-series-category') === 'special' ? 'special' : 'standard';
  let scheduled = false;

  function categoryOfSeries(series) {
    return /^series-\d+$/.test(series?.id || '') ? 'standard' : 'special';
  }

  function categoryOfFigureId(id) {
    for (const series of data) {
      if ((series.figures || []).some(fig => fig.id === id)) return categoryOfSeries(series);
    }
    return null;
  }

  function exportFullCatalog() {
    const payload = {
      format: 'brickscan-code-catalog',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      series: data.map(series => ({
        id: series.id,
        name: series.name,
        set: series.set || '',
        year: series.year || null,
        category: categoryOfSeries(series),
        scannable: series.scannable !== false,
        manualOnly: Boolean(series.manualOnly),
        figures: (series.figures || []).map(fig => ({
          id: fig.id,
          number: fig.number,
          name: fig.name,
          name_en: fig.name_en || '',
          codes: Array.isArray(fig.codes) ? fig.codes : []
        }))
      }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    a.href = url;
    a.download = `brickscan-catalogue-codes-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function ensureStyles() {
    if (document.getElementById('v28Styles')) return;
    const style = document.createElement('style');
    style.id = 'v28Styles';
    style.textContent = `
      .series-category-chooser{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0 10px}.series-category-btn{display:grid;gap:3px;text-align:left;border:1px solid #d1d5db;background:#fff;border-radius:16px;padding:13px 14px;color:#111827;font:inherit}.series-category-btn strong{font-size:13px}.series-category-btn small{font-size:10px;color:#6b7280}.series-category-btn.active{background:#111827;color:#fff;border-color:#111827}.series-category-btn.active small{color:#d1d5db}.series-filter-hidden{display:none!important}.v28-category-hidden{display:none!important}
      .tools-icon-btn{width:38px;height:38px;border:1px solid #e5e7eb;background:#fff;border-radius:12px;display:grid;place-items:center;cursor:pointer;font-size:17px;box-shadow:0 2px 8px rgba(17,24,39,.05);margin-left:auto}.tools-sheet{position:fixed;inset:0;z-index:90;display:flex;align-items:flex-end;justify-content:center}.tools-sheet.hidden{display:none}.tools-backdrop{position:absolute;inset:0;background:rgba(17,24,39,.42)}.tools-panel{position:relative;z-index:1;width:min(560px,100%);max-height:82vh;overflow:auto;background:#fff;border-radius:22px 22px 0 0;padding:18px 18px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -18px 50px rgba(17,24,39,.2)}.tools-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.tools-head h2{margin:0;font-size:18px}.tools-close{width:36px;height:36px;border:0;background:#f3f4f6;border-radius:11px;font-size:16px;cursor:pointer}.tools-content{display:grid;gap:12px}.tools-content .backup-card{margin:0}.catalog-card{display:grid;gap:8px;margin:0;padding:13px 14px;border:1px solid #e5e7eb;border-radius:15px;background:#f9fafb}.catalog-card small{display:block;color:#6b7280;font-size:10px;line-height:1.4;margin-top:2px}.catalog-card .btn{justify-self:start}
      @media(max-width:430px){.series-category-chooser{grid-template-columns:1fr}.series-category-btn{padding:12px}.tools-icon-btn{width:36px;height:36px}}
    `;
    document.head.appendChild(style);
  }

  function ensureToolsPanel() {
    ensureStyles();
    const topbar = document.querySelector('.topbar');
    if (!topbar) return null;

    let toolsBtn = document.getElementById('toolsBtn');
    if (!toolsBtn) {
      toolsBtn = document.createElement('button');
      toolsBtn.id = 'toolsBtn';
      toolsBtn.type = 'button';
      toolsBtn.className = 'tools-icon-btn';
      toolsBtn.textContent = '⚙';
      toolsBtn.title = 'Outils';
      toolsBtn.setAttribute('aria-label', 'Ouvrir les outils');
      const install = document.getElementById('installBtn');
      install ? topbar.insertBefore(toolsBtn, install) : topbar.appendChild(toolsBtn);
    }

    let sheet = document.getElementById('toolsSheet');
    if (!sheet) {
      sheet = document.createElement('section');
      sheet.id = 'toolsSheet';
      sheet.className = 'tools-sheet hidden';
      sheet.setAttribute('aria-hidden', 'true');
      sheet.innerHTML = `
        <div class="tools-backdrop" id="toolsBackdrop"></div>
        <div class="tools-panel" role="dialog" aria-modal="true" aria-labelledby="toolsTitle">
          <div class="tools-head"><div><div class="eyebrow">OUTILS</div><h2 id="toolsTitle">Sauvegarde & catalogue</h2></div><button id="toolsClose" class="tools-close" type="button" aria-label="Fermer">✕</button></div>
          <div id="toolsContent" class="tools-content"></div>
        </div>`;
      document.body.appendChild(sheet);
    }

    const content = document.getElementById('toolsContent');
    const backup = document.querySelector('#collectionView .backup-card') || document.querySelector('.backup-card');
    if (backup && content && backup.parentElement !== content) content.appendChild(backup);

    let catalogCard = document.getElementById('catalogDownloadCard');
    if (!catalogCard && content) {
      catalogCard = document.createElement('div');
      catalogCard.id = 'catalogDownloadCard';
      catalogCard.className = 'catalog-card';
      catalogCard.innerHTML = `<div><strong>Catalogue des codes</strong><small>JSON complet de BrickScan pour ajouter ou corriger plus facilement de futures séries.</small></div><button id="downloadCatalogBtn" type="button" class="btn secondary">⬇️ Télécharger le catalogue JSON</button>`;
      content.appendChild(catalogCard);
      document.getElementById('downloadCatalogBtn')?.addEventListener('click', exportFullCatalog);
    } else if (catalogCard && content && catalogCard.parentElement !== content) {
      content.appendChild(catalogCard);
    }

    const open = () => { sheet.classList.remove('hidden'); sheet.setAttribute('aria-hidden','false'); };
    const close = () => { sheet.classList.add('hidden'); sheet.setAttribute('aria-hidden','true'); };
    if (!toolsBtn.dataset.bound) {
      toolsBtn.dataset.bound = '1';
      toolsBtn.addEventListener('click', open);
      document.getElementById('toolsClose')?.addEventListener('click', close);
      document.getElementById('toolsBackdrop')?.addEventListener('click', close);
      document.addEventListener('keydown', event => { if (event.key === 'Escape' && !sheet.classList.contains('hidden')) close(); });
    }
    return sheet;
  }

  function ensureCategoryUi() {
    let chooser = document.getElementById('seriesCategoryChooser');
    if (!chooser) {
      chooser = document.createElement('div');
      chooser.id = 'seriesCategoryChooser';
      chooser.className = 'series-category-chooser';
      chooser.innerHTML = `
        <button type="button" class="series-category-btn" data-series-category="standard"><strong>◆ Séries standard</strong><small>Les séries numérotées</small></button>
        <button type="button" class="series-category-btn" data-series-category="special"><strong>★ Séries spéciales</strong><small>Marvel, D&D, Disney, Shrek…</small></button>`;
      stats.after(chooser);
      chooser.addEventListener('click', event => {
        const button = event.target.closest('button[data-series-category]');
        if (!button) return;
        category = button.dataset.seriesCategory === 'special' ? 'special' : 'standard';
        localStorage.setItem('brickscan-series-category', category);
        seriesFilters.querySelector('button[data-filter="all"]')?.click();
        scheduleApply();
      });
    }
  }

  function applyCategory() {
    scheduled = false;
    ensureStyles();
    ensureToolsPanel();
    ensureCategoryUi();

    document.querySelectorAll('.series-category-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.seriesCategory === category);
    });

    seriesFilters.querySelectorAll('button[data-filter]').forEach(button => {
      const id = button.dataset.filter;
      if (id === 'all') {
        button.classList.remove('series-filter-hidden');
        button.textContent = category === 'standard' ? 'Toutes les séries standard' : 'Toutes les séries spéciales';
        return;
      }
      const series = seriesById.get(id);
      button.classList.toggle('series-filter-hidden', !series || categoryOfSeries(series) !== category);
    });

    const allActive = seriesFilters.querySelector('button[data-filter="all"]')?.classList.contains('active');
    if (allActive) {
      grid.querySelectorAll('.fig-card[data-id]').forEach(card => {
        card.classList.toggle('v28-category-hidden', categoryOfFigureId(card.dataset.id) !== category);
      });
    } else {
      grid.querySelectorAll('.fig-card').forEach(card => card.classList.remove('v28-category-hidden'));
    }
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyCategory);
  }

  ensureStyles();
  ensureToolsPanel();
  ensureCategoryUi();
  const observer = new MutationObserver(scheduleApply);
  observer.observe(seriesFilters, {childList:true, subtree:true});
  observer.observe(grid, {childList:true, subtree:true});
  window.addEventListener('storage', event => {
    if (event.key === 'brickscan-series-category') {
      category = event.newValue === 'special' ? 'special' : 'standard';
      scheduleApply();
    }
  });
  scheduleApply();
})();
