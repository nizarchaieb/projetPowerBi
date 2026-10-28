# Déploiement de VentePilot 3.1.0

## Prérequis

- Un moteur Docker compatible avec le Dockerfile du dépôt.
- Une base MySQL 8 joignable depuis le service web.
- Des valeurs secrètes fournies par l’environnement de déploiement.

Le fichier `render.yaml` configure un service Render à partir du Dockerfile. Il
ne crée pas de base de données ; renseignez un MySQL existant dans `DB_HOST`,
`DB_PORT`, `DB_USER`, `DB_PASSWORD` et `DB_NAME`.

## Préparer MySQL

Pour une nouvelle base, exécutez `db/schema.sql`, puis `db/seed.sql`. Pour une
base existante, appliquez dans l’ordre les migrations qui ne l’ont pas encore
été :

1. `001_user_approval.sql`
2. `002_client_workspaces.sql`
3. `003_custom_measures.sql`
4. `004_dashboard_layouts.sql`
5. `005_audit_logs.sql`

Le seed n’inclut aucun compte administrateur. Définissez `ADMIN_EMAIL` et
`ADMIN_PASSWORD` dans l’environnement du service, puis lancez une seule fois
`npm run bootstrap:admin` dans le conteneur. Retirez ensuite `ADMIN_PASSWORD`
de l’environnement. Le script peut aussi servir à réinitialiser explicitement
le compte admin.

Pour un compte lecteur distinct, définissez `DEMO_EMAIL` et `DEMO_PASSWORD`,
puis lancez `npm run bootstrap:demo-reader`. Il est toujours créé avec le rôle
`user` et l’accès approuvé ; le script refuse l’adresse email d’un administrateur.
Retirez `DEMO_PASSWORD` après la création et communiquez ces identifiants aux
visiteurs séparément.

## Construire et démarrer

```bash
docker build -t ventepilot:3.1.0 .
docker run --env-file server/.env -e PORT=5000 -p 5000:5000 ventepilot:3.1.0
```

Le conteneur construit le client Vite, l’installe comme fichiers statiques du
serveur Express et expose l’API sous `/api`. L’image écoute sur le port 10000
par défaut ; la commande locale ci-dessus remplace ce port par 5000, comme dans
`server/.env.example`. Render fournit son port dynamiquement. L’endpoint de
vérification est `/api/health`.

## Vérifier le déploiement

1. Ouvrir `/api/health` et vérifier la réponse `{ "ok": true, "db": "up" }`.
2. Ouvrir `/` et vérifier le chargement de l’interface.
3. Créer ou approuver un compte lecteur de démonstration. Ne pas communiquer le
   compte administrateur aux visiteurs.

Le serveur refuse de démarrer si `JWT_SECRET` est absent ou fait moins de 32
caractères. Le limiter de connexion utilise le stockage mémoire local ; pour
un déploiement à plusieurs instances, prévoir un store partagé avant de
distribuer le trafic.
