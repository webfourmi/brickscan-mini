# BrickScan Mini

PWA mobile en français pour identifier les minifigurines de collection à partir des codes Data Matrix présents sous les boîtes.

## Utilisation

1. Héberger le dossier sur un site HTTPS (GitHub Pages fonctionne).
2. Ouvrir l’adresse sur le téléphone.
3. Autoriser la caméra.
4. Appuyer sur **Scanner** et viser le Data Matrix.
5. Sur Android/Chrome/Samsung Internet, le scanner natif est utilisé quand `BarcodeDetector` prend en charge `data_matrix`.
6. Sinon, un moteur de secours `html5-qrcode` est chargé depuis jsDelivr.

La saisie manuelle fonctionne sans caméra. Les données de collection et l’historique restent dans `localStorage`.

## Séries incluses
Séries 25–29, Dungeons & Dragons, Spider-Man: Across the Spider-Verse.

## Note
Projet indépendant de fan. LEGO® est une marque du groupe LEGO. Les codes sont des données communautaires et peuvent évoluer selon les lots/régions.
