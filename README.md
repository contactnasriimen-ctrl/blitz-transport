# Blitz Transport – site web 3D

Site one-page en allemand pour **Blitz Transport** (Mohamad Shahraji, Geschwister-Scholl-Straße 19, 76726 Germersheim).
Une ville de transport 3D de nuit (Three.js) se pilote au scroll : chaque prestation est une « Ausfahrt » (sortie d'autoroute) avec sa propre vue caméra.

| Chapitre | Vue 3D |
| --- | --- |
| Start | Skyline au crépuscule, siège Blitz avec enseigne lumineuse |
| 01 Kurierfahrten | Caméra dans la rue, vans et voitures avec traînées lumineuses |
| 02 Express & Direkt | Caméra qui suit un camion Blitz sur le périphérique |
| 03 Möbeltransporte | Camion de déménagement, rampe, canapé orange devant la maison |
| 04 Umzüge | Quartier résidentiel vu d'en haut |
| 05 Waren & Stückgut | Dépôt : entrepôts, conteneurs, camions à quai |
| 06 Nachtexpress | Nuit profonde, lune, les fenêtres s'éteignent |
| 07 Europaweit | Zoom jusqu'à une carte de l'Europe la nuit, routes animées vers 13 villes |
| Warum / Ablauf / Anfrage | Retour à l'aube ; formulaire « Frachtbrief » (lettre de voiture) |

## Commandes

```bash
npm install
npm run dev       # développement  → http://localhost:5181
npm run build     # production     → dossier dist/
npm run preview   # tester dist/   → http://localhost:8131
```

## Données de l'entreprise : `site.config.json`

Domaine, e-mail, téléphone, WhatsApp, adresse et Steuernummer sont dans **un seul fichier**.
Après chaque modification : `npm run build`. Les pages HTML, `contact.php`, `sitemap.xml` et `robots.txt` sont régénérés.

## Mise en ligne (OVH ou autre hébergement Apache + PHP)

1. `npm run build`
2. Avec FileZilla, envoyer **tout le contenu** de `dist/` dans le dossier `www/` de l'hébergement.
   Le fichier `.htaccess` est caché : dans FileZilla, activer *Serveur → Forcer l'affichage des fichiers cachés*.
3. Le `.htaccess` force HTTPS et `www.` : le certificat SSL doit être actif.

## À vérifier avant le lancement

- **Domaine** : `blitz-transport-germersheim.de` n'est qu'une proposition (aucun DNS trouvé le 11/11/2026, donc probablement libre). À réserver ou à remplacer dans `site.config.json` (`siteUrl`, `email`, `mailFrom`).
- **E-mail** : créer la boîte `info@…` chez l'hébergeur. `mailFrom` doit être une adresse du **même domaine**, sinon les mails du formulaire finissent en spam.
- **Formulaire** : envoyer une vraie demande de test une fois en ligne. Sans PHP (aperçu local), le site ouvre le logiciel de messagerie avec la demande déjà remplie.
- **WhatsApp** : les boutons utilisent le 0176 70166088. Vérifier que ce numéro a bien WhatsApp.
- **Impressum** : la Steuernummer y figure parce qu'elle était dans le brief. La loi ne l'exige pas (seule une USt-IdNr serait obligatoire) et beaucoup de conseillers déconseillent de la publier. Si le client a une USt-IdNr, l'ajouter.
- **Datenschutz** : modèle sans cookies ni tracking, à faire relire. Le nom de l'hébergeur n'est pas cité ; on peut l'ajouter au point 2.
- **Google** : sur Maps, la fiche s'appelle « Al Shahraji Transport ». Pour le SEO local, aligner le nom sur la fiche Google Business ou ajouter « Blitz Transport ». Envoyer ensuite `https://…/sitemap.xml` dans la Search Console.

## Structure

```
index.html, impressum.html, datenschutz.html   pages (texte allemand)
site.config.json                               données de l'entreprise
server/contact.php                             formulaire → e-mail (anti-spam : honeypot, délai, 5 envois/h/IP)
src/main.js                                    scroll → caméra, navigation, formulaire
src/styles.css                                 design (couleurs dans :root)
src/scene/                                     ville 3D
  layout.js     plan de la ville, coordonnées Europe
  world.js      sol, immeubles, autoroutes, dépôt, scène déménagement, enseigne
  vehicles.js   camions / vans / voitures / camions de déménagement + traînées
  atmosphere.js ciel, étoiles, lune, lumières de l'Europe, arcs vers les villes
  camera.js     une « station » caméra par chapitre + transitions
  shaders.js    shaders (fenêtres procédurales, routes, brouillard…)
public/                                        favicon, icône Apple, image de partage, .htaccess
```

## Vitesse (Lighthouse, 12/11/2026, aperçu local sans gzip)

| | Performance | Accessibilité | Bonnes pratiques | SEO |
| --- | --- | --- | --- | --- |
| Avant | mobile 54 · desktop 62 | 92 · 96 | 100 | 100 |
| Après | mobile 83–91 · desktop 100 | 100 · 100 | 100 | 100 |

Ce qui a changé :
- Une image « poster » (`public/poster-wide.webp`, `poster-tall.webp`) montre la ville tout de suite. La vraie 3D démarre au premier geste (scroll, toucher, souris) puis apparaît en fondu. Sur ordinateur, elle démarre aussi toute seule 6 s après le chargement.
- CSS intégré dans le HTML, polices du premier écran préchargées, code 3D préchargé en arrière-plan.
- `content-visibility: auto` sur les chapitres hors écran : la mise en page initiale passe d'environ 1,3 s à environ 0,3 s sur un mobile moyen.
- Animation du titre en CSS pur, sans flou, donc sans attendre le JavaScript.
- **Si la scène 3D change**, régénérer les posters (script puppeteer `posters.cjs` utilisé pendant le développement ; sinon, faire une capture du héros sans le texte).

### Mode « léger » (12/11/2026, à la demande du client : le site ramait)

- Plus de post-traitement (bloom) : rendu direct à l'écran, avec tone mapping et sRGB ajoutés à chaque shader (`M()` dans `shaders.js`).
- 30 images/s quand rien ne bouge, 60 pendant le scroll (téléphones : toujours 30). Résolution max 1,25× (téléphones 1×), sans anti-crénelage.
- Moitié moins de véhicules, d'étoiles et de points lumineux sur la carte d'Europe. Mouvements à 70 % de la vitesse.
- Le sol et le ciel sont dessinés après les immeubles, et les immeubles sont triés de l'avant vers l'arrière, donc les pixels cachés ne sont plus calculés.
- Aucun `backdrop-filter` (flou) au-dessus du canvas.
- Résultat sur la carte Intel UHD de ce PC, à 1440×900 : environ 26–31 ms par image → environ 13 ms, soit 2 à 2,5 fois moins de travail.

## SEO

- Balises title, description et keywords, géo (DE-RP / Germersheim), Open Graph avec l'image de partage.
- Données structurées : `MovingCompany` (16 villes dans `areaServed`) et `FAQPage` (6 questions, éligibles aux résultats enrichis Google).
- Section visible « Häufige Fragen » + « Unser Einsatzgebiet » (Germersheim, Speyer, Landau, Karlsruhe, Mannheim, Ludwigshafen, Heidelberg…).
- Hashtags dans le pied de page : #BlitzTransport #TransportGermersheim #UmzugGermersheim… Google ne s'en sert pas pour le classement. Ils servent surtout à réutiliser les mêmes tags sur Instagram, Facebook et la fiche Google.

## Cookies, Impressum, Datenschutz

- Le site ne pose **aucun cookie**. Le bandeau « Cookies & Datenschutz » l'indique et renvoie vers Datenschutz et Impressum. « Verstanden » est mémorisé en localStorage (`blitz-cookie-hinweis`).
- Le bandeau se rouvre avec le lien « Cookies » du pied de page, de la carte contact et de la Datenschutzerklärung (section 7, ancre `#cookies`).
- Impressum (`/impressum.html`) et Datenschutz (`/datenschutz.html`) sont liés dans le pied de page de chaque page, la carte contact et le bandeau.

## Notes techniques

- Aucune ressource externe : polices auto-hébergées, Three.js intégré au bundle. Conforme au RGPD, sans bannière cookies.
- Qualité adaptative : si l'appareil descend sous ~28 i/s, la résolution baisse, puis le bloom se coupe.
- `prefers-reduced-motion` : véhicules et caméra immobiles, pas de flash.
- Sans WebGL : fond de skyline en CSS, tout le contenu reste lisible.
- Dans les shaders, ne jamais faire `pow()` d'une valeur négative : sous Direct3D cela donne un NaN que le bloom étale sur tout l'écran (écran noir à certaines tailles de fenêtre).
