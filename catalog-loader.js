(() => {
  const STORAGE_KEY = 'brickscan-code-catalog-cache-v1';
  const VERSION_KEY = 'brickscan-code-catalog-version-v1';
  const RELOAD_KEY = 'brickscan-code-catalog-reload-v1';

  function mergeFigures(previousFigures, incomingFigures) {
    const byId = new Map((Array.isArray(previousFigures) ? previousFigures : []).map(fig => [fig.id, fig]));
    for (const incoming of Array.isArray(incomingFigures) ? incomingFigures : []) {
      if (!incoming?.id) continue;
      const previous = byId.get(incoming.id) || {};
      byId.set(incoming.id, {...previous, ...incoming});
    }
    return [...byId.values()].sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));
  }

  function mergeSeries(base, overlay) {
    const byId = new Map((Array.isArray(base) ? base : []).map(series => [series.id, series]));
    for (const incoming of Array.isArray(overlay) ? overlay : []) {
      if (!incoming?.id || !Array.isArray(incoming.figures)) continue;
      const previous = byId.get(incoming.id) || {};
      byId.set(incoming.id, {
        ...previous,
        ...incoming,
        figures: mergeFigures(previous.figures, incoming.figures)
      });
    }
    return [...byId.values()];
  }

  function applyCachedCatalog() {
    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!cached || !Array.isArray(cached.series) || !cached.series.length) return;
      window.MINIFIG_DATA = mergeSeries(window.MINIFIG_DATA, cached.series);
    } catch (error) {
      console.warn('BrickScan catalogue local ignoré', error);
    }
  }

  async function refreshCatalog() {
    try {
      const response = await fetch(`catalog.json?t=${Date.now()}`, {cache:'no-store'});
      if (!response.ok) return;
      const catalog = await response.json();
      if (!catalog || !Array.isArray(catalog.series)) return;

      const signature = `${catalog.catalogVersion || 0}:${JSON.stringify(catalog.series)}`;
      const previous = localStorage.getItem(VERSION_KEY) || '';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
      localStorage.setItem(VERSION_KEY, signature);

      if (signature !== previous && catalog.series.length) {
        const guard = sessionStorage.getItem(RELOAD_KEY);
        if (guard !== signature) {
          sessionStorage.setItem(RELOAD_KEY, signature);
          location.reload();
        }
      }
    } catch (error) {
      console.warn('BrickScan catalogue distant indisponible', error);
    }
  }

  applyCachedCatalog();
  setTimeout(refreshCatalog, 0);
})();
