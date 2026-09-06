(() => {
  const APP_VERSION = '2.7.0';

  if (!document.querySelector('script[data-brickscan-v24]')) {
    const script = document.createElement('script');
    script.src = 'v24.js?v=270';
    script.dataset.brickscanV24 = 'true';
    document.body.appendChild(script);
  }

  if (!document.querySelector('script[data-brickscan-scanner-v27]')) {
    const scanner = document.createElement('script');
    scanner.src = 'scanner-v27.js?v=270';
    scanner.dataset.brickscanScannerV27 = 'true';
    document.body.appendChild(scanner);
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
    if (headerVersion) headerVersion.textContent = 'Scanner de minifigurines · v2.7';
    const scanStatus = document.getElementById('scanStatus');
    if (scanStatus && /Prêt/.test(scanStatus.textContent || '')) scanStatus.textContent = 'Prêt · v2.7';
    const currentVersion = document.getElementById('currentVersion');
    if (currentVersion) currentVersion.textContent = APP_VERSION;
    document.title = 'BrickScan Mini 2.7';
  }, 0);
})();