# VentePilot — Plateforme d’intelligence commerciale

Plateforme web de pilotage et d’analyse commerciale, issue du tableau de bord Power BI **VentesDB**
(projet de fin d’année — Mohamed Nizar Chaieb,
ESPRIT Prépa Tunis, département TWIN, 2025/2026).

Le site reproduit les trois pages du rapport Power BI — **Suivi des ventes**, **Analyse des annulations**,
**Détail des commandes** — avec les mêmes indicateurs, calculés en direct depuis une base **MySQL**
dont le schéma reproduit le **modèle en étoile** Power BI (1 table de faits + 4 dimensions).
Les données sont réelles : 1 043 lignes de commandes issues du fichier `sales_2.csv` (2023).

Stack : **React + Vite** (front) · **Express** (API REST) · **MySQL 8** (base de données).

À l’ouverture, le site affiche une page de présentation. Les dashboards reposant sur `sales_2.csv`
sont publics et consultables sans connexion. **Mon espace BI** est distinct : seuls les comptes
connectés et approuvés peuvent y importer et analyser leurs propres CSV. Les nouveaux comptes restent
en attente jusqu’à validation par un administrateur ; seuls les administrateurs peuvent gérer les
comptes et le contenu.

## Prérequis

- Node.js 18+ (et npm)
- MySQL 8
- Docker pour un déploiement conteneurisé (facultatif)

## Installation

### 1. Base de données

Démarrer MySQL (par exemple depuis le panneau de contrôle XAMPP), puis :

```bash
mysql -u root -p < db/schema.sql
mysql -u root -p < db/seed.sql
```

`schema.sql` crée la base `ventesdb` et ses tables. `seed.sql` est généré automatiquement
depuis le fichier `sales_2.csv` (dimensions + 1 043 lignes de faits + insights d’exemple).

Pour une base existante créée avant le système d’approbation, appliquer une seule fois la migration :

```bash
mysql -u root -p ventesdb < db/migrations/001_user_approval.sql
```

Pour une base existante, appliquer aussi une seule fois la migration des espaces client :

```bash
mysql -u root -p ventesdb < db/migrations/002_client_workspaces.sql
```

Appliquer également la migration `003_custom_measures.sql` aux bases existantes
pour activer le constructeur de mesures. Elle est déjà incluse dans `schema.sql`
pour une nouvelle installation.

Appliquer `004_dashboard_layouts.sql` pour enregistrer les dispositions de
graphiques de chaque compte. Cette table est aussi incluse dans `schema.sql`.

Appliquer `005_audit_logs.sql` pour enregistrer les actions admin. Cette table
est aussi incluse dans `schema.sql`.

Les exports et rapports de la phase 3 ne nécessitent pas de migration SQL.

### 2. Serveur (API)

```bash
cd server
npm install
copy .env.example .env # PowerShell ; puis adapter DB_USER / DB_PASSWORD si besoin
```

Définir dans `.env` un `JWT_SECRET` aléatoire d’au moins 32 caractères. Pour
créer le premier compte administrateur, définir `ADMIN_EMAIL` et `ADMIN_PASSWORD`
(8 à 72 octets), puis exécuter une seule fois :

```bash
npm run bootstrap:admin
```

Après la création, retirer `ADMIN_PASSWORD` du fichier `.env`. Le script peut
aussi être relancé pour réinitialiser explicitement cet administrateur.

```bash
npm run dev            # API sur http://localhost:5000
```

`DB_NAME` vaut `ventesdb` par défaut. Aucun compte admin ni mot de passe par défaut
n’est inclus dans le seed ; créez le compte avec le script ci-dessus.

### 3. Client (interface)

```bash
cd client
npm install
npm run dev            # interface sur http://localhost:5173 (proxy /api → :5000)
```

Pour la production : `npm run build` (dossier `dist/`), puis servir `dist/` avec un serveur statique
en pointant `VITE_API_URL` vers l’URL publique de l’API (voir `client/.env.example`).

## Accès et approbation des comptes

- Le compte administrateur est créé explicitement à partir des variables `ADMIN_EMAIL` et `ADMIN_PASSWORD` du fichier `.env`.
- Les visiteurs peuvent consulter les dashboards publics sans compte.
- Les utilisateurs demandent un accès depuis la page d’accueil. Leur compte n’est activé qu’après
  approbation dans **Espace administrateur → Comptes utilisateurs**.
- Un utilisateur suspendu ou en attente ne peut pas consulter les API privées de Mon espace BI.

