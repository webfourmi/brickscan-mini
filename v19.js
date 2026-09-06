(() => {
  const data = Array.isArray(window.MINIFIG_DATA) ? window.MINIFIG_DATA : [];
  const figIndex = new Map();
  const seriesIndex = new Map(data.map(series => [series.id, series]));

  for (const series of data) {
    for (const fig of series.figures || []) {
      figIndex.set(fig.id, {...fig, seriesId:series.id, seriesName:series.name, set:series.set});
    }
  }

  const searchInput = document.getElementById('collectionSearch');
  const ownershipFilters = document.getElementById('ownershipFilters');
  const visibleCount = document.getElementById('collectionVisibleCount');
  const seriesFilters = document.getElementById('seriesFilters');
  const grid = document.getElementById('collectionGrid');
  const empty = document.getElementById('collectionFilterEmpty');
  if (!searchInput || !ownershipFilters || !seriesFilters || !grid) return;

  let ownershipMode = 'all';
  let scheduled = false;

  function ownedSet() {
    try {
      const raw = JSON.parse(localStorage.getItem('brickscan-owned') || '[]');
      return new Set(Array.isArray(raw) ? raw : []);
    } catch (_) {
      return new Set();
    }
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function matchesSearch(fig, query) {
    if (!query) return true;
    const haystack = normalize([
      fig?.name,
      fig?.name_en,
      fig?.seriesName,
      fig?.set,
      fig?.number
    ].filter(Boolean).join(' '));
    return haystack.includes(query);
  }

  function decorateSeriesFilters(owned) {
    seriesFilters.querySelectorAll('button[data-filter]').forEach(button => {
      const id = button.dataset.filter;
      if (id === 'all') {
        const total = figIndex.size;
        const count = [...owned].filter(figId => figIndex.has(figId)).length;
        button.textContent = `Toutes · ${count}/${total}${total && count === total ? ' ✓' : ''}`;
        button.classList.toggle('series-complete', total > 0 && count === total);
        return;
      }

      const series = seriesIndex.get(id);
      if (!series) return;
      const total = (series.figures || []).length;
      const count = (series.figures || []).reduce((sum, fig) => sum + (owned.has(fig.id) ? 1 : 0), 0);
      button.textContent = `${series.name} · ${count}/${total}${total && count === total ? ' ✓' : ''}`;
      button.classList.toggle('series-complete', total > 0 && count === total);
    });
  }

  function applyFilters() {
    scheduled = false;
    const owned = ownedSet();
    const query = normalize(searchInput.value);
    let shown = 0;
    let rendered = 0;

    grid.querySelectorAll('.fig-card[data-id]').forEach(card => {
      rendered += 1;
      const fig = figIndex.get(card.dataset.id);
      const isOwned = owned.has(card.dataset.id);
      const modeOk = ownershipMode === 'all' || (ownershipMode === 'owned' && isOwned) || (ownershipMode === 'missing' && !isOwned);
      const show = modeOk && matchesSearch(fig, query);
      card.classList.toggle('v19-hidden', !show);
      if (show) shown += 1;
    });

    decorateSeriesFilters(owned);

    if (visibleCount) {
      const modeLabel = ownershipMode === 'owned' ? 'possédée(s)' : ownershipMode === 'missing' ? 'manquante(s)' : 'figurine(s)';
      visibleCount.textContent = `${shown} ${modeLabel}${query ? ' trouvée(s)' : ''}`;
    }
    if (empty) empty.classList.toggle('hidden', !(rendered > 0 && shown === 0));
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyFilters);
  }

  searchInput.addEventListener('input', scheduleApply);

  ownershipFilters.querySelectorAll('button[data-owned-filter]').forEach(button => {
    button.addEventListener('click', () => {
      ownershipMode = button.dataset.ownedFilter || 'all';
      ownershipFilters.querySelectorAll('button[data-owned-filter]').forEach(other => other.classList.toggle('active', other === button));
      scheduleApply();
    });
  });

  const observer = new MutationObserver(scheduleApply);
  observer.observe(seriesFilters, {childList:true, subtree:true});
  observer.observe(grid, {childList:true, subtree:true, attributes:true, attributeFilter:['class']});

  window.addEventListener('storage', event => {
    if (event.key === 'brickscan-owned') scheduleApply();
  });

  scheduleApply();
})();
