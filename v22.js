(() => {
  const specialNames = new Set([
    'Team GB 8909',
    'La Grande Aventure LEGO 71004',
    'Les Simpson 71005',
    'Les Simpson Série 2 71009',
    'Disney Série 1 71012',
    'Équipe d’Allemagne DFB 71014',
    'LEGO Batman Le Film 71017',
    'LEGO NINJAGO Le Film 71019',
    'LEGO Batman Le Film Série 2 71020',
    'Harry Potter & Les Animaux fantastiques 71022',
    'La Grande Aventure LEGO 2 71023',
    'Disney Série 2 71024',
    'DC Super Heroes 71026',
    'Harry Potter Série 2 71028',
    'Looney Tunes 71030',
    'Marvel Studios 71031',
    'Les Muppets 71033',
    'Disney 100 71038',
    'Marvel Studios Série 2 71039'
  ]);

  const sheet = document.getElementById('figureSheet');
  const series = document.getElementById('figureSheetSeries');
  const image = document.getElementById('figureSheetImage');
  const fallback = document.getElementById('figureSheetFallback');
  if (!sheet || !series || !image || !fallback) return;

  function guardPhoto() {
    if (sheet.classList.contains('hidden')) return;
    if (!specialNames.has(series.textContent.trim())) return;
    image.removeAttribute('src');
    image.classList.add('hidden');
    fallback.textContent = '◆';
    fallback.classList.remove('hidden');
  }

  const observer = new MutationObserver(() => requestAnimationFrame(guardPhoto));
  observer.observe(sheet, {attributes:true, attributeFilter:['class'], childList:true, subtree:true});
})();
