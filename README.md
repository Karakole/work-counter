# Work Counter

Un chronomètre de travail pour freelances et travailleurs libéraux. Mesurez le temps
passé sur les projets de vos clients afin d'établir une facturation factuelle.

**100% hors ligne** — l'application tourne entièrement dans le navigateur, aucune donnée
n'est envoyée sur un serveur. Tout est stocké localement (`localStorage`), avec
export / import au format JSON.

## Fonctionnalités

- Ajout de clients et de projets
- Compteur démarrer / arrêter par projet (avec historique des sessions)
- Temps total par projet, par client et global
- Thème sombre / clair (mémorisé, suit les préférences système par défaut)
- Export des données en JSON, import avec fusion ou remplacement
- Aucune dépendance, aucun build : trois fichiers statiques

## Utilisation

Ouvrez simplement `index.html` dans un navigateur, ou hébergez le dossier tel quel.

### Déploiement sur GitHub Pages

Le projet est constitué de fichiers statiques à la racine. Dans les réglages du dépôt :
**Settings → Pages → Source : Deploy from a branch → `main` / `root`**.

## Structure

- `index.html` — structure de la page
- `styles.css` — thème et mise en page
- `app.js` — logique (compteurs, stockage, export/import)
