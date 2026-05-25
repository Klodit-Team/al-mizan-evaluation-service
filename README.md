# al-mizan-evaluation-service

> **Service d'Évaluation des Offres** — Notation technique et financière, pondération multicritères et génération de rapports d'évaluation PDF pour la plateforme Al-Mizan.

---

## Table des matières

1. [Aperçu](#aperçu)
2. [Technologies](#technologies)
3. [Architecture & Réseau](#architecture--réseau)
4. [Variables d'environnement](#variables-denvironnement)
5. [API REST](#api-rest)
6. [Messagerie RabbitMQ](#messagerie-rabbitmq)
7. [Commandes utiles](#commandes-utiles)
8. [Docker](#docker)

---

## Aperçu

`al-mizan-evaluation-service` gère le processus d'évaluation des offres des opérateurs économiques soumissionnaires :

- **Notation des offres techniques** : attribution de notes par critère (pondérés) par les membres de la commission.
- **Notation des offres financières** : après ouverture des plis, analyse comparative des prix.
- **Calcul du classement** : score composite technique + financier.
- **Génération de rapports PDF** : rapport d'évaluation officiel stocké sur MinIO via PDFKit.
- **Délibération** : clôture de l'évaluation et recommandation d'attribution.

---

## Technologies

| Technologie       | Version  | Rôle                                              |
|-------------------|----------|---------------------------------------------------|
| Node.js           | 20 LTS   | Runtime                                           |
| TypeScript        | ^5.1     | Langage                                           |
| NestJS            | ^10.0    | Framework (modules, DI, microservices)            |
| TypeORM           | ^0.3.28  | ORM MySQL (entities)                              |
| MySQL             | 8.x      | Base de données principale (`evaluation_db`)      |
| MinIO (SDK)       | ^8.0     | Stockage des rapports d'évaluation PDF            |
| PDFKit            | ^0.17    | Génération de rapports PDF                        |
| amqplib           | ^0.10    | Client RabbitMQ                                   |
| amqp-connection-manager | ^5.0 | Reconnexion automatique RabbitMQ              |
| class-validator   | ^0.15    | Validation des DTOs                               |
| @nestjs/swagger   | ^7.3     | Documentation OpenAPI                             |
| Jest              | ^29.5    | Tests unitaires & e2e                             |

---

## Architecture & Réseau

```
API Gateway (:3000) ──► evaluation-service (:8008)
                                │
                                ├── MySQL    (mysql:3306 → evaluation_db)
                                ├── MinIO    (minio:9000 — bucket: evaluation-reports)
                                └── RabbitMQ (rabbitmq:5672)
```

- **Port exposé** : `8008`
- **Réseau Docker** : `al-mizan-network`
- **Nom du conteneur** : `evaluation-service`
- **Swagger UI** : `http://localhost:8008/api`

> ⚠️ `NODE_ENV=development` est requis pour que TypeORM synchronise automatiquement le schéma en développement. Ne pas utiliser en production.

---

## Variables d'environnement

```env
PORT=8008
NODE_ENV=development

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password
DB_DATABASE=evaluation_db

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# MinIO (S3-compatible)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_EVALUATION_REPORTS_BUCKET=evaluation-reports
```

> ⚠️ En production, remplacer `localhost` par les noms de conteneurs : `mysql`, `rabbitmq`, `minio`.

---

## API REST

Base URL (via Gateway) : `http://localhost:3000/evaluation`  
Base URL (directe) : `http://localhost:8008`  
Swagger : `http://localhost:8008/api`

### Sessions d'Évaluation

| Méthode  | Endpoint                             | Auth | Description                                        |
|----------|--------------------------------------|------|----------------------------------------------------|
| `POST`   | `/evaluations`                       | Oui  | Créer une session d'évaluation pour un AO          |
| `GET`    | `/evaluations/:id`                   | Oui  | Détail d'une session d'évaluation                  |
| `GET`    | `/evaluations?aoId={id}`             | Oui  | Session d'évaluation pour un AO                    |

### Notes par Critère

| Méthode  | Endpoint                                          | Auth | Description                                  |
|----------|---------------------------------------------------|------|----------------------------------------------|
| `POST`   | `/evaluations/:id/notes`                          | Oui  | Soumettre les notes d'une soumission          |
| `GET`    | `/evaluations/:id/notes`                          | Oui  | Lister toutes les notes d'une session         |
| `GET`    | `/evaluations/:id/classement`                     | Oui  | Classement calculé des soumissions            |

### Délibération & Rapport

| Méthode  | Endpoint                                  | Auth | Description                                        |
|----------|-------------------------------------------|------|----------------------------------------------------|
| `POST`   | `/evaluations/:id/cloturer`               | Oui  | Clôturer la session (figer le classement)          |
| `POST`   | `/evaluations/:id/rapport`                | Oui  | Générer le rapport PDF d'évaluation               |
| `GET`    | `/evaluations/:id/rapport/download`       | Oui  | Télécharger le rapport depuis MinIO                |

---

## Messagerie RabbitMQ

**Exchange** : `al-mizan.events` (type: `topic`, durable: `true`)

### Événements publiés

| Routing Key                    | Déclencheur                              | Consommateurs                          |
|--------------------------------|------------------------------------------|----------------------------------------|
| `evaluation.note.soumise`      | Note soumise pour une offre              | audit-service                          |
| `evaluation.cloturee`          | Session d'évaluation clôturée            | appel-offres-service, notification     |
| `evaluation.rapport.genere`    | Rapport PDF généré                       | audit-service                          |

### Événements consommés

| Routing Key              | Source               | Action réalisée                                      |
|--------------------------|----------------------|------------------------------------------------------|
| `ao.status_changed`      | appel-offres-service | Activation de la session d'évaluation (EVALUATION)   |
| `commission.evaluation.cloturee` | commission-service | Réception des notes de la commission             |

---

## Commandes utiles

### Développement local

```bash
npm install
npm run start:dev       # Hot-reload NestJS
npm run build           # Compilation TypeScript
npm run start:prod      # Production
```

### Base de données (TypeORM)

```bash
# Seeder les données initiales
npm run seed
```

> ⚠️ TypeORM est configuré en mode `synchronize: true` en développement. En production, utiliser des migrations TypeORM versionnées.

### Tests

```bash
npm test
npm run test:e2e
npm run test:cov
```

---

## Docker

### Build de l'image

```bash
docker build -t al-mizan-evaluation-service .
```

### Notes importantes sur le Dockerfile

- Image de base : `node:20-alpine`
- **`openssl` installé** pour la compatibilité NestJS/Alpine.
- Au démarrage : `node dist/main` (TypeORM synchronise le schéma automatiquement si `NODE_ENV=development`).

### Déploiement via docker-compose

```bash
docker-compose up -d evaluation-service
docker-compose logs -f evaluation-service
```

---

*Maintenu par l'équipe Al-Mizan — voir `al-mizan-deployments` pour la configuration de déploiement complète.*
