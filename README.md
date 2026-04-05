# Evaluation Service

Microservice NestJS dédié au **Service Évaluations** du projet **Al-Mizan**.

Il couvre le backlog CSL §3.2.6:
- création d'évaluations d'éligibilité, techniques et financières
- définition des critères et pondérations
- enregistrement des soumissions à évaluer
- notation par critère avec justification
- calcul des scores, éliminations et classement
- génération du rapport final d'évaluation

## Positionnement

Ce service est volontairement séparé du `commission-service`.

Il **ne gère pas**:
- la constitution des commissions
- les séances d'ouverture des plis
- les procès-verbaux d'ouverture

Il **gère**:
- la logique d'évaluation métier
- le scoring technique/financier
- le masquage d'identité pour l'évaluation en aveugle
- les rapports finaux d'évaluation

## Architecture

- Port HTTP: `8008`
- Base de données: `evaluation_db`
- Queue RabbitMQ: `evaluation_events`
- Stockage MinIO: `evaluation-reports`
- Déploiement prévu: derrière API Gateway avec headers `X-User-Id`, `X-User-Roles`, `X-Session-Id`

## Installation

```bash
cd evaluation-service
npm install --legacy-peer-deps
```

## Configuration

```env
PORT=8008
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_DATABASE=evaluation_db
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_QUEUE=evaluation_events
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_PUBLIC_ENDPOINT=localhost
MINIO_PUBLIC_PORT=9000
MINIO_PUBLIC_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_EVALUATION_REPORTS_BUCKET=evaluation-reports
NODE_ENV=development
```

## Démarrage

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS evaluation_db;"
npm run start:dev
```

Build production:

```bash
npm run build
npm run start:prod
```

## Docker

```bash
docker-compose up -d
```

Le compose local démarre:
- `evaluation-service`
- `mysql`
- `rabbitmq`
- `minio`

En Docker local, le service utilise `MINIO_ENDPOINT=minio` pour parler au
conteneur MinIO et `MINIO_PUBLIC_*` pour signer des URL téléchargeables depuis
la machine hôte.

## Swagger et santé

- Swagger: `http://localhost:8008/api/docs`
- Health: `GET /health`

## Cycle de vie métier

Statuts d'une évaluation:

`BROUILLON -> PRETE -> EN_COURS -> TERMINEE -> VALIDEE -> ARCHIVEE`

Annulation possible depuis `BROUILLON`, `PRETE` et `EN_COURS`.

Contraintes appliquées:
- une évaluation `PRETE` doit avoir au moins une soumission
- une évaluation à grille doit avoir des critères totalisant `100`
- une évaluation financière dépendante ne peut démarrer qu'après validation de l'évaluation technique parente
- une évaluation ne peut être `TERMINEE` sans calcul de scores
- une évaluation ne peut être `VALIDEE` sans rapport final généré

## API principale

Base path: `/api/v1/evaluations`

### Évaluations

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/` | Liste paginée avec filtres |
| POST | `/` | Créer une évaluation |
| GET | `/:id` | Détail d'une évaluation |
| PUT | `/:id` | Mettre à jour |
| DELETE | `/:id` | Supprimer si brouillon/annulée |
| PATCH | `/:id/statut` | Changer le statut |

### Critères

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/:id/criteres` | Lister les critères |
| POST | `/:id/criteres` | Ajouter un critère |
| PUT | `/:id/criteres/:criterionId` | Modifier un critère |
| DELETE | `/:id/criteres/:criterionId` | Supprimer un critère |

### Soumissions

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/:id/soumissions` | Lister les soumissions |
| POST | `/:id/soumissions` | Enregistrer une soumission |
| PUT | `/:id/soumissions/:submissionId` | Modifier une soumission |
| DELETE | `/:id/soumissions/:submissionId` | Retirer une soumission |

### Notation et classement

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/:id/soumissions/:submissionId/notes` | Lister les notes |
| POST | `/:id/soumissions/:submissionId/notes` | Créer ou mettre à jour une note |
| POST | `/:id/recalculer-scores` | Calculer scores, éliminations et rangs |
| GET | `/:id/classement` | Consulter le classement |

### Rapport final

| Méthode | Chemin | Description |
|---|---|---|
| POST | `/:id/rapport` | Générer et archiver le rapport PDF |
| GET | `/:id/rapport` | Obtenir le dernier rapport et une URL signée |

## Règles de scoring implémentées

### Évaluation par grille

- moyenne des notes par critère
- score pondéré = `(noteMoyenne / noteMax) * poids`
- score global = somme des scores pondérés
- élimination si critère éliminatoire sous le seuil
- élimination si score global inférieur au seuil minimal

### Évaluation financière

Deux modes sont supportés:
- `GRILLE_CRITERES`
- `FORMULE_MOINS_DISANTE`

Pour `FORMULE_MOINS_DISANTE`:

`scoreFinancier = (offreLaMoinsDisante / offreCourante) * 100`

Si une évaluation technique parente est renseignée:

`scoreGlobal = scoreTechnique * pondérationTechnique + scoreFinancier * pondérationFinancière`

## Masquage d'identité

Le service masque par défaut l'identité des opérateurs quand:
- `modeAveugle = true`
- l'évaluation n'est pas encore `VALIDEE` ou `ARCHIVEE`

Les réponses exposent alors `aliasAnonyme` à la place des champs opérateur.

## Événements RabbitMQ

Événements publiés:

- `evaluation.created`
- `evaluation.updated`
- `evaluation.status_changed`
- `evaluation.criterion.created`
- `evaluation.criterion.updated`
- `evaluation.criterion.removed`
- `evaluation.submission.registered`
- `evaluation.submission.updated`
- `evaluation.submission.removed`
- `evaluation.note.recorded`
- `evaluation.scores.calculated`
- `evaluation.ranking.finalized`
- `evaluation.report.generated`

## Dépendances inter-services

Ce service référence d'autres domaines par identifiants seulement:
- `appelOffreId`
- `commissionId`
- `parentEvaluationId`
- `externalSubmissionId`
- `operateurEconomiqueId`

Il ne crée **aucune clé étrangère cross-service**, afin de respecter l'architecture `Database-per-Service`.

## Intégration attendue

Pour une intégration propre avec les autres microservices:

- `commission-service` fournit la commission responsable
- `submission/document-service` fournit les soumissions et montants financiers après ouverture légale
- `audit-service` consomme les événements métier
- `notification-service` peut notifier la publication du classement et du rapport
- un futur service IA peut injecter des notes de source `IA`

## Seed

```bash
npm run seed
```

Le seed crée:
- une évaluation technique validée avec classement
- une évaluation financière prête à être exploitée
- une évaluation d'éligibilité en brouillon

## Plan d'implémentation retenu

1. Isoler le domaine évaluation dans un microservice dédié.
2. Garder les dépendances inter-services sous forme d'identifiants externes.
3. Implémenter le scoring de manière déterministe et auditable.
4. Masquer les identités pendant les évaluations en aveugle.
5. Générer un rapport PDF stocké dans MinIO.
6. Publier les événements métier pour l'audit et les notifications.
7. Documenter le contrat HTTP, l'environnement et les hypothèses d'intégration.
