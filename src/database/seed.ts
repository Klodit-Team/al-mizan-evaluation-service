import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { EvaluationCriterion } from '../evaluation/entities/evaluation-criterion.entity';
import { EvaluationReport } from '../evaluation/entities/evaluation-report.entity';
import { EvaluationResult } from '../evaluation/entities/evaluation-result.entity';
import { EvaluationSubmission } from '../evaluation/entities/evaluation-submission.entity';
import { Evaluation } from '../evaluation/entities/evaluation.entity';
import { EvaluationRecommendation } from '../evaluation/enums/evaluation-recommendation.enum';
import { EvaluationScoringMode } from '../evaluation/enums/evaluation-scoring-mode.enum';
import { EvaluationStatus } from '../evaluation/enums/evaluation-status.enum';
import { EvaluationSubmissionStatus } from '../evaluation/enums/evaluation-submission-status.enum';
import { EvaluationType } from '../evaluation/enums/evaluation-type.enum';

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'evaluation_db',
  entities: [
    Evaluation,
    EvaluationCriterion,
    EvaluationSubmission,
    EvaluationResult,
    EvaluationReport,
  ],
  synchronize: true,
  charset: 'utf8mb4',
});

async function seed() {
  await dataSource.initialize();

  const evaluationRepo = dataSource.getRepository(Evaluation);
  const criterionRepo = dataSource.getRepository(EvaluationCriterion);
  const submissionRepo = dataSource.getRepository(EvaluationSubmission);
  const resultRepo = dataSource.getRepository(EvaluationResult);
  const reportRepo = dataSource.getRepository(EvaluationReport);

  const existing = await evaluationRepo.count();
  if (existing > 0) {
    console.log('Seed skipped: evaluation data already exists.');
    await dataSource.destroy();
    return;
  }

  const technicalEvaluation = await evaluationRepo.save(
    evaluationRepo.create({
      reference: 'EV-2026-0001',
      appelOffreId: 'ao-2026-001',
      commissionId: 'cope-2026-001',
      type: EvaluationType.TECHNIQUE,
      scoringMode: EvaluationScoringMode.GRILLE_CRITERES,
      objet: "Evaluation technique de l'AO 2026-001",
      description:
        'Jeu de données de démonstration pour le classement technique.',
      modeAveugle: true,
      minimumOverallScore: 60,
      recommendationThreshold: 75,
      technicalWeight: 100,
      financialWeight: 0,
      statut: EvaluationStatus.VALIDEE,
      createdBy: 'seed-script',
      validatedBy: 'seed-script',
      startedAt: new Date(),
      completedAt: new Date(),
      validatedAt: new Date(),
      lastCalculatedAt: new Date(),
    }),
  );

  await criterionRepo.save([
    criterionRepo.create({
      evaluationId: technicalEvaluation.id,
      code: 'TECH-01',
      libelle: 'Méthodologie',
      poids: 40,
      noteMax: 100,
      noteMinimale: 50,
      eliminatoire: true,
      ordre: 1,
    }),
    criterionRepo.create({
      evaluationId: technicalEvaluation.id,
      code: 'TECH-02',
      libelle: "Organisation de l'équipe",
      poids: 35,
      noteMax: 100,
      noteMinimale: 40,
      eliminatoire: false,
      ordre: 2,
    }),
    criterionRepo.create({
      evaluationId: technicalEvaluation.id,
      code: 'TECH-03',
      libelle: 'Planning de réalisation',
      poids: 25,
      noteMax: 100,
      noteMinimale: 40,
      eliminatoire: false,
      ordre: 3,
    }),
  ]);

  const technicalSubmissions = await submissionRepo.save([
    submissionRepo.create({
      evaluationId: technicalEvaluation.id,
      externalSubmissionId: 'submission-ao001-01',
      operateurEconomiqueId: 'oe-001',
      operateurNom: 'SARL Atlas Equipements',
      aliasAnonyme: 'SOUM-001',
      montantOffre: 1520000,
      devise: 'DZD',
      statut: EvaluationSubmissionStatus.QUALIFIEE,
      scoreTechnique: 86.4,
      scoreGlobal: 86.4,
      scoreMoyen: 86.67,
      rang: 1,
      recommandation: EvaluationRecommendation.RETENIR,
    }),
    submissionRepo.create({
      evaluationId: technicalEvaluation.id,
      externalSubmissionId: 'submission-ao001-02',
      operateurEconomiqueId: 'oe-002',
      operateurNom: 'EURL Numidia Services',
      aliasAnonyme: 'SOUM-002',
      montantOffre: 1475000,
      devise: 'DZD',
      statut: EvaluationSubmissionStatus.QUALIFIEE,
      scoreTechnique: 79.8,
      scoreGlobal: 79.8,
      scoreMoyen: 80,
      rang: 2,
      recommandation: EvaluationRecommendation.RETENIR,
    }),
    submissionRepo.create({
      evaluationId: technicalEvaluation.id,
      externalSubmissionId: 'submission-ao001-03',
      operateurEconomiqueId: 'oe-003',
      operateurNom: 'SPA El Djazair Tech',
      aliasAnonyme: 'SOUM-003',
      montantOffre: 1600000,
      devise: 'DZD',
      statut: EvaluationSubmissionStatus.ELIMINEE,
      scoreTechnique: 51.4,
      scoreGlobal: 51.4,
      scoreMoyen: 54,
      recommandation: EvaluationRecommendation.ELIMINER,
      motifElimination:
        'Critère éliminatoire Méthodologie sous le seuil requis.',
    }),
  ]);

  await resultRepo.save([
    resultRepo.create({
      evaluationId: technicalEvaluation.id,
      evaluationSubmissionId: technicalSubmissions[0].id,
      scoreTechnique: 86.4,
      scoreGlobal: 86.4,
      scoreMoyen: 86.67,
      rang: 1,
      recommandation: EvaluationRecommendation.RETENIR,
      eliminee: false,
      calculatedAt: new Date(),
      detailCalcul: { source: 'seed' },
    }),
    resultRepo.create({
      evaluationId: technicalEvaluation.id,
      evaluationSubmissionId: technicalSubmissions[1].id,
      scoreTechnique: 79.8,
      scoreGlobal: 79.8,
      scoreMoyen: 80,
      rang: 2,
      recommandation: EvaluationRecommendation.RETENIR,
      eliminee: false,
      calculatedAt: new Date(),
      detailCalcul: { source: 'seed' },
    }),
    resultRepo.create({
      evaluationId: technicalEvaluation.id,
      evaluationSubmissionId: technicalSubmissions[2].id,
      scoreTechnique: 51.4,
      scoreGlobal: 51.4,
      scoreMoyen: 54,
      recommandation: EvaluationRecommendation.ELIMINER,
      eliminee: true,
      motifElimination:
        'Critère éliminatoire Méthodologie sous le seuil requis.',
      calculatedAt: new Date(),
      detailCalcul: { source: 'seed' },
    }),
  ]);

  await reportRepo.save(
    reportRepo.create({
      evaluationId: technicalEvaluation.id,
      version: 1,
      fileName: 'EV-2026-0001-rapport-v1.pdf',
      bucket:
        process.env.MINIO_EVALUATION_REPORTS_BUCKET ?? 'evaluation-reports',
      objectKey: 'EV-2026-0001/EV-2026-0001-rapport-v1.pdf',
      contentType: 'application/pdf',
      size: 1024,
      checksum: createHash('sha256').update('seed-report').digest('hex'),
      storageUrl:
        'http://localhost:9000/evaluation-reports/EV-2026-0001/EV-2026-0001-rapport-v1.pdf',
      generatedBy: 'seed-script',
      generatedAt: new Date(),
    }),
  );

  const financialEvaluation = await evaluationRepo.save(
    evaluationRepo.create({
      reference: 'EV-2026-0002',
      appelOffreId: 'ao-2026-001',
      commissionId: 'cope-2026-001',
      parentEvaluationId: technicalEvaluation.id,
      type: EvaluationType.FINANCIERE,
      scoringMode: EvaluationScoringMode.FORMULE_MOINS_DISANTE,
      objet: "Evaluation financière de l'AO 2026-001",
      description:
        'Evaluation financière prête à démarrer après ouverture officielle.',
      modeAveugle: false,
      minimumOverallScore: 0,
      recommendationThreshold: 70,
      technicalWeight: 70,
      financialWeight: 30,
      statut: EvaluationStatus.PRETE,
      createdBy: 'seed-script',
    }),
  );

  await submissionRepo.save([
    submissionRepo.create({
      evaluationId: financialEvaluation.id,
      externalSubmissionId: 'submission-ao001-01',
      operateurEconomiqueId: 'oe-001',
      operateurNom: 'SARL Atlas Equipements',
      aliasAnonyme: 'SOUM-001',
      montantOffre: 1520000,
      devise: 'DZD',
      statut: EvaluationSubmissionStatus.EN_ATTENTE,
    }),
    submissionRepo.create({
      evaluationId: financialEvaluation.id,
      externalSubmissionId: 'submission-ao001-02',
      operateurEconomiqueId: 'oe-002',
      operateurNom: 'EURL Numidia Services',
      aliasAnonyme: 'SOUM-002',
      montantOffre: 1475000,
      devise: 'DZD',
      statut: EvaluationSubmissionStatus.EN_ATTENTE,
    }),
  ]);

  await evaluationRepo.save(
    evaluationRepo.create({
      reference: 'EV-2026-0003',
      appelOffreId: 'ao-2026-002',
      commissionId: 'cope-2026-002',
      type: EvaluationType.ELIGIBILITE,
      scoringMode: EvaluationScoringMode.GRILLE_CRITERES,
      objet: "Evaluation d'éligibilité de l'AO 2026-002",
      description: 'Brouillon prêt à être paramétré.',
      modeAveugle: true,
      minimumOverallScore: 100,
      recommendationThreshold: 100,
      technicalWeight: 100,
      financialWeight: 0,
      statut: EvaluationStatus.BROUILLON,
      createdBy: 'seed-script',
    }),
  );

  console.log('Evaluation service seed completed.');
  await dataSource.destroy();
}

seed().catch(async (error) => {
  console.error('Seed failed:', error);
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
  process.exit(1);
});
