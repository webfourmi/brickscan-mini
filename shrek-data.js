(() => {
  const shrek = {
    id: 'shrek',
    name: 'Shrek 71053',
    set: '71053',
    year: 2026,
    releaseOrder: 202609,
    scannable: true,
    manualOnly: false,
    figures: [
      {id:'shrek-1',number:1,name:'Thelonious',name_en:'Thelonious',codes:['6634903','6627608','6634882'],image:'https://img.bricklink.com/ItemImage/SN/0/colshr-1.png'},
      {id:'shrek-2',number:2,name:'Le Chat Potté',name_en:'Puss in Boots',codes:['6634905','6627610','6634884'],image:'https://img.bricklink.com/ItemImage/SN/0/colshr-2.png'},
      {id:'shrek-3',number:3,name:'Tit Biscuit',name_en:'Gingy',codes:['6634906','6627611','6634885'],image:'https://img.bricklink.com/ItemImage/SN/0/colshr-3.png'},
      {id:'shrek-4',number:4,name:'Shrek',name_en:'Shrek',codes:['6634901','6627606','6634880'],image:'https://img.bricklink.com/ItemImage/SN/0/colshr-4.png'},
      {id:'shrek-5',number:5,name:'Dragon',name_en:'Dragon',codes:['6634900','6627605','6634879'],image:'https://img.bricklink.com/ItemImage/SN/0/colshr-5.png'},
      {id:'shrek-6',number:6,name:'Fiona et l’Âne',name_en:'Fiona and Donkey',codes:['6634902','6627607','6634881'],image:'https://img.bricklink.com/ItemImage/SN/0/colshr-6.png'},
      {id:'shrek-7',number:7,name:'Merlin',name_en:'Merlin',codes:['6634907','6627612','6634886'],image:'https://img.bricklink.com/ItemImage/SN/0/colshr-7.png'},
      {id:'shrek-8',number:8,name:'Pinocchio',name_en:'Pinocchio',codes:['6634910','6627615','6634889'],image:'https://img.bricklink.com/ItemImage/SN/0/colshr-8.png'},
      {id:'shrek-9',number:9,name:'Grand Méchant Loup',name_en:'Big Bad Wolf',codes:['6634904','6627609','6634883'],image:'https://img.bricklink.com/ItemImage/SN/0/colshr-9.png'},
      {id:'shrek-10',number:10,name:'Lord Farquaad',name_en:'Lord Farquaad',codes:['6634908','6627613','6634887'],image:'https://img.bricklink.com/ItemImage/SN/0/colshr-10.png'},
      {id:'shrek-11',number:11,name:'Fée Marraine',name_en:'Fairy Godmother',codes:['6634909','6627614','6634888'],image:'https://img.bricklink.com/ItemImage/SN/0/colshr-11.png'},
      {id:'shrek-12',number:12,name:'Prince Charmant',name_en:'Prince Charming',codes:['6634911','6627616','6634890'],image:'https://img.bricklink.com/ItemImage/SN/0/colshr-12.png'}
    ]
  };

  const data = Array.isArray(window.MINIFIG_DATA) ? window.MINIFIG_DATA : [];
  const recentMeta = {
    'series-25': {year:2024, releaseOrder:202401},
    'series-26': {year:2024, releaseOrder:202405},
    'dnd': {year:2024, releaseOrder:202409},
    'series-27': {year:2025, releaseOrder:202501},
    'spiderverse': {year:2025, releaseOrder:202509},
    'series-28': {year:2026, releaseOrder:202601},
    'series-29': {year:2026, releaseOrder:202605}
  };

  for (const series of data) {
    const meta = recentMeta[series.id];
    if (!meta) continue;
    series.year = meta.year;
    series.releaseOrder = meta.releaseOrder;
  }

  const withoutShrek = data.filter(series => series.id !== 'shrek');
  const numbered = withoutShrek
    .filter(series => /^series-\d+$/.test(series.id || ''))
    .sort((a, b) => Number(b.id.split('-')[1]) - Number(a.id.split('-')[1]));

  const specials = withoutShrek
    .filter(series => !/^series-\d+$/.test(series.id || ''))
    .sort((a, b) => (Number(b.releaseOrder) || Number(b.year) * 100 || 0) - (Number(a.releaseOrder) || Number(a.year) * 100 || 0));

  window.MINIFIG_DATA = [shrek, ...numbered, ...specials];
})();