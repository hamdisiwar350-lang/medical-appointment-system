# Notes de nettoyage — Cabinet Dentaire

Cette version conserve le stack initial (HTML/CSS/JS, Node.js/Express, PostgreSQL, RabbitMQ et Docker Compose) et adapte le périmètre à un seul cabinet avec un seul dentiste.

## Modifications incluses

- Identité visuelle dentaire commune : sidebar teal, navigation active purple, espace lavender/bleu clair, cartes blanches.
- Espace Patient : réservation directement auprès du dentiste configuré et suivi des rendez-vous personnels. Le choix d'un médecin et le filtre par spécialité ont été retirés.
- Espace Assistante : agenda, demandes de rendez-vous, confirmation et annulation. Les réponses de cette API n'incluent pas les notes.
- Espace Dentiste : tableau de bord, agenda, liste de patients liée aux rendez-vous et paramètres du cabinet.
- API limitée au dentiste configuré par `CLINIC_DOCTOR_ID`, sans suppression automatique des anciens profils ou rendez-vous.
- Traductions et éléments multi-médecins inutilisés retirés.
- `.gitignore` renforcé pour ignorer `.env`, dumps SQL et sauvegardes.

## Pas encore implémenté

Le check-in persistant, la file d'attente opérationnelle, les dossiers médicaux dentaires et l'odontogramme persistant demandent des modèles et API dédiés. Ils ne sont pas présentés comme fonctionnels dans cette version.

## Application à votre dépôt local

1. Décompresser l'archive dans un dossier temporaire.
2. Copier le contenu du dossier `medical-appointment-cleaned` dans le dossier de votre dépôt local existant, en acceptant le remplacement des fichiers.
3. **Ne pas remplacer ni supprimer le dossier `.git` ni votre fichier `.env` local.**
4. Ajouter `CLINIC_DOCTOR_ID` à votre `.env` avec l'UUID du compte dentiste existant. Dans les données actuellement décrites dans la conversation, cet UUID était `81e32a04-eecb-4daf-85bc-611313b885e8`; vérifiez-le dans vos bases avant le démarrage.
5. Reconstruire avec `docker compose up -d --build` puis exécuter `bash test-api.sh`.

L'archive ne contient aucun `.env`, dossier `.git`, `node_modules` ni sauvegarde SQL.
