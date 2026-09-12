(() => {
  const APP_VERSION = '2.9.2';

  if (!document.querySelector('script[data-brickscan-v24]')) {
    const script = document.createElement('script');
    script.src = 'v24.js?v=292';
    script.dataset.brickscanV24 = 'true';
    document.body.appendChild(script);
  }

  if (!document.querySelector('script[data-brickscan-scanner-v282]')) {
    const scanner = document.createElement('script');
    scanner.src = 'scanner-v282.js?v=292';
    scanner.dataset.brickscanScannerV282 = 'true';
    document.body.appendChild(scanner);
  }

  if (!document.querySelector('script[data-brickscan-v285]')) {
    const wishlistRule = document.createElement('script');
    wishlistRule.src = 'v285.js?v=292';
    wishlistRule.dataset.brickscanV285 = 'true';
    document.body.appendChild(wishlistRule);
  }

  if (!document.querySelector('script[data-brickscan-v29]')) {
    const visualScanner = document.createElement('script');
    visualScanner.src = 'v29.js?v=292';
    visualScanner.dataset.brickscanV29 = 'true';
    document.body.appendChild(visualScanner);
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
    if (headerVersion) headerVersion.textContent = 'Scanner de minifigurines · v2.9.2';
    const scanStatus = document.getElementById('scanStatus');
    if (scanStatus && /Prêt/.test(scanStatus.textContent || '')) scanStatus.textContent = 'Prêt · v2.9.2';
    const currentVersion = document.getElementById('currentVersion');
    if (currentVersion) currentVersion.textContent = APP_VERSION;
    document.title = 'BrickScan Mini 2.9.2';
  }, 0);
})();