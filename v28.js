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
    const card = grid.querySelector(`.fig-card[data-id="${CSS.escape(id)}"]`);
    if (!card) return null;
    for (const series of data) {
      if ((series.figures || []).some(fig => fig.id === id)) return categoryOfSeries(series);
    }
    return null;
  }

  function ensureUi() {
    let chooser = document.getElementById('seriesCategoryChooser');
    if (!chooser) {
      chooser = document.createElement('div');
      chooser.id = 'seriesCategoryChooser';
      chooser.className = 'series-category-chooser';
      chooser.innerHTML = `
        <button type="button" class="series-category-btn" data-series-category="standard">
          <strong>◆ Séries standard</strong><small>Les séries numérotées</small>
        </button>
        <button type="button" class="series-category-btn" data-series-category="special">
          <strong>★ Séries spéciales</strong><small>Marvel, D&D, Disney, Shrek…</small>
        </button>
      `;
      stats.after(chooser);
      chooser.addEventListener('click', event => {
        const button = event.target.closest('button[data-series-category]');
        if (!button) return;
        category = button.dataset.seriesCategory === 'special' ? 'special' : 'standard';
        localStorage.setItem('brickscan-series-category', category);
        const all = seriesFilters.querySelector('button[data-filter="all"]');
        if (all) all.click();
        scheduleApply();
      });
    }

    if (!document.getElementById('v28Styles')) {
      const style = document.createElement('style');
      style.id = 'v28Styles';
      style.textContent = `
        .series-category-chooser{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0 10px}.series-category-btn{display:grid;gap:3px;text-align:left;border:1px solid #d1d5db;background:#fff;border-radius:16px;padding:13px 14px;color:#111827;font:inherit}.series-category-btn strong{font-size:13px}.series-category-btn small{font-size:10px;color:#6b7280}.series-category-btn.active{background:#111827;color:#fff;border-color:#111827}.series-category-btn.active small{color:#d1d5db}.series-filter-hidden{display:none!important}.v28-category-hidden{display:none!important}.catalog-card{display:grid;gap:8px;margin:14px 0;padding:13px 14px;border:1px solid #e5e7eb;border-radius:15px;background:#f9fafb}.catalog-card>div{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.catalog-card small{display:block;color:#6b7280;font-size:10px;line-height:1.4;margin-top:2px}.catalog-card .btn{justify-self:start}@media(max-width:430px){.series-category-chooser{grid-template-columns:1fr}.series-category-btn{padding:12px}}
      `;
      document.head.appendChild(style);
    }

    let card = document.getElementById('catalogDownloadCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'catalogDownloadCard';
      card.className = 'catalog-card';
      card.innerHTML = `<div><div><strong>Catalogue des codes</strong><small>JSON complet de BrickScan. Les prochaines séries pourront être ajoutées au catalogue sans modifier le moteur de scan.</small></div></div><button id="downloadCatalogBtn" type="button" class="btn secondary">⬇️ Télécharger le catalogue JSON</button>`;
      document.querySelector('.backup-card')?.after(card);
      document.getElementById('downloadCatalogBtn')?.addEventListener('click', exportFullCatalog);
    }
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

  function applyCategory() {
    scheduled = false;
    ensureUi();
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

    // Quand "Toutes" est active, on limite aussi les cartes à la famille choisie.
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

  ensureUi();
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
