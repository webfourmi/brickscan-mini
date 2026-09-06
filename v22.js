(() => {
  // Couche de compatibilité et chargement des ajouts de collection V2.4.
  if (!document.querySelector('script[data-brickscan-v24]')) {
    const script = document.createElement('script');
    script.src = 'v24.js?v=240';
    script.dataset.brickscanV24 = 'true';
    document.body.appendChild(script);
  }
})();