L’administrateur dispose d’une console distincte avec les indicateurs globaux, la gestion des comptes,
des insights (ajout / modification / suppression) et des messages de contact. La console est organisée
en vues dédiées — vue d’ensemble, utilisateurs, contenu et messages — avec accès rapide aux demandes
en attente et aux principales actions d’administration.

## Assistant de ventes

Dans **Suivi des ventes**, l’assistant comprend les demandes en français concernant la région,
le mois, la catégorie ou le statut, puis applique les filtres au tableau de bord. Exemple :
« montre-moi les ventes du Sud en décembre ». Une période sans année sélectionne la plus récente
disponible ; une année peut être précisée dans la demande. Les filtres restent aussi modifiables
manuellement. L’assistant comprend un ensemble de formulations prédéfini et demande une précision
si la demande n’est pas reconnue ; il ne s’agit pas d’un modèle génératif.

Le texte est interprété localement dans le navigateur. La dictée utilise la reconnaissance vocale
du navigateur, qui peut nécessiter une connexion Internet et dépend de ses paramètres de confidentialité.
Les dashboards de ventes, d’annulations et de commandes, ainsi que la méthodologie et les mesures DAX,
sont consultables sans connexion. Le même assistant est disponible sur les pages de ventes et
d’annulations. Le filtre du mois est également disponible sur les pages d’annulations et de commandes.

## Espace analytique client

Chaque compte approuvé dispose de **Mon espace BI**, entièrement séparé des données publiques de
démonstration basées sur `sales_2.csv` :

- Import de fichiers CSV UTF-8 (jusqu’à 5 Mo, 5 000 lignes et 100 colonnes) avec détection des en-têtes.
- Après connexion, l’utilisateur arrive dans son espace d’import. Une fois un fichier sélectionné,
  les liens « Mon tableau de bord », « Annulations », « Commandes », « Méthodologie » et « Mesures DAX »
  ouvrent des vues calculées depuis ce CSV. Le jeu de données actif est mémorisé par compte ; le
  visiteur garde toujours accès séparément aux routes publiques de démonstration (`/demo` et
  `/demo/...`). Les anciennes routes `/annulations`, `/commandes`, `/methodologie` et `/dax`
  (ainsi que `/client`) affichent les données personnelles à un utilisateur connecté.
- Les rapports s’adaptent aux colonnes détectées. Les statistiques d’annulation ne sont proposées
  que si une colonne de statut/annulation existe, et la valeur à compter peut être choisie par le client.
  La vue Données affiche les colonnes du CSV importé, et non celles du jeu de démonstration.
- Les rapports personnalisés sauvegardés dans Mon espace BI apparaissent également sur le tableau de
  bord du même jeu de données et suivent ses filtres. Le dashboard privé propose des filtres directs
  sur les valeurs catégorielles et les périodes détectées, ainsi qu’un assistant de filtrage en français.
- Un assistant local analyse les graphiques du tableau de bord selon les filtres actifs : tendance
  mensuelle, catégorie en tête, statut le plus fréquent et périmètre analysé. Il répond à des questions
  suggérées et permet de filtrer directement la catégorie principale. Les calculs restent dans le
  navigateur ; il s’agit d’une aide déterministe, pas d’un modèle génératif ni d’un outil de prévision.
- La page Méthodologie propose un modèle en étoile logique dérivé du CSV actif : table de faits par
  ligne source, mesures numériques et dimensions catégorielles/de dates estimées. Le site ne transforme
  pas le CSV en tables relationnelles physiques ; les clés proposées doivent être validées avant toute
  matérialisation.
- Assistant local qui prépare une configuration à partir d’une demande écrite, par exemple « chiffre d’affaires par région en barres » ou « moyenne des quantités par produit ». Ce n’est pas un modèle génératif ; les colonnes et calculs restent modifiables avant enregistrement.
- Rapports personnalisés en somme, moyenne ou nombre de lignes, affichés en barres, courbe, répartition ou tableau. Les rapports peuvent être modifiés ou supprimés.
- Les fichiers et rapports appartiennent au compte qui les a créés. Supprimer un fichier supprime aussi ses rapports.

Les données importées sont conservées dans MySQL dans les tables `custom_datasets` et `saved_reports`.
Les API des dashboards publics lisent les tables fixes du dataset de démonstration et ne lisent ni
n’écrivent ces tables privées. Les routes privées vérifient la session et filtrent les jeux de données
et rapports par l’identifiant du compte authentifié. Appliquer la migration `002_client_workspaces.sql`
aux installations déjà en service.

## Structure du projet

