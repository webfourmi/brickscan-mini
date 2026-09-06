(() => {
  const data = Array.isArray(window.MINIFIG_DATA) ? window.MINIFIG_DATA : [];

  // Audit complet Série 1 à 24 contre les références BrickLink colNN-X.
  // Séries 1-17, 19, 21 et 22 : l'ordre interne correspond déjà à BrickLink.
  // Séries 18, 20, 23 et 24 : ordre interne différent, donc mapping explicite.
  const overrides = {
    'series-18': {
      15: 16, // Birthday Party Boy
      16: 17, // Unicorn Guy
      17: 15  // Cowboy Costume Guy
    },
    'series-20': {
      1: 15, // Pajama Girl
      2: 1,  // Pinata Boy
      3: 3,  // Peapod Costume Girl
      4: 12, // Sea Rescuer
      5: 5,  // Pirate Girl
      6: 10, // Martial Arts Boy
      7: 2,  // Breakdancer
      8: 9,  // Super Warrior
      9: 13, // Brick Costume Guy
      10: 7, // Llama Costume Girl
      11: 6, // Space Fan
      12: 11,// Athlete
      13: 4, // Tournament Knight
      14: 14,// 80s Musician
      15: 16,// Drone Boy
      16: 8  // Viking
    },
    'series-23': {
      1: 6,  // Cardboard Robot
      2: 5,  // Holiday Elf
      3: 10, // Ferry Captain
      4: 12, // Green Dragon Costume
      5: 11, // Knight of the Yellow Castle
      6: 1,  // Nutcracker
      7: 7,  // Popcorn Costume
      8: 4,  // Reindeer Costume
      9: 3,  // Snowman
      10: 2, // Sugar Fairy
      11: 9, // Turkey Costume
      12: 8  // Wolf Costume
    },
    'series-24': {
      1: 3,  // Brown Astronaut and Spacebaby
      2: 4,  // Carrot Mascot
      3: 8,  // Conservationist
      4: 5,  // Falconer
      5: 1,  // Football Referee
      6: 12, // Newspaper Kid
      7: 7,  // Orc
      8: 9,  // Potter
      9: 2,  // Robot Warrior
      10: 11,// Rockin' Horse Rider
      11: 10,// Rococo Aristocrat
      12: 6  // T-Rex Costume Fan
    }
  };

  for (const series of data) {
    const match = /^series-(\d+)$/.exec(series.id || '');
    if (!match) continue;
    const n = Number(match[1]);
    if (!Number.isFinite(n) || n < 1 || n > 24) continue;

    const prefix = String(n).padStart(2, '0');
    for (const fig of series.figures || []) {
      const bricklinkIndex = overrides[series.id]?.[fig.number] || fig.number;
      const catalogId = `col${prefix}-${bricklinkIndex}`;
      fig.image = `https://img.bricklink.com/ItemImage/SN/0/${catalogId}.png`;
      fig.imageSource = 'BrickLink';
      fig.imageCatalogId = catalogId;
    }
  }
})();
