# 🏥 Système de rendez-vous médicaux

Application de prise de rendez-vous médicaux basée sur une architecture microservices, avec authentification par rôle (patient / médecin), gestion des créneaux horaires et notifications asynchrones via RabbitMQ.

Interface disponible en **français** et en **arabe** (bascule instantanée, support RTL).

## 📐 Architecture

Chaque service dispose de sa propre base PostgreSQL. La communication est synchrone en HTTP (via Axios) entre services, et asynchrone via RabbitMQ pour les notifications.

## 🧰 Stack technique

- **Backend** : Node.js, Express, Sequelize
- **Bases de données** : PostgreSQL (une par service)
- **Message broker** : RabbitMQ
- **Authentification** : JWT, bcrypt
- **Frontend** : HTML / CSS / JavaScript vanilla, bilingue FR/AR
- **Orchestration** : Docker Compose

## 🚀 Démarrage rapide

### Prérequis
- Docker Desktop

### Installation

```bash
git clone https://github.com/hamdisiwar350-lang/medical-appointment-system.git
cd medical-appointment-system
cp .env.example .env
```

Édite `.env` et renseigne de vraies valeurs (notamment `JWT_SECRET`), puis :

```bash
docker compose up -d --build
```

### Accès aux services

| Service | URL |
|---|---|
| Frontend | http://127.0.0.1:8081 |
| API Gateway | http://127.0.0.1:8080 |
| RabbitMQ Management | http://127.0.0.1:15672 |

> ⚠️ Sous Windows avec Docker Desktop, utilise `127.0.0.1` plutôt que `localhost` pour éviter un bug de résolution IPv6 connu.

## ✨ Fonctionnalités

- Inscription / connexion avec rôle **patient** ou **médecin**
- Création automatique du profil médecin à l'inscription
- Réservation de rendez-vous avec **créneaux horaires réels** (anti-double réservation)
- Filtrage des médecins par spécialité
- Tableau de bord médecin : statistiques, liste des rendez-vous du jour, confirmation/annulation
- Notifications asynchrones via RabbitMQ à chaque nouveau rendez-vous
- Interface bilingue français / arabe avec bascule RTL/LTR

## 🔒 Sécurité

- Secrets externalisés dans `.env` (non versionné)
- Mots de passe hashés avec bcrypt
- Validation des entrées côté serveur
- Contrôle d'accès par rôle au niveau de l'API Gateway
- Un médecin ne peut modifier que ses propres rendez-vous
- Rate limiting anti brute-force sur la connexion

## 📁 Structure du projet

## 📄 Licence

Projet personnel à but éducatif.