```
ventesdb-site/
├── README.md
├── .gitignore              # Dépendances, builds et fichiers d’environnement
├── CHANGELOG.md            # Historique des changements
├── DEPLOYMENT.md           # Déploiement Docker / Render
├── Dockerfile
├── render.yaml
├── package.json             # Scripts racine de test et build
├── db/
│   ├── schema.sql          # Schéma MySQL : modèle en étoile + tables applicatives
│   └── seed.sql            # Données générées depuis sales_2.csv (1 043 lignes)
│   └── migrations/         # Migrations des bases existantes
├── server/                 # API Express
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js        # App Express, montage des routes, gestion d'erreurs
│       ├── db.js           # Pool MySQL (mysql2/promise)
│       ├── audit.js        # Journal des actions d’administration
│       ├── bootstrapAdmin.js # Création ou réinitialisation explicite du compte admin
│       ├── middleware/
│       │   └── auth.js      # JWT (verifyToken, requireAdmin)
│       └── routes/
│           ├── auth.js     # Inscription et connexion
│           ├── helpers.js  # Filtres et fragments SQL partagés
│           ├── data.js     # KPIs, ventes, annulations, commandes, filtres
│           ├── insights.js # Insights publics en lecture, CRUD admin
│           ├── messages.js # Messages (POST public, gestion admin)
│           ├── users.js    # Gestion admin des comptes
│           ├── customMeasures.js # Mesures de démonstration validées
│           ├── layouts.js  # Dispositions de graphiques par compte
│           ├── audit.js    # Consultation admin du journal
│           └── workspace.js # CSV et rapports privés des clients
│   └── test/               # Tests auth, espace client, mesures et dispositions
└── client/                 # Interface React + Vite
    ├── vite.config.js      # Proxy /api → http://localhost:5000
    └── src/
        ├── api.js          # Client axios + formatage des nombres
        ├── App.jsx         # Routes
        ├── pages/          # Ventes, Annulations, Commandes, espace client, etc.
        ├── assistant/      # Interprétation locale des demandes en français
        ├── workspace/      # Lecture CSV, rapports et insights de graphiques
        ├── pages/Admin/    # Login, Dashboard
        └── components/     # KpiCard, ChartCard, assistants, filtres, navigation, ...
```

## API (base `/api`)

| Méthode | Route | Accès |
|---|---|---|
| GET | `/health` | Public |
| POST | `/auth/login` | Public — limité à 10 tentatives par 15 minutes et par IP |
| POST | `/auth/register` | Public — compte en attente |
| POST | `/auth/change-password` | Utilisateur authentifié — changement de mot de passe |
| GET | `/kpis?region=&categorie=&statut=` | Public — dataset de démonstration |
| GET | `/ventes/mensuel`, `/ventes/par-region`, `/ventes/par-produit`, `/ventes/par-client`, `/ventes/par-statut` | Public — dataset de démonstration |
| GET | `/annulations/mensuel`, `/annulations/par-region`, `/annulations/par-produit`, `/annulations/par-client`, `/annulations/par-categorie` | Public — dataset de démonstration |
| GET | `/commandes?region=&entreprise=&statut=&q=&page=&pageSize=` | Public — dataset de démonstration |
| GET | `/filtres` | Public — dataset de démonstration |
| GET | `/insights?page=ventes\|annulations` | Public — contenu des dashboards |
| POST / PUT / DELETE | `/insights`, `/insights/:id` | Admin |
| POST | `/messages` | Public |
| GET / PATCH / DELETE | `/messages`, `/messages/:id/read`, `/messages/:id` | Admin |
| GET | `/users` | Admin |
| PATCH | `/users/:id/approval` | Admin |
| POST | `/users/:id/password-reset` | Admin — renvoie un mot de passe temporaire affiché une fois |
| GET | `/audit-logs` | Admin — 200 dernières actions sensibles |
| GET / POST | `/workspace/datasets` | Utilisateur authentifié et approuvé — données propres au compte |
| GET / DELETE | `/workspace/datasets/:id` | Propriétaire du jeu de données |
| GET | `/workspace/datasets/:id/rows` | Propriétaire du jeu de données |
| GET / POST | `/workspace/reports` | Utilisateur authentifié et approuvé — rapports propres au compte |
| PUT / DELETE | `/workspace/reports/:id` | Propriétaire du rapport |
| GET | `/measures` | Public — mesures visibles calculées sur le dataset de démonstration |
| GET | `/measures/admin` | Admin — toutes les mesures avec leurs calculs |
| POST | `/measures/preview` | Admin — prévisualisation sur le dataset de démonstration |
| POST / PUT | `/measures`, `/measures/:id` | Admin — création, publication, masquage et ordre |
| GET / PUT | `/layouts/personal` | Utilisateur authentifié — disposition de son espace privé |
| GET | `/layouts/demo` | Public — disposition publiée par le premier compte admin |
| GET / PUT | `/layouts/demo/admin`, `/layouts/demo` | Admin — disposition du dashboard de démonstration |

