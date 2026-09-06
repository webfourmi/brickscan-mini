(() => {
  const data = Array.isArray(window.MINIFIG_DATA) ? window.MINIFIG_DATA : [];

  const seq = (prefix, count) => Object.fromEntries(
    Array.from({length: count}, (_, i) => [i + 1, `${prefix}-${i + 1}`])
  );

  // Références BrickLink vérifiées série par série.
  // La clé est le numéro interne BrickScan, la valeur l'identifiant catalogue BrickLink.
  const catalog = {
    'team-gb': seq('coltgb', 9),
    'lego-movie-1': seq('coltlm', 16),
    'simpsons-1': seq('colsim', 16),
    'simpsons-2': seq('colsim2', 16),
    'disney-1': seq('coldis', 18),

    'dfb': {
      1:'coldfb-1', 2:'coldfb-2', 3:'coldfb-3', 4:'coldfb-4',
      5:'coldfb-5', 6:'coldfb-6', 7:'coldfb-7', 8:'coldfb-8',
      9:'coldfb-9', 10:'coldfb-15', 11:'coldfb-14', 12:'coldfb-11',
      13:'coldfb-13', 14:'coldfb-12', 15:'coldfb-16', 16:'coldfb-10'
    },

    'lego-batman-1': {
      1:'coltlbm-1', 2:'coltlbm-12', 3:'coltlbm-15', 4:'coltlbm-19',
      5:'coltlbm-10', 6:'coltlbm-9', 7:'coltlbm-14', 8:'coltlbm-3',
      9:'coltlbm-2', 10:'coltlbm-4', 11:'coltlbm-5', 12:'coltlbm-8',
      13:'coltlbm-18', 14:'coltlbm-11', 15:'coltlbm-7', 16:'coltlbm-6',
      17:'coltlbm-17', 18:'coltlbm-20', 19:'coltlbm-16', 20:'coltlbm-13'
    },

    'ninjago-movie': {
      1:'coltlnm-1', 2:'coltlnm-2', 3:'coltlnm-3', 4:'coltlnm-6',
      5:'coltlnm-8', 6:'coltlnm-10', 7:'coltlnm-7', 8:'coltlnm-4',
      9:'coltlnm-19', 10:'coltlnm-20', 11:'coltlnm-18', 12:'coltlnm-12',
      13:'coltlnm-14', 14:'coltlnm-11', 15:'coltlnm-13', 16:'coltlnm-5',
      17:'coltlnm-16', 18:'coltlnm-15', 19:'coltlnm-9', 20:'coltlnm-17'
    },

    'lego-batman-2': {
      1:'coltlbm2-6', 2:'coltlbm2-8', 3:'coltlbm2-7', 4:'coltlbm2-1',
      5:'coltlbm2-10', 6:'coltlbm2-9', 7:'coltlbm2-18', 8:'coltlbm2-3',
      9:'coltlbm2-5', 10:'coltlbm2-12', 11:'coltlbm2-16', 12:'coltlbm2-17',
      13:'coltlbm2-15', 14:'coltlbm2-11', 15:'coltlbm2-4', 16:'coltlbm2-2',
      17:'coltlbm2-19', 18:'coltlbm2-20', 19:'coltlbm2-14', 20:'coltlbm2-13'
    },

    'harry-potter-1': {
      1:'colhp-17', 2:'colhp-19', 3:'colhp-18', 4:'colhp-20',
      5:'colhp-21', 6:'colhp-5', 7:'colhp-6', 8:'colhp-7',
      9:'colhp-8', 10:'colhp-9', 11:'colhp-10', 12:'colhp-12',
      13:'colhp-14', 14:'colhp-13', 15:'colhp-11', 16:'colhp-16',
      17:'colhp-1', 18:'colhp-3', 19:'colhp-2', 20:'colhp-4',
      21:'colhp-15', 22:'colhp-22'
    },

    'lego-movie-2': seq('coltlm2', 20),

    'disney-2': {
      1:'coldis2-1', 2:'coldis2-2', 3:'coldis2-6', 4:'coldis2-3',
      5:'coldis2-4', 6:'coldis2-5', 7:'coldis2-7', 8:'coldis2-8',
      9:'coldis2-9', 10:'coldis2-10', 11:'coldis2-11', 12:'coldis2-12',
      13:'coldis2-13', 14:'coldis2-14', 15:'coldis2-15', 16:'coldis2-16',
      17:'coldis2-17', 18:'coldis2-18'
    },

    'dc-super-heroes': seq('colsh', 16),
    'harry-potter-2': seq('colhp2', 16),
    'looney-tunes': seq('collt', 12),

    'marvel-1': {
      1:'colmar-1', 2:'colmar-2', 3:'colmar-3', 4:'colmar-4',
      5:'colmar-5', 6:'colmar-6', 7:'colmar-7', 8:'colmar-8',
      9:'colmar-10', 10:'colmar-11', 11:'colmar-12', 12:'colmar-9'
    },

    'muppets': {
      1:'coltm-1', 2:'coltm-2', 3:'coltm-3', 4:'coltm-4',
      5:'coltm-5', 6:'coltm-6', 7:'coltm-7', 8:'coltm-8',
      9:'coltm-11', 10:'coltm-9', 11:'coltm-10', 12:'coltm-12'
    },

    'disney-100': seq('coldis100', 18),
    'marvel-2': seq('colmar2', 12)
  };

  for (const series of data) {
    const map = catalog[series.id];
    if (!map) continue;
    series.noRemotePhoto = false;

    for (const fig of series.figures || []) {
      const catalogId = map[fig.number];
      if (!catalogId) continue;
      fig.image = `https://img.bricklink.com/ItemImage/SN/0/${catalogId}.png`;
      fig.imageSource = 'BrickLink';
      fig.imageCatalogId = catalogId;
      fig.noRemotePhoto = false;
    }
  }
})();
