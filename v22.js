(() => {
  const APP_VERSION = '2.6.2';

  if (!document.querySelector('script[data-brickscan-v24]')) {
    const script = document.createElement('script');
    script.src = 'v24.js?v=262';
    script.dataset.brickscanV24 = 'true';
    document.body.appendChild(script);
  }

  document.getElementById('clearCollection')?.remove();
  document.addEventListener('click', event => {
    if (!event.target?.closest?.('#clearCollection')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);

  setTimeout(() => {
    document.getElementById('clearCollection')?.remove();
    const headerVersion = document.querySelector('.topbar p');
    if (headerVersion) headerVersion.textContent = 'Scanner de minifigurines · v2.6.2';
    const scanStatus = document.getElementById('scanStatus');
    if (scanStatus && /Prêt/.test(scanStatus.textContent || '')) scanStatus.textContent = 'Prêt · v2.6.2';
    const currentVersion = document.getElementById('currentVersion');
    if (currentVersion) currentVersion.textContent = APP_VERSION;
    document.title = 'BrickScan Mini 2.6.2';
  }, 0);
})();