Les tableaux de commandes et rapports personnalisés proposent un export CSV
et Excel (`.xlsx`) reprenant toutes les lignes filtrées. La page des ventes
permet de télécharger un rapport PDF mensuel avec KPIs, trois graphiques et
calculs associés. Elle compare les KPIs du mois avec le mois précédent et
affiche une estimation du CA net par moyenne mobile sur trois mois.

## Indicateurs affichés (calculés en direct depuis MySQL)

- CA total : **2 397 970** · CA net (hors annulées) : **1 847 828** · Montant annulé : **550 142**
- 500 commandes distinctes · 1 043 lignes · Panier moyen : **4 796**
- 123 commandes annulées = **24,6 %** · 245 lignes annulées = **23,5 %**
- Electronics : 1 493 043 (62,3 %) · Régions : South 664 214, West 638 180, North 562 255, East 533 321
- Top produit : Headphones (334 015) · Top mois : décembre 2023 (247 826 de CA total)

Les formules DAX correspondantes sont présentées sur la page **Mesures DAX** du site
(14 mesures, reproduites depuis l’Annexe B du rapport de stage).

## Mesures personnalisées de démonstration

L’administrateur peut créer et prévisualiser une mesure depuis la rubrique
**Mesures** de sa console. Les formules (`sum`, `average`, `count`, `ratio`,
`taux_annulation`), colonnes et regroupements sont validés côté serveur par
listes blanches ; aucun SQL fourni par l’utilisateur n’est exécuté. Les mesures
publiées apparaissent sur la page de suivi des ventes et suivent ses filtres.
Elles portent sur le dataset de démonstration, pas sur les CSV privés des comptes.

## Disposition des graphiques et insights

Dans les dashboards, **Organiser les graphiques** permet de changer l’ordre et la
visibilité des graphiques. Les préférences sont enregistrées par compte. La page
de démonstration applique la disposition du premier compte admin ; chaque espace
BI conserve sa propre disposition. Les observations locales montrent leur calcul,
dont la comparaison avec la période précédente et, si une région et un statut
d’annulation sont détectés, le taux de lignes annulées par région.

## Sécurité des comptes

L’API utilise Helmet, limite les tentatives de connexion, valide les entrées des
routes d’écriture et journalise les approbations, suspensions, réinitialisations
de mot de passe et publications de mesures. Un utilisateur peut changer son mot
de passe depuis **Profil et paramètres**. La réinitialisation admin produit un
mot de passe temporaire aléatoire, renvoyé une seule fois à la console ; aucune
notification email n’est configurée.

## Routes de démonstration

Les pages de démonstration sont des routes du client React : `/demo` (ventes),
`/demo/annulations`, `/demo/commandes`, `/demo/methodologie` et `/demo/dax`.
Il n’existe pas de route `/demo/ventes` dans cette version.

## Assistant d’analyse des graphiques

`client/src/components/PersonalChartAssistant.jsx` affiche les observations et
questions suggérées. `client/src/workspace/chartInsights.js` calcule localement
la tendance entre les périodes disponibles, la première catégorie, le statut
le plus fréquent et le nombre de lignes ; les réponses reposent sur ces calculs.
Le composant est utilisé dans `PersonalBI.jsx`. Cette fonctionnalité est
déterministe, sans appel à une IA externe. `server/src/ai/` est vide et
n’intervient pas dans l’application.

## Démo et vérification

- URL de démonstration : **[URL démo]** (à remplacer après déploiement).
- Compte lecteur de démonstration : **[compte lecteur à configurer]**. Créez-le
  avec `DEMO_EMAIL` et `DEMO_PASSWORD`, puis exécutez `npm run bootstrap:demo-reader`
  dans `server/`. Ce script crée uniquement un rôle `user` approuvé ; transmettez
  ses identifiants séparément et ne communiquez jamais le compte administrateur.
- Capture d’écran : aucune capture du dashboard n’est fournie dans cette copie.

Depuis la racine, `npm test` exécute les suites client et serveur. `npm run build`
construit le client. Les étapes de déploiement et les migrations sont détaillées
dans [DEPLOYMENT.md](DEPLOYMENT.md).
