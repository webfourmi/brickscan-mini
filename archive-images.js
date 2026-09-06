(() => {
  const data = Array.isArray(window.MINIFIG_DATA) ? window.MINIFIG_DATA : [];

  const overrides = {
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
      fig.image = `https://img.bricklink.com/ItemImage/SN/0/col${prefix}-${bricklinkIndex}.png`;
      fig.imageSource = 'BrickLink';
    }
  }
})();
