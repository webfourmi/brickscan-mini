(() => {
  const APP_VERSION = '2.4.0';
  const $ = id => document.getElementById(id);
  const data = window.MINIFIG_DATA || [];
  const figIndex = new Map();
  const nameIndex = new Map();

  for (const series of data) {
    for (const fig of series.figures || []) {
      const full = {...fig, seriesId: series.id, seriesName: series.name, set: series.set};
      figIndex.set(fig.id, full);
      nameIndex.set(fig.name, full);
    }
  }

  const PHOTO_BASE = 'https://raw.githubusercontent.com/le0pard/lego-scanner/main/src/lib/assets/minifigures/';
  const folderMap = {'dnd':'dungeons-and-dragons','spiderverse':'spiderman-spiderverse'};
  const fileOverrides = {'spiderverse-10':'peter-b-parker-spider-man-may-mayday-parkern.jpg'};

  function slugify(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').replace(/&/g, ' ').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  }
  function photoUrl(fig) {
    if (!fig || fig.noRemotePhoto) return '';
    if (fig.image) return fig.image;
    const n = Number(fig.seriesId?.split('-')[1]);
    if (Number.isFinite(n) && n < 25) return '';
    const folder = folderMap[fig.seriesId] || fig.seriesId;
    const filename = fileOverrides[fig.id] || `${slugify(fig.name_en || fig.name)}.jpg`;
    return `${PHOTO_BASE}${folder}/${filename}`;
  }
  function buildPhoto(fig, className, eager=false) {
    const url = photoUrl(fig); if (!url) return null;
    const img=document.createElement('img'); img.className=className; img.src=url; img.alt=fig?.name?`Figurine ${fig.name}`:'Figurine'; img.loading=eager?'eager':'lazy'; img.decoding='async'; img.referrerPolicy='no-referrer'; return img;
  }
  function decorateResult() {
    const card=$('resultCard'); if(!card||card.classList.contains('hidden'))return;
    const fig=nameIndex.get($('resultName')?.textContent?.trim()); if(!fig)return;
    let img=card.querySelector('.result-photo'); const avatar=$('resultAvatar'); const url=photoUrl(fig);
    if(!url){img?.remove();avatar?.classList.remove('photo-hidden');return;}
    if(!img){img=buildPhoto(fig,'result-photo',true); if(img){avatar?avatar.before(img):card.prepend(img);}}
    if(!img)return; if(img.dataset.figId!==fig.id){img.src=url;img.alt=`Figurine ${fig.name}`;} img.dataset.figId=fig.id; img.classList.remove('hidden'); avatar?.classList.add('photo-hidden'); img.onerror=()=>{img.classList.add('hidden');avatar?.classList.remove('photo-hidden');};
  }
  function decorateCollection() {
    const grid=$('collectionGrid'); if(!grid)return;
    grid.querySelectorAll('.fig-card').forEach(card=>{if(card.querySelector('.fig-photo'))return; const fig=figIndex.get(card.dataset.id); const img=buildPhoto(fig,'fig-photo'); if(!img)return; img.onerror=()=>img.remove(); card.prepend(img);});
  }
  function decorateHistory() {
    const list=$('historyList'); if(!list)return;
    list.querySelectorAll('.history-item').forEach(item=>{if(item.querySelector('.history-photo'))return; const fig=nameIndex.get(item.querySelector('.history-copy strong')?.textContent?.trim()); const img=buildPhoto(fig,'history-photo'); if(!img)return; img.onerror=()=>img.remove(); const old=item.querySelector('.history-avatar'); old?old.replaceWith(img):item.prepend(img);});
  }
  let decorating=false; function decorateAll(){if(decorating)return;decorating=true;try{decorateResult();decorateCollection();decorateHistory();}finally{decorating=false;}}
  const observer=new MutationObserver(()=>requestAnimationFrame(decorateAll)); observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']}); decorateAll();

  const headerVersion=document.querySelector('.topbar p');
  if(headerVersion) headerVersion.textContent='Scanner de minifigurines · v2.4';
  const scanStatus=$('scanStatus');
  if(scanStatus && /Prêt/.test(scanStatus.textContent||'')) scanStatus.textContent='Prêt · v2.4';
  document.title='BrickScan Mini 2.4';

  const updateBanner=$('updateBanner'), updateText=$('updateText'), updateBtn=$('updateBtn'), updateState=$('updateState'), checkUpdateBtn=$('checkUpdateBtn'), currentVersion=$('currentVersion');
  if(currentVersion)currentVersion.textContent=APP_VERSION;
  let latestVersion=APP_VERSION, latestBuild=240;
  const parts=v=>String(v||'0').split('.').map(n=>Number(n)||0);
  function isNewer(remote,current){const a=parts(remote),b=parts(current),m=Math.max(a.length,b.length);for(let i=0;i<m;i++){if((a[i]||0)>(b[i]||0))return true;if((a[i]||0)<(b[i]||0))return false;}return false;}
  async function checkForUpdate(showStatus=false){if(showStatus&&updateState)updateState.textContent='Vérification…';try{const r=await fetch(`version.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const info=await r.json();latestVersion=info.version||APP_VERSION;latestBuild=info.build||240;if(isNewer(latestVersion,APP_VERSION)){if(updateText)updateText.textContent=`Version ${latestVersion} disponible${info.notes?' · '+info.notes:''}`;updateBanner?.classList.remove('hidden');if(updateState)updateState.textContent=`Nouvelle version ${latestVersion} disponible`;return true;}updateBanner?.classList.add('hidden');if(updateState)updateState.textContent=`BrickScan est à jour · v${APP_VERSION}`;return false;}catch(e){console.warn(e);if(showStatus&&updateState)updateState.textContent='Vérification impossible hors ligne';return false;}}
  async function applyUpdate(){if(updateBtn){updateBtn.disabled=true;updateBtn.textContent='Mise à jour…';}if(updateState)updateState.textContent='Installation de la nouvelle version…';try{let reloaded=false;if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.getRegistration();if(reg){await reg.update();if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloaded)return;reloaded=true;location.replace(`${location.pathname}?v=${latestBuild||Date.now()}`);},{once:true});}}if('caches'in window){const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('brickscan-mini-')).map(k=>caches.delete(k)));}setTimeout(()=>{if(!reloaded)location.replace(`${location.pathname}?v=${latestBuild||Date.now()}`);},700);}catch(e){console.error(e);if(updateState)updateState.textContent='Échec de la mise à jour. Réessaie avec Internet.';if(updateBtn){updateBtn.disabled=false;updateBtn.textContent='Mettre à jour';}}}
  updateBtn?.addEventListener('click',applyUpdate);checkUpdateBtn?.addEventListener('click',()=>checkForUpdate(true));window.addEventListener('online',()=>checkForUpdate(false));setTimeout(()=>checkForUpdate(false),1200);
  const infoCard=document.querySelector('#infoView .info-card');if(infoCard&&!infoCard.querySelector('.image-credit')){const credit=document.createElement('div');credit.className='image-credit';credit.innerHTML='Photos des séries 1 à 24 et des séries historiques sous licence chargées depuis BrickLink ; séries récentes depuis L-Scan et Shrek depuis BrickLink. Les marques et visuels LEGO restent la propriété de leurs ayants droit.';infoCard.appendChild(credit);}
})();