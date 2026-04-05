import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationService } from './evaluation.service';
import { Evaluation } from './entities/evaluation.entity';
import { EvaluationCriterion } from './entities/evaluation-criterion.entity';
import { EvaluationSubmission } from './entities/evaluation-submission.entity';
import { EvaluationNote } from './entities/evaluation-note.entity';
import { EvaluationResult } from './entities/evaluation-result.entity';
import { EvaluationReport } from './entities/evaluation-report.entity';
import { EvaluationType } from './enums/evaluation-type.enum';
import { EvaluationScoringMode } from './enums/evaluation-scoring-mode.enum';
import { EvaluationStatus } from './enums/evaluation-status.enum';
import { EvaluationSubmissionStatus } from './enums/evaluation-submission-status.enum';
import { EvaluationRecommendation } from './enums/evaluation-recommendation.enum';
import { RABBITMQ_CLIENT } from '../common/messaging/rabbitmq.module';
import { MinioService } from '../common/services/minio.service';

const createIdFactory = () => {
  let counter = 1;
  return () => `00000000-0000-0000-0000-${String(counter++).padStart(12, '0')}`;
};

describe('EvaluationService', () => {
  let service: EvaluationService;
  let evaluationRepo: any;
  let criterionRepo: any;
  let submissionRepo: any;
  let noteRepo: any;
  let resultRepo: any;
  let reportRepo: any;
  let rabbitClient: { emit: jest.Mock };

  let evaluations: Evaluation[];
  let criteria: EvaluationCriterion[];
  let submissions: EvaluationSubmission[];
  let notes: EvaluationNote[];
  let results: EvaluationResult[];
  let reports: EvaluationReport[];
  let nextId: () => string;

  const makeRepoHelpers = <T extends { id?: string }>(collection: T[]) => ({
    create: jest.fn((data: Partial<T>) => data as T),
    save: jest.fn(async (input: T | T[]) => {
      const items = Array.isArray(input) ? input : [input];
      const saved = items.map((item) => {
        if (!item.id) {
          item.id = nextId();
        }
        const existingIndex = collection.findIndex(
          (entry) => entry.id === item.id,
        );
        const snapshot = { ...item } as T;
        if (existingIndex >= 0) {
          collection[existingIndex] = snapshot;
        } else {
          collection.push(snapshot);
        }
        return snapshot;
      });
      return Array.isArray(input) ? saved : saved[0];
    }),
    remove: jest.fn(async (input: T | T[]) => {
      const items = Array.isArray(input) ? input : [input];
      items.forEach((item) => {
        const index = collection.findIndex((entry) => entry.id === item.id);
        if (index >= 0) {
          collection.splice(index, 1);
        }
      });
    }),
  });

  beforeEach(async () => {
    evaluations = [];
    criteria = [];
    submissions = [];
    notes = [];
    results = [];
    reports = [];
    nextId = createIdFactory();

    const evaluationHelpers = makeRepoHelpers(evaluations);
    const criterionHelpers = makeRepoHelpers(criteria);
    const submissionHelpers = makeRepoHelpers(submissions);
    const noteHelpers = makeRepoHelpers(notes);
    const resultHelpers = makeRepoHelpers(results);
    const reportHelpers = makeRepoHelpers(reports);

    evaluationRepo = {
      ...evaluationHelpers,
      count: jest.fn(async () => evaluations.length),
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(async (options: any) => {
        const id = options?.where?.id;
        const evaluation = evaluations.find((entry) => entry.id === id) ?? null;
        if (!evaluation) {
          return null;
        }

        if (options?.relations) {
          return {
            ...evaluation,
            criteres: criteria
              .filter((entry) => entry.evaluationId === evaluation.id)
              .sort((left, right) => left.ordre - right.ordre),
            soumissions: submissions.filter(
              (entry) => entry.evaluationId === evaluation.id,
            ),
            rapports: reports.filter(
              (entry) => entry.evaluationId === evaluation.id,
            ),
          };
        }

        return { ...evaluation };
      }),
    };

    criterionRepo = {
      ...criterionHelpers,
      count: jest.fn(
        async ({ where }: any) =>
          criteria.filter((entry) => entry.evaluationId === where.evaluationId)
            .length,
      ),
      find: jest.fn(async ({ where }: any) =>
        criteria
          .filter((entry) => entry.evaluationId === where.evaluationId)
          .sort((left, right) => left.ordre - right.ordre),
      ),
      findOne: jest.fn(
        async ({ where }: any) =>
          criteria.find(
            (entry) =>
              (!where.id || entry.id === where.id) &&
              (!where.code || entry.code === where.code) &&
              (!where.evaluationId ||
                entry.evaluationId === where.evaluationId),
          ) ?? null,
      ),
    };

    submissionRepo = {
      ...submissionHelpers,
      count: jest.fn(
        async ({ where }: any) =>
          submissions.filter(
            (entry) => entry.evaluationId === where.evaluationId,
          ).length,
      ),
      find: jest.fn(async ({ where }: any) => {
        const filtered = submissions.filter(
          (entry) => entry.evaluationId === where.evaluationId,
        );

        if (where.id) {
          return filtered.filter((entry) => entry.id === where.id);
        }

        return filtered.map((entry) => ({
          ...entry,
          resultat:
            results.find(
              (result) => result.evaluationSubmissionId === entry.id,
            ) ?? null,
        }));
      }),
      findOne: jest.fn(
        async ({ where }: any) =>
          submissions.find(
            (entry) =>
              (!where.id || entry.id === where.id) &&
              (!where.externalSubmissionId ||
                entry.externalSubmissionId === where.externalSubmissionId) &&
              (!where.evaluationId ||
                entry.evaluationId === where.evaluationId),
          ) ?? null,
      ),
    };

    noteRepo = {
      ...noteHelpers,
      find: jest.fn(async ({ where }: any) =>
        notes.filter((entry) => entry.evaluationId === where.evaluationId),
      ),
      findOne: jest.fn(
        async ({ where }: any) =>
          notes.find(
            (entry) =>
              (!where.evaluationId ||
                entry.evaluationId === where.evaluationId) &&
              (!where.evaluationSubmissionId ||
                entry.evaluationSubmissionId ===
                  where.evaluationSubmissionId) &&
              (!where.criterionId || entry.criterionId === where.criterionId) &&
              (!where.evaluatorId || entry.evaluatorId === where.evaluatorId) &&
              (!where.source || entry.source === where.source),
          ) ?? null,
      ),
    };

    resultRepo = {
      ...resultHelpers,
      count: jest.fn(
        async ({ where }: any) =>
          results.filter((entry) => entry.evaluationId === where.evaluationId)
            .length,
      ),
      find: jest.fn(async ({ where }: any) =>
        results.filter((entry) => entry.evaluationId === where.evaluationId),
      ),
    };

    reportRepo = {
      ...reportHelpers,
      count: jest.fn(
        async ({ where }: any) =>
          reports.filter((entry) => entry.evaluationId === where.evaluationId)
            .length,
      ),
      find: jest.fn(async ({ where }: any) =>
        reports
          .filter((entry) => entry.evaluationId === where.evaluationId)
          .sort((left, right) => right.version - left.version),
      ),
    };

    rabbitClient = {
      emit: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationService,
        { provide: getRepositoryToken(Evaluation), useValue: evaluationRepo },
        {
          provide: getRepositoryToken(EvaluationCriterion),
          useValue: criterionRepo,
        },
        {
          provide: getRepositoryToken(EvaluationSubmission),
          useValue: submissionRepo,
        },
        { provide: getRepositoryToken(EvaluationNote), useValue: noteRepo },
        { provide: getRepositoryToken(EvaluationResult), useValue: resultRepo },
        { provide: getRepositoryToken(EvaluationReport), useValue: reportRepo },
        { provide: RABBITMQ_CLIENT, useValue: rabbitClient },
        {
          provide: MinioService,
          useValue: {
            uploadFile: jest.fn().mockResolvedValue('http://minio/report.pdf'),
            getPresignedUrl: jest
              .fn()
              .mockResolvedValue('http://minio/presigned.pdf'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) => {
              const config: Record<string, string> = {
                MINIO_EVALUATION_REPORTS_BUCKET: 'evaluation-reports',
              };
              return config[key] ?? fallback;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(EvaluationService);
  });

  it('creates a technical evaluation with the expected defaults', async () => {
    const created = await service.create(
      {
        appelOffreId: 'ao-1',
        commissionId: 'cope-1',
        type: EvaluationType.TECHNIQUE,
        objet: 'Evaluation technique',
      },
      'user-1',
    );

    expect(created.type).toBe(EvaluationType.TECHNIQUE);
    expect(created.scoringMode).toBe(EvaluationScoringMode.GRILLE_CRITERES);
    expect(created.technicalWeight).toBe(100);
    expect(created.financialWeight).toBe(0);
    expect(created.modeAveugle).toBe(true);
    expect(created.createdBy).toBe('user-1');
    expect(rabbitClient.emit).toHaveBeenCalled();
  });

  it('blocks a financial evaluation from starting when the parent technical evaluation is not validated', async () => {
    const parentId = nextId();
    const financialId = nextId();

    evaluations.push(
      {
        id: parentId,
        reference: 'EV-2026-0001',
        appelOffreId: 'ao-1',
        commissionId: 'cope-1',
        parentEvaluationId: null,
        type: EvaluationType.TECHNIQUE,
        scoringMode: EvaluationScoringMode.GRILLE_CRITERES,
        objet: 'Technique',
        description: null,
        modeAveugle: true,
        minimumOverallScore: 60,
        recommendationThreshold: 70,
        technicalWeight: 100,
        financialWeight: 0,
        statut: EvaluationStatus.TERMINEE,
        createdBy: 'seed',
        validatedBy: null,
        startedAt: null,
        completedAt: null,
        validatedAt: null,
        lastCalculatedAt: new Date(),
        integrationMetadata: null,
        criteres: [],
        soumissions: [],
        notes: [],
        resultats: [],
        rapports: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: financialId,
        reference: 'EV-2026-0002',
        appelOffreId: 'ao-1',
        commissionId: 'cope-1',
        parentEvaluationId: parentId,
        type: EvaluationType.FINANCIERE,
        scoringMode: EvaluationScoringMode.FORMULE_MOINS_DISANTE,
        objet: 'Financière',
        description: null,
        modeAveugle: false,
        minimumOverallScore: 0,
        recommendationThreshold: 70,
        technicalWeight: 70,
        financialWeight: 30,
        statut: EvaluationStatus.PRETE,
        createdBy: 'seed',
        validatedBy: null,
        startedAt: null,
        completedAt: null,
        validatedAt: null,
        lastCalculatedAt: null,
        integrationMetadata: null,
        criteres: [],
        soumissions: [],
        notes: [],
        resultats: [],
        rapports: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Evaluation,
    );

    submissions.push({
      id: nextId(),
      evaluationId: financialId,
      evaluation: null as any,
      externalSubmissionId: 'submission-1',
      operateurEconomiqueId: 'oe-1',
      operateurNom: 'SARL Test',
      aliasAnonyme: 'SOUM-001',
      lotId: null,
      montantOffre: 1000,
      devise: 'DZD',
      statut: EvaluationSubmissionStatus.EN_ATTENTE,
      motifElimination: null,
      scoreTechnique: null,
      scoreFinancier: null,
      scoreGlobal: null,
      scoreMoyen: null,
      rang: null,
      recommandation: null,
      metadata: null,
      notes: [],
      resultat: null as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.changeStatus(
        financialId,
        { statut: EvaluationStatus.EN_COURS },
        'user-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('masks operator identity while a blind evaluation is still in progress', async () => {
    const evaluationId = nextId();
    const submissionId = nextId();

    evaluations.push({
      id: evaluationId,
      reference: 'EV-2026-0003',
      appelOffreId: 'ao-2',
      commissionId: 'cope-2',
      parentEvaluationId: null,
      type: EvaluationType.TECHNIQUE,
      scoringMode: EvaluationScoringMode.GRILLE_CRITERES,
      objet: 'Blind test',
      description: null,
      modeAveugle: true,
      minimumOverallScore: 50,
      recommendationThreshold: 70,
      technicalWeight: 100,
      financialWeight: 0,
      statut: EvaluationStatus.EN_COURS,
      createdBy: 'seed',
      validatedBy: null,
      startedAt: new Date(),
      completedAt: null,
      validatedAt: null,
      lastCalculatedAt: null,
      integrationMetadata: null,
      criteres: [],
      soumissions: [],
      notes: [],
      resultats: [],
      rapports: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Evaluation);

    submissions.push({
      id: submissionId,
      evaluationId,
      evaluation: null as any,
      externalSubmissionId: 'submission-2',
      operateurEconomiqueId: 'oe-2',
      operateurNom: 'EURL Masquee',
      aliasAnonyme: 'SOUM-001',
      lotId: null,
      montantOffre: 1200,
      devise: 'DZD',
      statut: EvaluationSubmissionStatus.EN_ATTENTE,
      motifElimination: null,
      scoreTechnique: null,
      scoreFinancier: null,
      scoreGlobal: null,
      scoreMoyen: null,
      rang: null,
      recommandation: null,
      metadata: { source: 'test' },
      notes: [],
      resultat: null as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const detail = await service.findOne(evaluationId);

    expect(detail.soumissions[0].aliasAnonyme).toBe('SOUM-001');
    expect(detail.soumissions[0].operateurNom).toBeUndefined();
    expect(detail.soumissions[0].operateurEconomiqueId).toBeUndefined();
  });

  it('does not reveal operator identity early even when revealIdentity is requested on a blind evaluation', async () => {
    const evaluationId = nextId();
    const submissionId = nextId();

    evaluations.push({
      id: evaluationId,
      reference: 'EV-2026-0004',
      appelOffreId: 'ao-3',
      commissionId: 'cope-3',
      parentEvaluationId: null,
      type: EvaluationType.TECHNIQUE,
      scoringMode: EvaluationScoringMode.GRILLE_CRITERES,
      objet: 'Blind strict test',
      description: null,
      modeAveugle: true,
      minimumOverallScore: 50,
      recommendationThreshold: 70,
      technicalWeight: 100,
      financialWeight: 0,
      statut: EvaluationStatus.EN_COURS,
      createdBy: 'seed',
      validatedBy: null,
      startedAt: new Date(),
      completedAt: null,
      validatedAt: null,
      lastCalculatedAt: null,
      integrationMetadata: null,
      criteres: [],
      soumissions: [],
      notes: [],
      resultats: [],
      rapports: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Evaluation);

    submissions.push({
      id: submissionId,
      evaluationId,
      evaluation: null as any,
      externalSubmissionId: 'submission-3',
      operateurEconomiqueId: 'oe-3',
      operateurNom: 'EURL Toujours Masquee',
      aliasAnonyme: 'SOUM-009',
      lotId: null,
      montantOffre: 1400,
      devise: 'DZD',
      statut: EvaluationSubmissionStatus.EN_ATTENTE,
      motifElimination: null,
      scoreTechnique: null,
      scoreFinancier: null,
      scoreGlobal: null,
      scoreMoyen: null,
      rang: null,
      recommandation: null,
      metadata: { source: 'strict-test' },
      notes: [],
      resultat: null as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const detail = await service.findOne(evaluationId, true);

    expect(detail.soumissions[0].aliasAnonyme).toBe('SOUM-009');
    expect(detail.soumissions[0].operateurNom).toBeUndefined();
    expect(detail.soumissions[0].operateurEconomiqueId).toBeUndefined();
    expect(detail.soumissions[0].montantOffre).toBeNull();
  });

  it('calculates scores, ranking and elimination deterministically for a technical evaluation', async () => {
    const evaluationId = nextId();
    const criterion1Id = nextId();
    const criterion2Id = nextId();
    const submission1Id = nextId();
    const submission2Id = nextId();

    evaluations.push({
      id: evaluationId,
      reference: 'EV-2026-0010',
      appelOffreId: 'ao-10',
      commissionId: 'cope-10',
      parentEvaluationId: null,
      type: EvaluationType.TECHNIQUE,
      scoringMode: EvaluationScoringMode.GRILLE_CRITERES,
      objet: 'Classement technique',
      description: null,
      modeAveugle: true,
      minimumOverallScore: 60,
      recommendationThreshold: 75,
      technicalWeight: 100,
      financialWeight: 0,
      statut: EvaluationStatus.EN_COURS,
      createdBy: 'seed',
      validatedBy: null,
      startedAt: new Date(),
      completedAt: null,
      validatedAt: null,
      lastCalculatedAt: null,
      integrationMetadata: null,
      criteres: [],
      soumissions: [],
      notes: [],
      resultats: [],
      rapports: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Evaluation);

    criteria.push(
      {
        id: criterion1Id,
        evaluationId,
        code: 'TECH-01',
        libelle: 'Méthodologie',
        description: null,
        poids: 60,
        noteMax: 100,
        noteMinimale: 50,
        eliminatoire: true,
        ordre: 1,
        evaluation: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: criterion2Id,
        evaluationId,
        code: 'TECH-02',
        libelle: 'Planning',
        description: null,
        poids: 40,
        noteMax: 100,
        noteMinimale: null,
        eliminatoire: false,
        ordre: 2,
        evaluation: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    submissions.push(
      {
        id: submission1Id,
        evaluationId,
        evaluation: null as any,
        externalSubmissionId: 'submission-10-1',
        operateurEconomiqueId: 'oe-a',
        operateurNom: 'Atlas',
        aliasAnonyme: 'SOUM-001',
        lotId: null,
        montantOffre: 1000,
        devise: 'DZD',
        statut: EvaluationSubmissionStatus.EN_ATTENTE,
        motifElimination: null,
        scoreTechnique: null,
        scoreFinancier: null,
        scoreGlobal: null,
        scoreMoyen: null,
        rang: null,
        recommandation: null,
        metadata: null,
        notes: [],
        resultat: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: submission2Id,
        evaluationId,
        evaluation: null as any,
        externalSubmissionId: 'submission-10-2',
        operateurEconomiqueId: 'oe-b',
        operateurNom: 'Numidia',
        aliasAnonyme: 'SOUM-002',
        lotId: null,
        montantOffre: 1100,
        devise: 'DZD',
        statut: EvaluationSubmissionStatus.EN_ATTENTE,
        motifElimination: null,
        scoreTechnique: null,
        scoreFinancier: null,
        scoreGlobal: null,
        scoreMoyen: null,
        rang: null,
        recommandation: null,
        metadata: null,
        notes: [],
        resultat: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    notes.push(
      {
        id: nextId(),
        evaluationId,
        evaluationSubmissionId: submission1Id,
        criterionId: criterion1Id,
        evaluatorId: 'eval-1',
        evaluatorName: 'E1',
        source: 'HUMAIN' as any,
        note: 80,
        justification: 'Bonne méthodologie',
        scoreConfiance: null,
        evaluation: null as any,
        evaluationSubmission: null as any,
        criterion: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: nextId(),
        evaluationId,
        evaluationSubmissionId: submission1Id,
        criterionId: criterion2Id,
        evaluatorId: 'eval-1',
        evaluatorName: 'E1',
        source: 'HUMAIN' as any,
        note: 90,
        justification: 'Planning solide',
        scoreConfiance: null,
        evaluation: null as any,
        evaluationSubmission: null as any,
        criterion: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: nextId(),
        evaluationId,
        evaluationSubmissionId: submission2Id,
        criterionId: criterion1Id,
        evaluatorId: 'eval-1',
        evaluatorName: 'E1',
        source: 'HUMAIN' as any,
        note: 45,
        justification: 'Sous le seuil',
        scoreConfiance: null,
        evaluation: null as any,
        evaluationSubmission: null as any,
        criterion: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: nextId(),
        evaluationId,
        evaluationSubmissionId: submission2Id,
        criterionId: criterion2Id,
        evaluatorId: 'eval-1',
        evaluatorName: 'E1',
        source: 'HUMAIN' as any,
        note: 95,
        justification: 'Très bon planning',
        scoreConfiance: null,
        evaluation: null as any,
        evaluationSubmission: null as any,
        criterion: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    const ranking = await service.recalculateScores(evaluationId);

    expect(ranking).toHaveLength(2);
    expect(ranking[0].aliasAnonyme).toBe('SOUM-001');
    expect(ranking[0].resultat!.scoreGlobal).toBe(84);
    expect(ranking[0].resultat!.rang).toBe(1);
    expect(ranking[0].resultat!.recommandation).toBe(
      EvaluationRecommendation.RETENIR,
    );
    expect(ranking[1].resultat!.eliminee).toBe(true);
    expect(ranking[1].resultat!.motifElimination).toContain(
      'Critère éliminatoire',
    );
    expect(
      submissions.find((entry) => entry.id === submission1Id)?.statut,
    ).toBe(EvaluationSubmissionStatus.QUALIFIEE);
    expect(
      submissions.find((entry) => entry.id === submission2Id)?.statut,
    ).toBe(EvaluationSubmissionStatus.ELIMINEE);
  });

  it('generates and stores a final report for a completed evaluation', async () => {
    const evaluationId = nextId();
    const criterionId = nextId();
    const submissionId = nextId();

    evaluations.push({
      id: evaluationId,
      reference: 'EV-2026-0099',
      appelOffreId: 'ao-99',
      commissionId: 'cope-99',
      parentEvaluationId: null,
      type: EvaluationType.TECHNIQUE,
      scoringMode: EvaluationScoringMode.GRILLE_CRITERES,
      objet: 'Rapport final',
      description: null,
      modeAveugle: false,
      minimumOverallScore: 0,
      recommendationThreshold: 70,
      technicalWeight: 100,
      financialWeight: 0,
      statut: EvaluationStatus.TERMINEE,
      createdBy: 'seed',
      validatedBy: null,
      startedAt: new Date(),
      completedAt: new Date(),
      validatedAt: null,
      lastCalculatedAt: new Date(),
      integrationMetadata: null,
      criteres: [],
      soumissions: [],
      notes: [],
      resultats: [],
      rapports: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Evaluation);

    criteria.push({
      id: criterionId,
      evaluationId,
      code: 'TECH-R-01',
      libelle: 'Critère rapport',
      description: null,
      poids: 100,
      noteMax: 100,
      noteMinimale: null,
      eliminatoire: false,
      ordre: 1,
      evaluation: null as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    submissions.push({
      id: submissionId,
      evaluationId,
      evaluation: null as any,
      externalSubmissionId: 'submission-report-1',
      operateurEconomiqueId: 'oe-report-1',
      operateurNom: 'Rapport SA',
      aliasAnonyme: 'SOUM-001',
      lotId: null,
      montantOffre: 900,
      devise: 'DZD',
      statut: EvaluationSubmissionStatus.QUALIFIEE,
      motifElimination: null,
      scoreTechnique: 92,
      scoreFinancier: null,
      scoreGlobal: 92,
      scoreMoyen: 92,
      rang: 1,
      recommandation: EvaluationRecommendation.RETENIR,
      metadata: null,
      notes: [],
      resultat: null as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    results.push({
      id: nextId(),
      evaluationId,
      evaluationSubmissionId: submissionId,
      evaluation: null as any,
      evaluationSubmission: null as any,
      scoreTechnique: 92,
      scoreFinancier: null,
      scoreGlobal: 92,
      scoreMoyen: 92,
      rang: 1,
      recommandation: EvaluationRecommendation.RETENIR,
      eliminee: false,
      motifElimination: null,
      detailCalcul: {
        evaluationType: EvaluationType.TECHNIQUE,
        scoringMode: EvaluationScoringMode.GRILLE_CRITERES,
        rang: 1,
      },
      calculatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as EvaluationResult);

    const report = await service.generateReport(evaluationId, 'validator-1');

    expect(report.version).toBe(1);
    expect(report.fileName).toContain('rapport-v1.pdf');
    expect(report.generatedBy).toBe('validator-1');
    expect(report.downloadUrl).toBe('http://minio/presigned.pdf');
    expect(reports).toHaveLength(1);
  });
});
