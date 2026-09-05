
(() => {
  const data = window.MINIFIG_DATA || [];
  const codeIndex = new Map();
  const figIndex = new Map();
  for (const s of data) for (const f of s.figures) {
    figIndex.set(f.id, {...f, seriesId:s.id, seriesName:s.name, set:s.set});
    for (const c of f.codes) codeIndex.set(c, {...f, seriesId:s.id, seriesName:s.name, set:s.set});
  }

  const $ = id => document.getElementById(id);
  const video = $('video');
  const nativeScanner = $('nativeScanner');
  const fallbackScanner = $('fallbackScanner');
  const status = $('scanStatus');
  const placeholder = $('scannerPlaceholder');
  const startBtn = $('startBtn');
  const stopBtn = $('stopBtn');
  const torchBtn = $('torchBtn');
  const zoomWrap = $('zoomWrap');
  const zoom = $('zoom');
  let stream = null, detector = null, scanning = false, lastDetect = 0, fallback = null, torchOn = false;
  let currentResult = null, lastRaw = '', deferredInstall = null;

  const loadSet = (key) => new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  const saveSet = (key,set) => localStorage.setItem(key, JSON.stringify([...set]));
  let owned = loadSet('brickscan-owned');
  let history = JSON.parse(localStorage.getItem('brickscan-history') || '[]');

  function setStatus(text, kind='') { status.textContent = text; status.dataset.kind = kind; }
  function extractCandidates(raw) {
    const text = String(raw || '').trim();
    const exact = text.match(/(?:^|\D)(\d{7})(?=\D|$)/g) || [];
    const cleaned = exact.map(v => (v.match(/\d{7}/)||[])[0]).filter(Boolean);
    if (/^\d{7}$/.test(text)) cleaned.unshift(text);
    return [...new Set(cleaned)];
  }
  function extractFactory(raw) {
    const m = String(raw||'').match(/\b\d{2,3}([RS])\d\b/i);
    if (!m) return '—';
    return m[1].toUpperCase()==='S' ? 'S · Europe' : 'R · Amériques';
  }
  function identify(raw, source='scan') {
    const candidates = extractCandidates(raw);
    const code = candidates.find(c => codeIndex.has(c));
    lastRaw = String(raw||'');
    if (!code) {
      showUnknown(raw, candidates[0] || '');
      return false;
    }
    const fig = codeIndex.get(code);
    showResult(fig, code, extractFactory(raw));
    pushHistory(fig, code, source);
    if (navigator.vibrate) navigator.vibrate([50,40,80]);
    return true;
  }
  function showResult(fig, code, factory) {
    currentResult = fig;
    $('unknownCard').classList.add('hidden');
    $('resultCard').classList.remove('hidden');
    $('resultAvatar').textContent = fig.number;
    $('resultName').textContent = fig.name;
    $('resultSeries').textContent = `${fig.seriesName} · set ${fig.set}`;
    $('resultCode').textContent = code;
    $('resultFactory').textContent = factory;
    updateOwnedButton();
    $('resultCard').scrollIntoView({behavior:'smooth', block:'nearest'});
  }
  function showUnknown(raw, candidate) {
    currentResult = null;
    $('resultCard').classList.add('hidden');
    $('unknownCard').classList.remove('hidden');
    $('unknownText').textContent = candidate ? `Identifiant candidat : ${candidate}\n${raw}` : String(raw || 'Aucun identifiant à 7 chiffres détecté.');
    $('unknownCard').scrollIntoView({behavior:'smooth', block:'nearest'});
  }
  function updateOwnedButton() {
    if (!currentResult) return;
    const yes = owned.has(currentResult.id);
    $('ownedBtn').textContent = yes ? '✓ Dans ma collection' : '＋ Ajouter à ma collection';
    $('ownedBtn').classList.toggle('secondary', yes);
    $('ownedBtn').classList.toggle('primary', !yes);
  }
  function pushHistory(fig, code, source) {
    const now=Date.now();
    if (history[0] && history[0].id===fig.id && now-history[0].ts<3000) return;
    history.unshift({id:fig.id, code, source, ts:now});
    history=history.slice(0,30);
    localStorage.setItem('brickscan-history', JSON.stringify(history));
  }

  async function startScanner() {
    $('resultCard').classList.add('hidden'); $('unknownCard').classList.add('hidden');
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      setStatus('La caméra nécessite HTTPS. Héberge l’app ou utilise la saisie manuelle.'); return;
    }
    startBtn.disabled=true; setStatus('Ouverture de la caméra…');
    try {
      // V1.1: sur Android, le BarcodeDetector natif peut annoncer le support
      // Data Matrix tout en restant peu fiable sur les petits codes LEGO.
      // On utilise donc ZXing/html5-qrcode en priorité.
      await startFallback();
    } catch (e) {
      console.error(e); setStatus('Impossible d’ouvrir la caméra. Vérifie l’autorisation.');
      startBtn.disabled=false;
    }
  }
  async function supportsNativeDataMatrix() {
    if (!('BarcodeDetector' in window)) return false;
    try { const f=await BarcodeDetector.getSupportedFormats(); return f.includes('data_matrix'); } catch { return false; }
  }
  async function startNative() {
    stream = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});
    video.srcObject=stream; await video.play(); placeholder.classList.add('hidden');
    detector = new BarcodeDetector({formats:['data_matrix','qr_code']});
    scanning=true; startBtn.classList.add('hidden'); stopBtn.classList.remove('hidden'); setStatus('Vise le Data Matrix…');
    setupTrackControls(); requestAnimationFrame(scanLoop);
  }
  async function scanLoop(ts) {
    if (!scanning || !detector) return;
    if (ts-lastDetect>180 && video.readyState>=2) {
      lastDetect=ts;
      try {
        const codes=await detector.detect(video);
        if (codes.length) {
          const raw=codes[0].rawValue || '';
          if (identify(raw)) { await stopScanner(); return; }
        }
      } catch(e) { /* frame race */ }
    }
    if (scanning) requestAnimationFrame(scanLoop);
  }
  function loadFallbackLib() {
    if (window.Html5Qrcode) return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
      s.onload=resolve; s.onerror=()=>reject(new Error('Bibliothèque de scan indisponible'));
      document.head.appendChild(s);
    });
  }
  async function startFallback() {
    setStatus('Chargement du moteur de scan…'); await loadFallbackLib();
    nativeScanner.classList.add('hidden'); fallbackScanner.classList.remove('hidden');
    fallback = new Html5Qrcode('fallbackScanner'); scanning=true;
    const formats = window.Html5QrcodeSupportedFormats ? [Html5QrcodeSupportedFormats.DATA_MATRIX, Html5QrcodeSupportedFormats.QR_CODE] : undefined;
    await fallback.start(
      {facingMode:'environment'},
      {
        fps:20,
        qrbox:(viewWidth, viewHeight)=>{
          const edge=Math.floor(Math.min(viewWidth,viewHeight)*0.72);
          return {width:edge,height:edge};
        },
        aspectRatio:1.0,
        disableFlip:true,
        formatsToSupport:formats,
        experimentalFeatures:{useBarCodeDetectorIfSupported:false}
      },
      raw=>{ if (identify(raw)) stopScanner(); },
      ()=>{}
    );
    startBtn.classList.add('hidden'); stopBtn.classList.remove('hidden'); setStatus('ZXing actif · vise le Data Matrix à 6–12 cm');
  }
  async function stopScanner() {
    scanning=false;
    if (fallback) { try{await fallback.stop(); await fallback.clear();}catch{} fallback=null; }
    if (stream) { stream.getTracks().forEach(t=>t.stop()); stream=null; }
    video.srcObject=null; detector=null; torchOn=false;
    nativeScanner.classList.remove('hidden'); fallbackScanner.classList.add('hidden'); placeholder.classList.remove('hidden');
    startBtn.disabled=false; startBtn.classList.remove('hidden'); stopBtn.classList.add('hidden'); torchBtn.classList.add('hidden'); zoomWrap.classList.add('hidden');
    setStatus('Prêt');
  }
  function setupTrackControls() {
    const track=stream?.getVideoTracks?.()[0]; if(!track) return;
    const caps=track.getCapabilities?.() || {};
    if (caps.torch) torchBtn.classList.remove('hidden');
    if (caps.zoom) { zoom.min=caps.zoom.min; zoom.max=caps.zoom.max; zoom.step=caps.zoom.step||0.1; zoom.value=Math.min(Math.max(2,caps.zoom.min),caps.zoom.max); zoomWrap.classList.remove('hidden'); applyZoom(); }
  }
  async function applyZoom(){const track=stream?.getVideoTracks?.()[0];if(!track)return;try{await track.applyConstraints({advanced:[{zoom:Number(zoom.value)}]})}catch{}}
  async function toggleTorch(){const track=stream?.getVideoTracks?.()[0];if(!track)return;torchOn=!torchOn;try{await track.applyConstraints({advanced:[{torch:torchOn}]});torchBtn.textContent=torchOn?'🔦 Lampe ON':'🔦 Lampe'}catch{}}

  function renderCollection(filter='all') {
    const total=[...figIndex.values()].length, count=owned.size;
    $('collectionStats').innerHTML=`<div class="stats-top"><span>Collection</span><strong>${count} / ${total}</strong></div><div class="progress"><span style="width:${total?count/total*100:0}%"></span></div>`;
    $('seriesFilters').innerHTML=['all',...data.map(s=>s.id)].map(id=>{
      const label=id==='all'?'Toutes':data.find(s=>s.id===id)?.name;
      return `<button class="filter-chip ${filter===id?'active':''}" data-filter="${id}">${label}</button>`;
    }).join('');
    $('seriesFilters').querySelectorAll('button').forEach(b=>b.onclick=()=>renderCollection(b.dataset.filter));
    const figs=[...figIndex.values()].filter(f=>filter==='all'||f.seriesId===filter);
    $('collectionGrid').innerHTML=figs.map(f=>`<button class="fig-card ${owned.has(f.id)?'owned':''}" data-id="${f.id}"><div class="num">${f.number}</div>${owned.has(f.id)?'<div class="owned-mark">✓</div>':''}<h3>${escapeHtml(f.name)}</h3><small>${escapeHtml(f.seriesName)}</small></button>`).join('');
    $('collectionGrid').querySelectorAll('.fig-card').forEach(b=>b.onclick=()=>{const id=b.dataset.id; owned.has(id)?owned.delete(id):owned.add(id);saveSet('brickscan-owned',owned);renderCollection(filter);});
  }
  function renderHistory() {
    const rows=history.map(h=>{const f=figIndex.get(h.id); if(!f)return ''; const d=new Date(h.ts); return `<div class="history-item"><div class="history-avatar">${f.number}</div><div class="history-copy"><strong>${escapeHtml(f.name)}</strong><small>${escapeHtml(f.seriesName)} · ${h.code}</small></div><div class="history-time">${d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}<br>${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div></div>`}).join('');
    $('historyList').innerHTML=rows||'<div class="empty">Aucun scan pour le moment.<br>Le premier trésor de boîte aveugle t’attend. 🧱</div>';
  }
  function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));}

  document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',async()=>{
    if (btn.dataset.view!=='scanView' && scanning) await stopScanner();
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===btn.dataset.view));
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b===btn));
    if(btn.dataset.view==='collectionView')renderCollection(); if(btn.dataset.view==='historyView')renderHistory(); window.scrollTo({top:0,behavior:'smooth'});
  }));
  startBtn.onclick=startScanner; stopBtn.onclick=stopScanner; torchBtn.onclick=toggleTorch; zoom.oninput=applyZoom;
  $('manualBtn').onclick=()=>{const v=$('manualInput').value.trim(); if(v)identify(v,'manuel');};
  $('manualInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('manualBtn').click();});
  $('scanAgainBtn').onclick=()=>{ $('resultCard').classList.add('hidden'); startScanner(); };
  $('ownedBtn').onclick=()=>{if(!currentResult)return; owned.has(currentResult.id)?owned.delete(currentResult.id):owned.add(currentResult.id);saveSet('brickscan-owned',owned);updateOwnedButton();};
  $('copyUnknown').onclick=async()=>{try{await navigator.clipboard.writeText(lastRaw);$('copyUnknown').textContent='Copié ✓';setTimeout(()=>$('copyUnknown').textContent='Copier le code',1200)}catch{}};
  $('clearCollection').onclick=()=>{if(confirm('Vider toute la collection ?')){owned.clear();saveSet('brickscan-owned',owned);renderCollection();}};
  $('clearHistory').onclick=()=>{history=[];localStorage.setItem('brickscan-history','[]');renderHistory();};

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('installBtn').classList.remove('hidden');});
  $('installBtn').onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('installBtn').classList.add('hidden');};
  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{}));
})();
