(() => {
  const HISTORY_KEY = 'brickscan-history';
  const RETURN_KEY = 'brickscan-return-history-after-clear';

  function emptyHistoryMarkup() {
    return '<div class="empty">Aucun scan pour le moment.<br>Le premier trésor de boîte aveugle t’attend. 🧱</div>';
  }

  function installClearHistory() {
    const button = document.getElementById('clearHistory');
    const list = document.getElementById('historyList');
    if (!button || button.dataset.historyClearV2112 === '1') return;

    button.dataset.historyClearV2112 = '1';

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      try {
        localStorage.setItem(HISTORY_KEY, '[]');
      } catch (_) {}

      if (list) list.innerHTML = emptyHistoryMarkup();
      button.textContent = 'Effacé ✓';
      button.disabled = true;

      try { sessionStorage.setItem(RETURN_KEY, '1'); } catch (_) {}

      setTimeout(() => {
        const url = new URL(location.href);
        url.searchParams.set('v', '2112');
        url.searchParams.set('history', '1');
        location.replace(url.toString());
      }, 180);
    }, true);
  }

  function restoreHistoryView() {
    let shouldReturn = false;
    try {
      shouldReturn = sessionStorage.getItem(RETURN_KEY) === '1';
      if (shouldReturn) sessionStorage.removeItem(RETURN_KEY);
    } catch (_) {}

    const url = new URL(location.href);
    if (url.searchParams.get('history') === '1') shouldReturn = true;
    if (!shouldReturn) return;

    setTimeout(() => {
      const historyButton = document.querySelector('.nav-btn[data-view="historyView"]');
      historyButton?.click();
      const list = document.getElementById('historyList');
      if (list && localStorage.getItem(HISTORY_KEY) === '[]') list.innerHTML = emptyHistoryMarkup();

      if (url.searchParams.has('history')) {
        url.searchParams.delete('history');
        history.replaceState(null, '', url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ''));
      }
    }, 80);
  }

  installClearHistory();
  restoreHistoryView();
})();