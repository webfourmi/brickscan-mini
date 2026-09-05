(() => {
  const S = (n, set, year, names) => ({
    id: `series-${n}`,
    name: `Série ${n}`,
    set,
    year,
    archive: true,
    scannable: false,
    figures: names.map((pair, i) => ({
      id: `series-${n}-${i + 1}`,
      number: i + 1,
      name: pair[0],
      name_en: pair[1],
      codes: []
    }))
  });

  const archive = [
    S(1, '8683', 2010, [
      ['Chasseur tribal','Tribal Hunter'],['Pom-pom girl','Cheerleader'],['Homme des cavernes','Caveman'],['Clown de cirque','Circus Clown'],['Zombie','Zombie'],['Skateur','Skater'],['Robot','Robot'],['Mannequin de crash-test','Demolition Dummy'],['Magicien','Magician'],['Super catcheur','Super Wrestler'],['Infirmière','Nurse'],['Ninja','Ninja'],['Astronaute','Spaceman'],['Homme de la forêt','Forestman'],['Plongeur en eaux profondes','Deep Sea Diver'],['Cowboy','Cowboy']
    ]),
    S(2, '8684', 2010, [
      ['Joueur de maracas','Maraca Man'],['Guerrier spartiate','Spartan Warrior'],['Monsieur Loyal','Ringmaster'],['Sorcière','Witch'],['Vampire','Vampire'],['Policier de la circulation','Traffic Cop'],['Explorateur','Explorer'],['Sauveteuse','Lifeguard'],['Mime','Mime'],['Haltérophile','Weight Lifter'],['Pop star','Pop Star'],['Skieur','Skier'],['Roi du disco','Disco Dude'],['Karatéka','Karate Master'],['Surfeur','Surfer'],['Pharaon','Pharaoh']
    ]),
    S(3, '8803', 2011, [
      ['Pêcheur','Fisherman'],['Pilote','Pilot'],['Chef tribal','Tribal Chief'],['Guerrier samouraï','Samurai Warrior'],['Snowboardeuse','Snowboarder'],['Méchant de l’espace','Space Villain'],['Lutteur sumo','Sumo Wrestler'],['Momie','Mummy'],['Elfe','Elf'],['Joueuse de tennis','Tennis Player'],['Pilote de course','Race Car Driver'],['Homme en costume de gorille','Gorilla Suit Guy'],['Alien de l’espace','Space Alien'],['Danseuse hula','Hula Dancer'],['Rappeur','Rapper'],['Joueur de baseball','Baseball Player']
    ]),
    S(4, '8804', 2011, [
      ['Nain de jardin','Lawn Gnome'],['Femme en kimono','Kimono Girl'],['Mousquetaire','Musketeer'],['Punk rocker','Punk Rocker'],['Surfeuse','Surfer Girl'],['Viking','Viking'],['Le Monstre','The Monster'],['Joueur de hockey','Hockey Player'],['Skateur de rue','Street Skater'],['Marin','Sailor'],['Footballeur','Soccer Player'],['Loup-garou','Werewolf'],['Spécialiste matières dangereuses','Hazmat Guy'],['Artiste','Artist'],['Patineuse','Ice Skater'],['Scientifique fou','Crazy Scientist']
    ]),
    S(5, '8805', 2011, [
      ['Diplômé','Graduate'],['Gladiateur','Gladiator'],['Garde royal','Royal Guard'],['Pêcheur des glaces','Ice Fisherman'],['Femme des cavernes','Cave Woman'],['Homme lézard','Lizard Man'],['Gardienne de zoo','Zookeeper'],['Bûcheron','Lumberjack'],['Petit clown','Small Clown'],['Coach fitness','Fitness Instructor'],['Détective','Detective'],['Nain maléfique','Evil Dwarf'],['Boxeur','Boxer'],['Reine égyptienne','Egyptian Queen'],['Gangster','Gangster'],['Snowboardeur','Snowboarder Guy']
    ]),
    S(6, '8827', 2012, [
      ['Alien classique','Classic Alien'],['Guerrier des Highlands','Highland Battler'],['Dormeur','Sleepyhead'],['Lady Liberty','Lady Liberty'],['Bandit','Bandit'],['Danseuse flamenco','Flamenco Dancer'],['Robot mécanique','Clockwork Robot'],['Minotaure','Minotaur'],['Leprechaun','Leprechaun'],['Soldat romain','Roman Soldier'],['Chirurgien','Surgeon'],['Skateuse','Skater Girl'],['Fille intergalactique','Intergalactic Girl'],['Boucher','Butcher'],['Mécanicien','Mechanic'],['Génie','Genie']
    ]),
    S(7, '8831', 2012, [
      ['Championne de natation','Swimming Champion'],['Guerrier aztèque','Aztec Warrior'],['Homme en costume de lapin','Bunny Suit Guy'],['Mariée','Bride'],['Roi des océans','Ocean King'],['Joueur de cornemuse','Bagpiper'],['Casse-cou','Daredevil'],['Patrouilleur galactique','Galaxy Patrol'],['As du tennis','Tennis Ace'],['Garçon de la jungle','Jungle Boy'],['Hippie','Hippie'],['Programmeur informatique','Computer Programmer'],['Femme viking','Viking Woman'],['Chevalier maléfique','Evil Knight'],['Rockeuse','Rocker Girl'],['Visiteuse de grand-mère','Grandma Visitor']
    ]),
    S(8, '8833', 2012, [
      ['Robot maléfique','Evil Robot'],['Conquistador','Conquistador'],['Homme en lederhosen','Lederhosen Guy'],['Cow-girl','Cowgirl'],['Joueur de football américain','Football Player'],['Plongeur','Diver'],['Skieur de descente','Downhill Skier'],['Homme d’affaires','Businessman'],['Fée','Fairy'],['Père Noël','Santa'],['Chauve-souris vampire','Vampire Bat'],['DJ','DJ'],['Pom-pom girl rouge','Red Cheerleader'],['Comédien','Thespian'],['Capitaine pirate','Pirate Captain'],['Alien maléfique','Alien Villainess']
    ]),
    S(9, '71000', 2013, [
      ['Serveur','Waiter'],['Cyclope','Cyclops'],['Starlette hollywoodienne','Hollywood Starlet'],['Chevalier héroïque','Heroic Knight'],['Empereur romain','Roman Emperor'],['Policier','Policeman'],['Homme en costume de poulet','Chicken Suit Guy'],['Roller derby girl','Roller Derby Girl'],['Voyante','Fortune Teller'],['Juge','Judge'],['Vengeur alien','Alien Avenger'],['Sirène','Mermaid'],['Mécha de combat','Battle Mech'],['Monsieur Bon et Mauvais','Mr. Good and Evil'],['Dame de la forêt','Forest Maiden'],['Plombier','Plumber']
    ]),
    S(10, '71001', 2013, [
      ['Bibliothécaire','Librarian'],['Méduse','Medusa'],['Commandant romain','Roman Commander'],['Guerrière','Warrior Woman'],['Guerrier tomahawk','Tomahawk Warrior'],['Parachutiste','Skydiver'],['Fille abeille','Bumblebee Girl'],['Grand-père','Grandfather'],['Joueur de paintball','Paintball Player'],['Capitaine de marine','Sea Captain'],['Clown triste','Sad Clown'],['Soldat révolutionnaire','Revolutionary Soldier'],['Joueur de baseball','Baseball Fielder'],['Fashionista','Trendsetter'],['Décorateur','Decorator'],['Mécanicien moto','Motorcycle Mechanic'],['Mr. Gold','Mr. Gold']
    ]),
    S(11, '71002', 2013, [
      ['Barbare','Barbarian'],['Épouvantail','Scarecrow'],['Fille bavaroise','Pretzel Girl'],['Mécha maléfique','Evil Mech'],['Guerrier des îles','Island Warrior'],['Bonhomme en pain d’épices','Gingerbread Man'],['Elfe de Noël','Holiday Elf'],['Yéti','Yeti'],['Alpiniste','Mountain Climber'],['Soudeur','Welder'],['Scientifique','Scientist'],['Saxophoniste de jazz','Jazz Musician'],['Serveuse de diner','Diner Waitress'],['Grand-mère','Grandma'],['Policier britannique','Constable'],['Femme robot','Lady Robot']
    ]),
    S(12, '71007', 2014, [
      ['Magicien','Wizard'],['Guerrier hun','Hun Warrior'],['Princesse de conte de fées','Fairytale Princess'],['Joueur de jeux vidéo','Video Game Guy'],['Déesse guerrière','Battle Goddess'],['Mineur spatial','Space Miner'],['Sauveteuse','Lifeguard'],['Chercheur d’or','Prospector'],['Bouffon','Jester'],['Traqueuse de dinosaures','Dino Tracker'],['Livreur de pizza','Pizza Delivery Guy'],['Rock star','Rock Star'],['Bretteur','Swashbuckler'],['Homme cochon','Piggy Guy'],['Fille génie','Genie Girl'],['Fille effrayante','Spooky Girl']
    ]),
    S(13, '71008', 2015, [
      ['Roi classique','Classic King'],['Shérif','Sheriff'],['Fille licorne','Unicorn Girl'],['Charmeur de serpents','Snake Charmer'],['Gobelin','Goblin'],['Paléontologue','Paleontologist'],['Soldat alien','Alien Trooper'],['Guerrier égyptien','Egyptian Warrior'],['Charpentier','Carpenter'],['Sorcier maléfique','Evil Wizard'],['Escrimeur','Fencer'],['Femme samouraï','Samurai Woman'],['Diva disco','Disco Diva'],['Homme hot-dog','Hot Dog Guy'],['Femme cyclope','Lady Cyclops'],['Soldat galactique','Galaxy Trooper']
    ]),
    S(14, '71010', 2015, [
      ['Homme-loup','Wolf Guy'],['Pirate zombie','Zombie Pirate'],['Scientifique monstre','Monster Scientist'],['Sorcière loufoque','Wacky Witch'],['Monstre végétal','Plant Monster'],['Monstre mouche','Fly Monster'],['Spectre','Specter'],['Pom-pom girl zombie','Zombie Cheerleader'],['Femme tigre','Tiger Woman'],['Gargouille','Gargoyle'],['Squelette','Skeleton Guy'],['Rocker zombie','Zombie Rocker'],['Homme d’affaires zombie','Zombie Businessman'],['Banshee','Banshee'],['Bigfoot','Square Foot'],['Femme araignée','Spider Lady']
    ]),
    S(15, '71011', 2016, [
      ['Fermier','Farmer'],['Astronaute','Astronaut'],['Chevalier terrifiant','Frightening Knight'],['Homme maladroit','Clumsy Guy'],['Femme tribale','Tribal Woman'],['Guerrier volant','Flying Warrior'],['Faune','Faun'],['Contrôleuse animalière','Animal Control'],['Agent d’entretien','Janitor'],['Ballerine','Ballerina'],['Mécha laser','Laser Mech'],['Combattant kendo','Kendo Fighter'],['Homme requin','Shark Suit Guy'],['Champion de catch','Wrestling Champion'],['Voleuse de bijoux','Jewel Thief'],['Reine','Queen']
    ]),
    S(16, '71013', 2016, [
      ['Reine des glaces','Ice Queen'],['Guerrier du désert','Desert Warrior'],['Cyborg','Cyborg'],['Petit diable','Cute Little Devil'],['Garçon effrayant','Spooky Boy'],['Randonneur','Hiker'],['Photographe animalier','Wildlife Photographer'],['Kickboxeuse','Kickboxer'],['Pirate','Scallywag Pirate'],['Garçon pingouin','Penguin Boy'],['Brute','Rogue'],['Gagnant du concours canin','Dog Show Winner'],['Mariachi','Mariachi'],['Espion','Spy'],['Garçon banane','Banana Guy'],['Baby-sitter','Babysitter']
    ]),
    S(17, '71018', 2017, [
      ['Surfeur pro','Pro Surfer'],['Homme fort','Strongman'],['Chef gourmet','Gourmet Chef'],['Homme épi de maïs','Corn Cob Guy'],['Vétérinaire','Veterinarian'],['Vendeur de hot-dogs','Hot Dog Vendor'],['Fille papillon','Butterfly Girl'],['Gladiateur romain','Roman Gladiator'],['Connaisseur','Connoisseur'],['Nain de combat','Battle Dwarf'],['Héros spatial rétro','Retro Space Hero'],['Yuppie','Yuppie'],['Garçon fusée','Rocket Boy'],['Professeure de danse','Dance Instructor'],['Elfe','Elf Maiden'],['Bandit de grand chemin','Highwayman']
    ]),
    S(18, '71021', 2018, [
      ['Fille éléphant','Elephant Girl'],['Homme brique','Brick Suit Guy'],['Fille brique','Brick Suit Girl'],['Clown de fête','Party Clown'],['Homme feu d’artifice','Firework Guy'],['Fille anniversaire','Birthday Party Girl'],['Homme dragon','Dragon Suit Guy'],['Policier classique','Classic Police Officer'],['Garçon araignée','Spider Suit Boy'],['Homme gâteau d’anniversaire','Birthday Cake Guy'],['Fille cactus','Cactus Girl'],['Fille chat','Cat Costume Girl'],['Pilote de course','Race Car Guy'],['Fille pot de fleurs','Flowerpot Girl'],['Garçon anniversaire','Birthday Party Boy'],['Homme licorne','Unicorn Guy'],['Homme cowboy','Cowboy Costume Guy']
    ]),
    S(19, '71025', 2019, [
      ['Champion de jeu vidéo','Video Game Champ'],['Homme sous la douche','Shower Guy'],['Chevalier terrifiant','Fright Knight'],['Roi singe','Monkey King'],['Programmeuse','Programmer'],['Reine momie','Mummy Queen'],['Exploratrice de la jungle','Jungle Explorer'],['Pompier','Firefighter'],['Dog-sitter','Dog Sitter'],['Homme pizza','Pizza Costume Guy'],['Chasseur de primes galactique','Galactic Bounty Hunter'],['Jardinière','Gardener'],['Joueur de rugby','Rugby Player'],['Fille renard','Fox Costume Girl'],['Homme ours','Bear Costume Guy'],['Vététiste','Mountain Biker']
    ]),
    S(20, '71027', 2020, [
      ['Fille en pyjama','Pajama Girl'],['Garçon piñata','Pinata Boy'],['Fille en costume de pois','Peapod Costume Girl'],['Sauveteuse en mer','Sea Rescuer'],['Fille pirate','Pirate Girl'],['Garçon arts martiaux','Martial Arts Boy'],['Breakdanceuse','Breakdancer'],['Super guerrier','Super Warrior'],['Homme brique','Brick Costume Guy'],['Fille lama','Llama Costume Girl'],['Fan de l’espace','Space Fan'],['Athlète','Athlete'],['Chevalier de tournoi','Tournament Knight'],['Musicien des années 80','80s Musician'],['Garçon drone','Drone Boy'],['Viking','Viking']
    ]),
    S(21, '71029', 2021, [
      ['Surfeur à pagaie','Paddle Surfer'],['Garçon violoniste','Violin Kid'],['Naufragé','Shipwreck Survivor'],['Fille coccinelle','Ladybug Girl'],['Homme carlin','Pug Costume Guy'],['Guerrière centaure','Centaur Warrior'],['Apiculteur','Beekeeper'],['Guerrier ancien','Ancient Warrior'],['Fille avion','Airplane Girl'],['Policier spatial','Space Police Guy'],['Alien','Alien'],['Chanteuse de cabaret','Cabaret Singer']
    ]),
    S(22, '71032', 2022, [
      ['Technicienne de réparation robot','Robot Repair Tech'],['Fan en costume de piment','Chili Costume Fan'],['Troubadour','Troubadour'],['Gardien des neiges','Snow Guardian'],['Palefrenier et cheval','Horse and Groom'],['Championne de patinage','Figure Skating Champion'],['Protectrice de la nuit','Night Protector'],['Elfe de la forêt','Forest Elf'],['Ornithologue','Birdwatcher'],['Fan en costume de raton laveur','Raccoon Costume Fan'],['Créature spatiale','Space Creature'],['Athlète en fauteuil','Wheelchair Racer']
    ]),
    S(23, '71034', 2022, [
      ['Robot en carton','Cardboard Robot'],['Elfe de Noël','Holiday Elf'],['Capitaine de ferry','Ferry Captain'],['Costume de dragon vert','Green Dragon Costume'],['Chevalier du château jaune','Knight of the Yellow Castle'],['Casse-noisette','Nutcracker'],['Costume de popcorn','Popcorn Costume'],['Costume de renne','Reindeer Costume'],['Bonhomme de neige','Snowman'],['Fée en sucre','Sugar Fairy'],['Costume de dinde','Turkey Costume'],['Costume de loup','Wolf Costume']
    ]),
    S(24, '71037', 2023, [
      ['Astronaute marron et bébé spatial','Brown Astronaut and Spacebaby'],['Mascotte carotte','Carrot Mascot'],['Protectrice de la nature','Conservationist'],['Fauconnier','Falconer'],['Arbitre de football','Football Referee'],['Garçon vendeur de journaux','Newspaper Kid'],['Orc','Orc'],['Potier','Potter'],['Guerrier robot','Robot Warrior'],['Enfant au cheval à bascule','Rockin Horse Rider'],['Aristocrate rococo','Rococo Aristocrat'],['Fan en costume de T-Rex','T-Rex Costume Fan']
    ])
  ];

  const existing = Array.isArray(window.MINIFIG_DATA) ? window.MINIFIG_DATA : [];
  const numberedExisting = existing.filter(s => /^series-\d+$/.test(s.id));
  const special = existing.filter(s => !/^series-\d+$/.test(s.id));
  const allNumbered = [...archive, ...numberedExisting]
    .filter((series, index, arr) => arr.findIndex(s => s.id === series.id) === index)
    .sort((a, b) => Number(b.id.split('-')[1]) - Number(a.id.split('-')[1]));

  window.MINIFIG_DATA = [...allNumbered, ...special];
})();
