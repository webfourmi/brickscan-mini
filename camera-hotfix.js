(() => {
  const $ = id => document.getElementById(id);
  const startBtn = $('startBtn');
  const stopBtn = $('stopBtn');
  const scanAgainBtn = $('scanAgainBtn');
  const nativeScanner = $('nativeScanner');
  const fallbackScanner = $('fallbackScanner');
  const status = $('scanStatus');
  const manualInput = $('manualInput');
  const manualBtn = $('manualBtn');

  if (!startBtn || !fallbackScanner) return;

  let reader = null;
  let running = false;

  const setStatus = text => { if (status) status.textContent = text; };

  function loadLib() {
    if (window.Html5Qrcode) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Bibliothèque de scan indisponible'));
      document.head.appendChild(s);
    });
  }

  async function stopCamera() {
    running = false;
    if (reader) {
      try { await reader.stop(); } catch (_) {}
      try { await reader.clear(); } catch (_) {}
      reader = null;
    }
    fallbackScanner.classList.add('hidden');
    nativeScanner.classList.remove('hidden');
    startBtn.disabled = false;
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    setStatus('Prêt');
  }

  async function startCamera() {
    if (running) return;
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      setStatus('La caméra nécessite HTTPS.');
      return;
    }

    startBtn.disabled = true;
    setStatus('Ouverture de la caméra…');

    try {
      await loadLib();
      nativeScanner.classList.add('hidden');
      fallbackScanner.classList.remove('hidden');

      // Configuration volontairement simple : c'est celle qui ouvrait correctement
      // la caméra sur Android dans la V1.1.
      reader = new Html5Qrcode('fallbackScanner');
      running = true;

      await reader.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
          disableFlip: true,
          formatsToSupport: window.Html5QrcodeSupportedFormats
            ? [Html5QrcodeSupportedFormats.DATA_MATRIX, Html5QrcodeSupportedFormats.QR_CODE]
            : undefined
        },
        async raw => {
          if (!running) return;
          if (navigator.vibrate) navigator.vibrate([60, 40, 90]);
          manualInput.value = raw;
          await stopCamera();
          manualBtn.click();
        },
        () => {}
      );

      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      setStatus('Caméra active · vise le petit Data Matrix');
    } catch (error) {
      console.error('BrickScan camera hotfix:', error);
      await stopCamera();
      setStatus('Impossible d’ouvrir la caméra. Réessaie après avoir rechargé la page.');
    }
  }

  startBtn.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    startCamera();
  }, true);

  stopBtn.addEventListener('click', event => {
    if (!running) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    stopCamera();
  }, true);

  if (scanAgainBtn) {
    scanAgainBtn.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      $('resultCard')?.classList.add('hidden');
      startCamera();
    }, true);
  }

  document.addEventListener('click', event => {
    if (running && event.target.closest?.('.nav-btn')) stopCamera();
  }, true);
})();
