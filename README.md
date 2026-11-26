# Cabinet Dentaire — application de gestion d'un cabinet privé

Application de gestion pour **un seul cabinet dentaire avec un seul dentiste**. L'application comporte trois espaces : Patient, Assistante et Dentiste.

## Stack conservée

- Frontend : HTML, CSS et JavaScript vanilla servis par Nginx.
- API Gateway : Node.js / Express / JWT.
- Services : User, Doctor, Appointment et Notification.
- Données : PostgreSQL avec Sequelize.
- Événements asynchrones : RabbitMQ.
- Exécution : Docker Compose.

## Périmètre fonctionnel actuel

- **Patient** : inscription publique, consultation des informations du cabinet, demande de rendez-vous auprès du dentiste unique, consultation de ses propres rendez-vous et notifications.
- **Assistante** : compte créé par le dentiste, accès aux rendez-vous du cabinet, confirmation ou annulation. Les réponses API destinées à l'assistante excluent les notes.
- **Dentiste** : tableau de bord, agenda, liste des patients issue des rendez-vous, notifications et réglages du cabinet. Seul le dentiste peut marquer un rendez-vous comme terminé.

Les dossiers médicaux dentaires, l'odontogramme persistant, le check-in et la file d'attente complète nécessitent encore leurs modèles, règles métier et API dédiés. Ils ne sont pas simulés dans cette version.

## Configuration initiale

1. Copier `.env.example` vers `.env`.
2. Renseigner `JWT_SECRET`, `DB_USER`, `DB_PASS`, `RABBITMQ_USER` et `RABBITMQ_PASS` avec des valeurs fortes.
3. Renseigner `CLINIC_DOCTOR_ID` avec l'UUID du compte dentiste dans `user-db`. Le même UUID doit identifier son profil existant dans `doctor-db`.
4. Ne jamais versionner `.env`, les fichiers SQL de sauvegarde ou `node_modules`.

Si des secrets réels ont été inclus dans une archive partagée, les remplacer avant de remettre le système en service : JWT secret, mot de passe PostgreSQL et identifiants RabbitMQ.

## Démarrage

```bash
docker compose up -d --build
```

Frontend : `http://127.0.0.1:8081`
API Gateway : `http://127.0.0.1:8080/health`

## Tests fournis

```bash
bash test-api.sh
bash test-concurrency.sh
```

Les scripts utilisent le dentiste configuré et ne créent plus de faux profils médecins.

## Conservation des données existantes

Les profils de test et rendez-vous historiques ne sont pas supprimés automatiquement. L'API de consultation de l'application est limitée au dentiste configuré, sans effacer les données historiques des autres profils.
