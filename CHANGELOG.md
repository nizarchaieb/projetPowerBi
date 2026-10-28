# Changelog

## 3.1.0 — 2026-10-28

### Ajouts

- Ajout d’un script `npm test` côté client et serveur et d’un script de test à la racine.
- Ajout de tests serveur pour authentification, isolation workspace, mesures et dispositions ; 18 tests client et 10 tests serveur passent.
- Audit des routes, assistants et de la documentation ; ajout des règles `.gitignore` pour dépendances, builds et fichiers `.env`.
- Constructeur admin de mesures de démonstration avec prévisualisation, formules contrôlées, publication, masquage et ordre ; migration `003_custom_measures.sql`.
- Dispositions de graphiques configurables et enregistrées par compte, insights comparatifs avec calculs affichés, skeletons de chargement et état vide réinitialisable ; migration `004_dashboard_layouts.sql`.
- Exports CSV et Excel `.xlsx` des commandes et rapports filtrés, rapport PDF mensuel, comparaison des KPIs entre périodes et estimation du CA net par moyenne mobile sur trois mois.
- Protection Helmet, limite de dix connexions par IP sur quinze minutes, validations renforcées des écritures, changement de mot de passe et réinitialisation admin avec mot de passe temporaire.
- Journal des approbations, suspensions, réinitialisations et publications de mesures ; migration `005_audit_logs.sql`.
- Création du compte admin et d’un compte lecteur de démonstration par bootstrap depuis des variables d’environnement ; le lecteur est toujours un rôle `user`. Suppression du mot de passe et du compte admin par défaut du seed.
- Dockerfile multi-étapes, configuration Render, guide `DEPLOYMENT.md` et service Express qui sert le build du client.
- Mise à jour du README pour l’installation en trois étapes, les migrations, les scripts de bootstrap, les tests et les placeholders du compte de démonstration lecteur.

### Dépendances

- Ajout de Helmet `8.3.0` et express-rate-limit `8.7.1`.
- Mise à jour des dépendances transitives vulnérables ; `npm audit` signale zéro vulnérabilité.
