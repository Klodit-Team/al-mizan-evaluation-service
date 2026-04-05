import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import * as PDFDocument from 'pdfkit';
import { Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/pagination-response.dto';
import { EVALUATION_EVENTS } from '../common/messaging/events';
import { RABBITMQ_CLIENT } from '../common/messaging/rabbitmq.module';
import { MinioService } from '../common/services/minio.service';
import { ChangeEvaluationStatusDto } from './dto/change-evaluation-status.dto';
import { CreateCriterionDto } from './dto/create-criterion.dto';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { FindEvaluationsQueryDto } from './dto/find-evaluations-query.dto';
import { RegisterSubmissionDto } from './dto/register-submission.dto';
import { UpdateCriterionDto } from './dto/update-criterion.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { UpsertNoteDto } from './dto/upsert-note.dto';
import { EvaluationCriterion } from './entities/evaluation-criterion.entity';
import { EvaluationNote } from './entities/evaluation-note.entity';
import { EvaluationReport } from './entities/evaluation-report.entity';
import { EvaluationResult } from './entities/evaluation-result.entity';
import { EvaluationSubmission } from './entities/evaluation-submission.entity';
import { Evaluation } from './entities/evaluation.entity';
import { EvaluationNoteSource } from './enums/evaluation-note-source.enum';
import { EvaluationRecommendation } from './enums/evaluation-recommendation.enum';
import { EvaluationScoringMode } from './enums/evaluation-scoring-mode.enum';
import { EvaluationStatus } from './enums/evaluation-status.enum';
import { EvaluationSubmissionStatus } from './enums/evaluation-submission-status.enum';
import { EvaluationType } from './enums/evaluation-type.enum';

type SubmissionScore = {
  submissionId: string;
  externalSubmissionId: string;
  technicalScore: number | null;
  financialScore: number | null;
  globalScore: number;
  averageScore: number | null;
  eliminated: boolean;
  eliminationReason: string | null;
  recommendation: EvaluationRecommendation;
  detailCalcul: Record<string, unknown>;
};

type EvaluationDefaultsSource = {
  id?: string;
  appelOffreId?: string;
  commissionId?: string;
  parentEvaluationId?: string | null;
  type?: EvaluationType;
  scoringMode?: EvaluationScoringMode | null;
  objet?: string;
  description?: string | null;
  modeAveugle?: boolean | null;
  minimumOverallScore?: number | null;
  recommendationThreshold?: number | null;
  technicalWeight?: number | null;
  financialWeight?: number | null;
  integrationMetadata?: Record<string, unknown> | null;
};

type NormalizedEvaluationInput = {
  id?: string;
  appelOffreId: string;
  commissionId: string;
  parentEvaluationId: string | null;
  type: EvaluationType;
  scoringMode: EvaluationScoringMode;
  objet: string;
  description: string | null;
  modeAveugle: boolean;
  minimumOverallScore: number;
  recommendationThreshold: number;
  technicalWeight: number;
  financialWeight: number;
  integrationMetadata: Record<string, unknown> | null;
};

@Injectable()
export class EvaluationService {
  private readonly reportsBucket: string;

  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationRepo: Repository<Evaluation>,
    @InjectRepository(EvaluationCriterion)
    private readonly criterionRepo: Repository<EvaluationCriterion>,
    @InjectRepository(EvaluationSubmission)
    private readonly submissionRepo: Repository<EvaluationSubmission>,
    @InjectRepository(EvaluationNote)
    private readonly noteRepo: Repository<EvaluationNote>,
    @InjectRepository(EvaluationResult)
    private readonly resultRepo: Repository<EvaluationResult>,
    @InjectRepository(EvaluationReport)
    private readonly reportRepo: Repository<EvaluationReport>,
    @Inject(RABBITMQ_CLIENT)
    private readonly rmqClient: ClientProxy,
    private readonly minioService: MinioService,
    private readonly configService: ConfigService,
  ) {
    this.reportsBucket = this.configService.get<string>(
      'MINIO_EVALUATION_REPORTS_BUCKET',
      'evaluation-reports',
    );
  }

  private emit(event: string, payload: Record<string, unknown>): void {
    this.rmqClient.emit(event, payload).subscribe({
      error: (error) => console.error(`RabbitMQ emit error [${event}]:`, error),
    });
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private buildEvaluationDefaults(
    data: EvaluationDefaultsSource,
  ): NormalizedEvaluationInput {
    const type = data.type ?? EvaluationType.TECHNIQUE;
    const scoringMode =
      data.scoringMode ??
      (type === EvaluationType.FINANCIERE
        ? EvaluationScoringMode.FORMULE_MOINS_DISANTE
        : EvaluationScoringMode.GRILLE_CRITERES);

    const modeAveugle =
      data.modeAveugle ??
      (type === EvaluationType.TECHNIQUE ||
        type === EvaluationType.ELIGIBILITE);

    const technicalWeight =
      data.technicalWeight ??
      (type === EvaluationType.FINANCIERE && data.parentEvaluationId
        ? 70
        : type === EvaluationType.FINANCIERE
          ? 0
          : 100);

    const financialWeight =
      data.financialWeight ??
      (type === EvaluationType.FINANCIERE
        ? data.parentEvaluationId
          ? 30
          : 100
        : 0);

    return {
      id: data.id,
      appelOffreId: data.appelOffreId as string,
      commissionId: data.commissionId as string,
      parentEvaluationId: data.parentEvaluationId ?? null,
      type,
      scoringMode,
      objet: data.objet as string,
      description: data.description ?? null,
      modeAveugle,
      technicalWeight,
      financialWeight,
      minimumOverallScore: data.minimumOverallScore ?? 0,
      recommendationThreshold: data.recommendationThreshold ?? 70,
      integrationMetadata:
        (data.integrationMetadata as Record<string, unknown> | null) ?? null,
    };
  }

  private async validateEvaluationShape(
    evaluation: Pick<
      NormalizedEvaluationInput,
      | 'id'
      | 'appelOffreId'
      | 'parentEvaluationId'
      | 'type'
      | 'scoringMode'
      | 'technicalWeight'
      | 'financialWeight'
    >,
  ): Promise<void> {
    if (
      evaluation.type !== EvaluationType.FINANCIERE &&
      evaluation.scoringMode !== EvaluationScoringMode.GRILLE_CRITERES
    ) {
      throw new BadRequestException(
        "Les évaluations d'éligibilité et techniques doivent utiliser une grille de critères.",
      );
    }

    if (
      evaluation.type === EvaluationType.FINANCIERE &&
      evaluation.parentEvaluationId &&
      this.round(evaluation.technicalWeight + evaluation.financialWeight) !==
        100
    ) {
      throw new BadRequestException(
        'Les pondérations technique et financière doivent totaliser 100 pour une évaluation financière dépendante.',
      );
    }

    if (
      evaluation.type !== EvaluationType.FINANCIERE &&
      (evaluation.technicalWeight !== 100 || evaluation.financialWeight !== 0)
    ) {
      throw new BadRequestException(
        'Les évaluations non financières utilisent uniquement un score technique global à 100%.',
      );
    }

    if (
      evaluation.type !== EvaluationType.FINANCIERE &&
      evaluation.parentEvaluationId
    ) {
      throw new BadRequestException(
        'Seule une évaluation financière peut référencer une évaluation parente.',
      );
    }

    if (evaluation.parentEvaluationId) {
      const parent = await this.evaluationRepo.findOne({
        where: { id: evaluation.parentEvaluationId },
      });

      if (!parent) {
        throw new NotFoundException(
          `Évaluation parente "${evaluation.parentEvaluationId}" introuvable.`,
        );
      }

      if (evaluation.id && parent.id === evaluation.id) {
        throw new BadRequestException(
          "Une évaluation ne peut pas dépendre d'elle-même.",
        );
      }

      if (parent.appelOffreId !== evaluation.appelOffreId) {
        throw new BadRequestException(
          "L'évaluation parente doit appartenir au même appel d'offres.",
        );
      }

      if (
        evaluation.type === EvaluationType.FINANCIERE &&
        parent.type !== EvaluationType.TECHNIQUE
      ) {
        throw new BadRequestException(
          "Une évaluation financière doit dépendre d'une évaluation technique validée.",
        );
      }
    }
  }

  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.evaluationRepo.count();
    return `EV-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private isEditableStatus(status: EvaluationStatus): boolean {
    return (
      status === EvaluationStatus.BROUILLON || status === EvaluationStatus.PRETE
    );
  }

  private ensureEditable(evaluation: Evaluation): void {
    if (!this.isEditableStatus(evaluation.statut)) {
      throw new ConflictException(
        "Cette évaluation n'est plus modifiable dans son état actuel.",
      );
    }
  }

  private async getEvaluationEntity(id: string): Promise<Evaluation> {
    const evaluation = await this.evaluationRepo.findOne({
      where: { id },
      relations: {
        criteres: true,
        soumissions: true,
        rapports: true,
      },
    });

    if (!evaluation) {
      throw new NotFoundException(`Évaluation "${id}" introuvable.`);
    }

    evaluation.criteres = [...(evaluation.criteres ?? [])].sort(
      (a, b) => a.ordre - b.ordre,
    );
    evaluation.soumissions = [...(evaluation.soumissions ?? [])].sort(
      (a, b) =>
        (a.rang ?? Number.MAX_SAFE_INTEGER) -
          (b.rang ?? Number.MAX_SAFE_INTEGER) ||
        a.aliasAnonyme.localeCompare(b.aliasAnonyme),
    );
    evaluation.rapports = [...(evaluation.rapports ?? [])].sort(
      (a, b) => b.version - a.version,
    );

    return evaluation;
  }

  private shouldRevealIdentity(
    evaluation: Evaluation,
    revealIdentity = false,
  ): boolean {
    if (!evaluation.modeAveugle) {
      return true;
    }

    const blindEvaluationCompleted = [
      EvaluationStatus.VALIDEE,
      EvaluationStatus.ARCHIVEE,
    ].includes(evaluation.statut);

    if (revealIdentity && blindEvaluationCompleted) {
      return true;
    }

    return blindEvaluationCompleted;
  }

  private shouldRevealFinancials(
    evaluation: Evaluation,
    revealIdentity = false,
  ): boolean {
    return (
      evaluation.type === EvaluationType.FINANCIERE ||
      this.shouldRevealIdentity(evaluation, revealIdentity)
    );
  }

  private serializeSubmission(
    submission: EvaluationSubmission,
    evaluation: Evaluation,
    revealIdentity = false,
  ) {
    const revealSensitiveIdentity = this.shouldRevealIdentity(
      evaluation,
      revealIdentity,
    );
    const revealFinancials = this.shouldRevealFinancials(
      evaluation,
      revealIdentity,
    );

    return {
      id: submission.id,
      externalSubmissionId: submission.externalSubmissionId,
      aliasAnonyme: submission.aliasAnonyme,
      lotId: submission.lotId,
      statut: submission.statut,
      devise: submission.devise,
      montantOffre: revealFinancials ? submission.montantOffre : null,
      scoreTechnique: submission.scoreTechnique,
      scoreFinancier: submission.scoreFinancier,
      scoreGlobal: submission.scoreGlobal,
      scoreMoyen: submission.scoreMoyen,
      rang: submission.rang,
      recommandation: submission.recommandation,
      motifElimination: submission.motifElimination,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
      ...(revealSensitiveIdentity
        ? {
            operateurEconomiqueId: submission.operateurEconomiqueId,
            operateurNom: submission.operateurNom,
            metadata: submission.metadata,
          }
        : {}),
    };
  }

  private serializeEvaluation(evaluation: Evaluation, revealIdentity = false) {
    const latestReport = evaluation.rapports?.[0];

    return {
      id: evaluation.id,
      reference: evaluation.reference,
      appelOffreId: evaluation.appelOffreId,
      commissionId: evaluation.commissionId,
      parentEvaluationId: evaluation.parentEvaluationId,
      type: evaluation.type,
      scoringMode: evaluation.scoringMode,
      objet: evaluation.objet,
      description: evaluation.description,
      modeAveugle: evaluation.modeAveugle,
      minimumOverallScore: evaluation.minimumOverallScore,
      recommendationThreshold: evaluation.recommendationThreshold,
      technicalWeight: evaluation.technicalWeight,
      financialWeight: evaluation.financialWeight,
      statut: evaluation.statut,
      createdBy: evaluation.createdBy,
      validatedBy: evaluation.validatedBy,
      startedAt: evaluation.startedAt,
      completedAt: evaluation.completedAt,
      validatedAt: evaluation.validatedAt,
      lastCalculatedAt: evaluation.lastCalculatedAt,
      integrationMetadata: evaluation.integrationMetadata,
      criteres: evaluation.criteres.map((criterion) => ({
        id: criterion.id,
        code: criterion.code,
        libelle: criterion.libelle,
        description: criterion.description,
        poids: criterion.poids,
        noteMax: criterion.noteMax,
        noteMinimale: criterion.noteMinimale,
        eliminatoire: criterion.eliminatoire,
        ordre: criterion.ordre,
      })),
      soumissions: evaluation.soumissions.map((submission) =>
        this.serializeSubmission(submission, evaluation, revealIdentity),
      ),
      latestReport: latestReport
        ? {
            id: latestReport.id,
            version: latestReport.version,
            fileName: latestReport.fileName,
            generatedBy: latestReport.generatedBy,
            generatedAt: latestReport.generatedAt,
            checksum: latestReport.checksum,
            size: latestReport.size,
          }
        : null,
      reportCount: evaluation.rapports.length,
      createdAt: evaluation.createdAt,
      updatedAt: evaluation.updatedAt,
    };
  }

  private async validateReadiness(evaluation: Evaluation): Promise<void> {
    const criteria = await this.criterionRepo.find({
      where: { evaluationId: evaluation.id },
    });
    const submissionCount = await this.submissionRepo.count({
      where: { evaluationId: evaluation.id },
    });

    if (submissionCount === 0) {
      throw new BadRequestException(
        'Au moins une soumission doit être enregistrée avant de préparer une évaluation.',
      );
    }

    if (evaluation.scoringMode === EvaluationScoringMode.GRILLE_CRITERES) {
      if (criteria.length === 0) {
        throw new BadRequestException(
          "Une grille de critères est obligatoire pour ce type d'évaluation.",
        );
      }

      const totalWeight = this.round(
        criteria.reduce((sum, criterion) => sum + criterion.poids, 0),
      );
      if (totalWeight !== 100) {
        throw new BadRequestException(
          `La somme des poids des critères doit être égale à 100. Valeur actuelle: ${totalWeight}.`,
        );
      }
    }
  }

  private async getParentResults(
    evaluation: Evaluation,
    requireValidatedParent = false,
  ): Promise<Map<string, EvaluationResult>> {
    if (!evaluation.parentEvaluationId) {
      return new Map();
    }

    const parent = await this.evaluationRepo.findOne({
      where: { id: evaluation.parentEvaluationId },
    });

    if (!parent) {
      throw new NotFoundException(
        `Évaluation parente "${evaluation.parentEvaluationId}" introuvable.`,
      );
    }

    if (
      requireValidatedParent &&
      ![EvaluationStatus.VALIDEE, EvaluationStatus.ARCHIVEE].includes(
        parent.statut,
      )
    ) {
      throw new ConflictException(
        "L'évaluation financière ne peut démarrer qu'après validation de l'évaluation technique parente.",
      );
    }

    const parentSubmissions = await this.submissionRepo.find({
      where: { evaluationId: parent.id },
      relations: { resultat: true },
    });

    return new Map(
      parentSubmissions
        .filter((submission) => submission.resultat)
        .map((submission) => [
          submission.externalSubmissionId,
          submission.resultat,
        ]),
    );
  }

  private async assertTransitionAllowed(
    evaluation: Evaluation,
    nextStatus: EvaluationStatus,
  ): Promise<void> {
    const allowedTransitions: Record<EvaluationStatus, EvaluationStatus[]> = {
      [EvaluationStatus.BROUILLON]: [
        EvaluationStatus.PRETE,
        EvaluationStatus.ANNULEE,
      ],
      [EvaluationStatus.PRETE]: [
        EvaluationStatus.BROUILLON,
        EvaluationStatus.EN_COURS,
        EvaluationStatus.ANNULEE,
      ],
      [EvaluationStatus.EN_COURS]: [
        EvaluationStatus.PRETE,
        EvaluationStatus.TERMINEE,
        EvaluationStatus.ANNULEE,
      ],
      [EvaluationStatus.TERMINEE]: [
        EvaluationStatus.EN_COURS,
        EvaluationStatus.VALIDEE,
      ],
      [EvaluationStatus.VALIDEE]: [EvaluationStatus.ARCHIVEE],
      [EvaluationStatus.ARCHIVEE]: [],
      [EvaluationStatus.ANNULEE]: [],
    };

    if (!allowedTransitions[evaluation.statut].includes(nextStatus)) {
      throw new ConflictException(
        `Transition de statut invalide: ${evaluation.statut} -> ${nextStatus}.`,
      );
    }

    if (nextStatus === EvaluationStatus.PRETE) {
      await this.validateReadiness(evaluation);
    }

    if (nextStatus === EvaluationStatus.EN_COURS) {
      await this.validateReadiness(evaluation);
      if (evaluation.type === EvaluationType.FINANCIERE) {
        await this.getParentResults(evaluation, true);
      }
    }

    if (nextStatus === EvaluationStatus.TERMINEE) {
      const resultCount = await this.resultRepo.count({
        where: { evaluationId: evaluation.id },
      });
      const submissionCount = await this.submissionRepo.count({
        where: { evaluationId: evaluation.id },
      });
      if (!evaluation.lastCalculatedAt || resultCount < submissionCount) {
        throw new ConflictException(
          "Le calcul des scores doit être exécuté avant de terminer l'évaluation.",
        );
      }
    }

    if (nextStatus === EvaluationStatus.VALIDEE) {
      const reportCount = await this.reportRepo.count({
        where: { evaluationId: evaluation.id },
      });
      if (reportCount === 0) {
        throw new ConflictException(
          "Le rapport final doit être généré avant de valider l'évaluation.",
        );
      }
    }
  }

  async findAll(query: FindEvaluationsQueryDto) {
    const {
      page = 1,
      limit = 10,
      statut,
      dateFrom,
      dateTo,
      search,
      type,
      appelOffreId,
      commissionId,
    } = query;
    const skip = (page - 1) * limit;

    const builder = this.evaluationRepo.createQueryBuilder('evaluation');

    if (statut) {
      builder.andWhere('evaluation.statut = :statut', { statut });
    }

    if (type) {
      builder.andWhere('evaluation.type = :type', { type });
    }

    if (appelOffreId) {
      builder.andWhere('evaluation.appelOffreId = :appelOffreId', {
        appelOffreId,
      });
    }

    if (commissionId) {
      builder.andWhere('evaluation.commissionId = :commissionId', {
        commissionId,
      });
    }

    if (dateFrom) {
      builder.andWhere('evaluation.createdAt >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      builder.andWhere('evaluation.createdAt <= :dateTo', {
        dateTo: `${dateTo} 23:59:59`,
      });
    }

    if (search) {
      builder.andWhere(
        '(evaluation.reference LIKE :search OR evaluation.objet LIKE :search OR evaluation.appelOffreId LIKE :search)',
        { search: `%${search}%` },
      );
    }

    builder.orderBy('evaluation.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await builder.getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: string, revealIdentity = false) {
    const evaluation = await this.getEvaluationEntity(id);
    return this.serializeEvaluation(evaluation, revealIdentity);
  }

  async create(dto: CreateEvaluationDto, userId?: string) {
    const payload = this.buildEvaluationDefaults(dto);
    await this.validateEvaluationShape(payload);

    const evaluation = this.evaluationRepo.create({
      ...payload,
      reference: await this.generateReference(),
      createdBy: userId ?? null,
    });

    const saved = await this.evaluationRepo.save(evaluation);
    this.emit(EVALUATION_EVENTS.CREATED, {
      evaluationId: saved.id,
      reference: saved.reference,
      appelOffreId: saved.appelOffreId,
      type: saved.type,
      createdBy: saved.createdBy,
      createdAt: saved.createdAt,
    });

    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateEvaluationDto) {
    const evaluation = await this.evaluationRepo.findOne({ where: { id } });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation "${id}" introuvable.`);
    }

    this.ensureEditable(evaluation);

    const payload = this.buildEvaluationDefaults({
      ...evaluation,
      ...dto,
    });

    await this.validateEvaluationShape({
      id: evaluation.id,
      appelOffreId: payload.appelOffreId,
      parentEvaluationId: payload.parentEvaluationId ?? null,
      type: payload.type,
      scoringMode: payload.scoringMode,
      technicalWeight: payload.technicalWeight,
      financialWeight: payload.financialWeight,
    });

    Object.assign(evaluation, payload);
    const saved = await this.evaluationRepo.save(evaluation);

    this.emit(EVALUATION_EVENTS.UPDATED, {
      evaluationId: saved.id,
      reference: saved.reference,
      updatedAt: saved.updatedAt,
    });

    return this.findOne(saved.id);
  }

  async remove(id: string): Promise<void> {
    const evaluation = await this.evaluationRepo.findOne({ where: { id } });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation "${id}" introuvable.`);
    }

    if (
      ![EvaluationStatus.BROUILLON, EvaluationStatus.ANNULEE].includes(
        evaluation.statut,
      )
    ) {
      throw new ConflictException(
        'Seules les évaluations en brouillon ou annulées peuvent être supprimées.',
      );
    }

    await this.evaluationRepo.remove(evaluation);
  }

  async changeStatus(
    id: string,
    dto: ChangeEvaluationStatusDto,
    userId?: string,
  ) {
    const evaluation = await this.evaluationRepo.findOne({ where: { id } });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation "${id}" introuvable.`);
    }

    if (evaluation.statut === dto.statut) {
      return this.findOne(id);
    }

    await this.assertTransitionAllowed(evaluation, dto.statut);

    evaluation.statut = dto.statut;
    if (dto.statut === EvaluationStatus.EN_COURS && !evaluation.startedAt) {
      evaluation.startedAt = new Date();
    }
    if (dto.statut === EvaluationStatus.TERMINEE) {
      evaluation.completedAt = new Date();
    }
    if (dto.statut === EvaluationStatus.VALIDEE) {
      evaluation.validatedAt = new Date();
      evaluation.validatedBy = userId ?? evaluation.validatedBy;
    }

    const saved = await this.evaluationRepo.save(evaluation);
    this.emit(EVALUATION_EVENTS.STATUS_CHANGED, {
      evaluationId: saved.id,
      reference: saved.reference,
      statut: saved.statut,
      changedBy: userId ?? null,
      changedAt: new Date().toISOString(),
    });

    return this.findOne(saved.id);
  }

  async findCriteria(evaluationId: string) {
    await this.getEvaluationEntity(evaluationId);
    return this.criterionRepo.find({
      where: { evaluationId },
      order: { ordre: 'ASC', createdAt: 'ASC' },
    });
  }

  async addCriterion(evaluationId: string, dto: CreateCriterionDto) {
    const evaluation = await this.evaluationRepo.findOne({
      where: { id: evaluationId },
    });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation "${evaluationId}" introuvable.`);
    }

    this.ensureEditable(evaluation);

    const existing = await this.criterionRepo.findOne({
      where: { evaluationId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Le critère "${dto.code}" existe déjà pour cette évaluation.`,
      );
    }

    const criterion = this.criterionRepo.create({
      ...dto,
      evaluationId,
      description: dto.description ?? null,
      noteMax: dto.noteMax ?? 100,
      noteMinimale: dto.noteMinimale ?? null,
      eliminatoire: dto.eliminatoire ?? false,
      ordre:
        dto.ordre ??
        (await this.criterionRepo.count({ where: { evaluationId } })) + 1,
    });

    const saved = await this.criterionRepo.save(criterion);
    this.emit(EVALUATION_EVENTS.CRITERION_CREATED, {
      evaluationId,
      criterionId: saved.id,
      code: saved.code,
      poids: saved.poids,
    });

    return saved;
  }

  async updateCriterion(
    evaluationId: string,
    criterionId: string,
    dto: UpdateCriterionDto,
  ) {
    const evaluation = await this.evaluationRepo.findOne({
      where: { id: evaluationId },
    });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation "${evaluationId}" introuvable.`);
    }

    this.ensureEditable(evaluation);

    const criterion = await this.criterionRepo.findOne({
      where: { id: criterionId, evaluationId },
    });
    if (!criterion) {
      throw new NotFoundException(`Critère "${criterionId}" introuvable.`);
    }

    if (dto.code && dto.code !== criterion.code) {
      const duplicate = await this.criterionRepo.findOne({
        where: { evaluationId, code: dto.code },
      });
      if (duplicate) {
        throw new ConflictException(`Le critère "${dto.code}" existe déjà.`);
      }
    }

    Object.assign(criterion, {
      ...dto,
      description: dto.description ?? criterion.description,
      noteMinimale: dto.noteMinimale ?? criterion.noteMinimale,
    });
    const saved = await this.criterionRepo.save(criterion);

    this.emit(EVALUATION_EVENTS.CRITERION_UPDATED, {
      evaluationId,
      criterionId: saved.id,
      code: saved.code,
      poids: saved.poids,
    });

    return saved;
  }

  async removeCriterion(
    evaluationId: string,
    criterionId: string,
  ): Promise<void> {
    const evaluation = await this.evaluationRepo.findOne({
      where: { id: evaluationId },
    });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation "${evaluationId}" introuvable.`);
    }

    this.ensureEditable(evaluation);

    const criterion = await this.criterionRepo.findOne({
      where: { id: criterionId, evaluationId },
    });
    if (!criterion) {
      throw new NotFoundException(`Critère "${criterionId}" introuvable.`);
    }

    await this.criterionRepo.remove(criterion);
    this.emit(EVALUATION_EVENTS.CRITERION_REMOVED, {
      evaluationId,
      criterionId,
      code: criterion.code,
    });
  }

  private async generateSubmissionAlias(evaluationId: string): Promise<string> {
    const count = await this.submissionRepo.count({ where: { evaluationId } });
    return `SOUM-${String(count + 1).padStart(3, '0')}`;
  }

  async listSubmissions(evaluationId: string, revealIdentity = false) {
    const evaluation = await this.getEvaluationEntity(evaluationId);
    return evaluation.soumissions.map((submission) =>
      this.serializeSubmission(submission, evaluation, revealIdentity),
    );
  }

  async registerSubmission(evaluationId: string, dto: RegisterSubmissionDto) {
    const evaluation = await this.evaluationRepo.findOne({
      where: { id: evaluationId },
    });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation "${evaluationId}" introuvable.`);
    }

    this.ensureEditable(evaluation);

    const existing = await this.submissionRepo.findOne({
      where: { evaluationId, externalSubmissionId: dto.externalSubmissionId },
    });
    if (existing) {
      throw new ConflictException(
        `La soumission "${dto.externalSubmissionId}" est déjà rattachée à cette évaluation.`,
      );
    }

    const submission = this.submissionRepo.create({
      ...dto,
      evaluationId,
      aliasAnonyme: await this.generateSubmissionAlias(evaluationId),
      devise: dto.devise ?? 'DZD',
      operateurEconomiqueId: dto.operateurEconomiqueId ?? null,
      operateurNom: dto.operateurNom ?? null,
      lotId: dto.lotId ?? null,
      montantOffre: dto.montantOffre ?? null,
      metadata: dto.metadata ?? null,
    });

    const saved = await this.submissionRepo.save(submission);
    this.emit(EVALUATION_EVENTS.SUBMISSION_REGISTERED, {
      evaluationId,
      submissionId: saved.id,
      externalSubmissionId: saved.externalSubmissionId,
      aliasAnonyme: saved.aliasAnonyme,
    });

    return this.serializeSubmission(saved, evaluation);
  }

  async updateSubmission(
    evaluationId: string,
    submissionId: string,
    dto: UpdateSubmissionDto,
    revealIdentity = true,
  ) {
    const evaluation = await this.evaluationRepo.findOne({
      where: { id: evaluationId },
    });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation "${evaluationId}" introuvable.`);
    }

    this.ensureEditable(evaluation);

    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId, evaluationId },
    });
    if (!submission) {
      throw new NotFoundException(`Soumission "${submissionId}" introuvable.`);
    }

    if (
      dto.externalSubmissionId &&
      dto.externalSubmissionId !== submission.externalSubmissionId
    ) {
      const duplicate = await this.submissionRepo.findOne({
        where: { evaluationId, externalSubmissionId: dto.externalSubmissionId },
      });
      if (duplicate) {
        throw new ConflictException(
          `La soumission "${dto.externalSubmissionId}" existe déjà dans cette évaluation.`,
        );
      }
    }

    Object.assign(submission, {
      ...dto,
      operateurEconomiqueId:
        dto.operateurEconomiqueId ?? submission.operateurEconomiqueId,
      operateurNom: dto.operateurNom ?? submission.operateurNom,
      lotId: dto.lotId ?? submission.lotId,
      devise: dto.devise ?? submission.devise,
      metadata: dto.metadata ?? submission.metadata,
    });

    const saved = await this.submissionRepo.save(submission);
    this.emit(EVALUATION_EVENTS.SUBMISSION_UPDATED, {
      evaluationId,
      submissionId: saved.id,
      externalSubmissionId: saved.externalSubmissionId,
    });

    return this.serializeSubmission(saved, evaluation, revealIdentity);
  }

  async removeSubmission(
    evaluationId: string,
    submissionId: string,
  ): Promise<void> {
    const evaluation = await this.evaluationRepo.findOne({
      where: { id: evaluationId },
    });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation "${evaluationId}" introuvable.`);
    }

    this.ensureEditable(evaluation);

    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId, evaluationId },
    });
    if (!submission) {
      throw new NotFoundException(`Soumission "${submissionId}" introuvable.`);
    }

    await this.submissionRepo.remove(submission);
    this.emit(EVALUATION_EVENTS.SUBMISSION_REMOVED, {
      evaluationId,
      submissionId,
      externalSubmissionId: submission.externalSubmissionId,
    });
  }

  async listNotes(evaluationId: string, submissionId: string) {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId, evaluationId },
    });
    if (!submission) {
      throw new NotFoundException(`Soumission "${submissionId}" introuvable.`);
    }

    const notes = await this.noteRepo.find({
      where: { evaluationId, evaluationSubmissionId: submissionId },
      relations: { criterion: true },
      order: { createdAt: 'ASC' },
    });

    return notes
      .map((note) => ({
        id: note.id,
        criterionId: note.criterionId,
        criterionCode: note.criterion?.code,
        criterionLabel: note.criterion?.libelle,
        evaluatorId: note.evaluatorId,
        evaluatorName: note.evaluatorName,
        source: note.source,
        note: note.note,
        justification: note.justification,
        scoreConfiance: note.scoreConfiance,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      }))
      .sort((a, b) =>
        (a.criterionCode ?? '').localeCompare(b.criterionCode ?? ''),
      );
  }

  async upsertNote(
    evaluationId: string,
    submissionId: string,
    dto: UpsertNoteDto,
    userId: string,
  ) {
    const evaluation = await this.evaluationRepo.findOne({
      where: { id: evaluationId },
    });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation "${evaluationId}" introuvable.`);
    }

    if (evaluation.statut !== EvaluationStatus.EN_COURS) {
      throw new ConflictException(
        'Les notes ne peuvent être enregistrées que pendant une évaluation en cours.',
      );
    }

    if (evaluation.scoringMode !== EvaluationScoringMode.GRILLE_CRITERES) {
      throw new ConflictException(
        "Cette évaluation n'accepte pas de notation manuelle par critère.",
      );
    }

    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId, evaluationId },
    });
    if (!submission) {
      throw new NotFoundException(`Soumission "${submissionId}" introuvable.`);
    }

    const criterion = await this.criterionRepo.findOne({
      where: { id: dto.criterionId, evaluationId },
    });
    if (!criterion) {
      throw new NotFoundException(`Critère "${dto.criterionId}" introuvable.`);
    }

    if (dto.note > criterion.noteMax) {
      throw new BadRequestException(
        `La note ${dto.note} dépasse le maximum autorisé (${criterion.noteMax}) pour ce critère.`,
      );
    }

    const source = dto.source ?? EvaluationNoteSource.HUMAIN;
    const evaluatorId =
      source === EvaluationNoteSource.IA ? `ia:${userId}` : userId;

    let note = await this.noteRepo.findOne({
      where: {
        evaluationId,
        evaluationSubmissionId: submissionId,
        criterionId: dto.criterionId,
        evaluatorId,
        source,
      },
    });

    if (!note) {
      note = this.noteRepo.create({
        evaluationId,
        evaluationSubmissionId: submissionId,
        criterionId: dto.criterionId,
        evaluatorId,
        source,
      });
    }

    Object.assign(note, {
      note: dto.note,
      justification: dto.justification,
      evaluatorName: dto.evaluatorName ?? note.evaluatorName ?? null,
      scoreConfiance: dto.scoreConfiance ?? null,
    });

    const saved = await this.noteRepo.save(note);
    this.emit(EVALUATION_EVENTS.NOTE_RECORDED, {
      evaluationId,
      submissionId,
      criterionId: dto.criterionId,
      evaluatorId,
      source,
      updatedAt: saved.updatedAt,
    });

    return saved;
  }

  private buildCriteriaScore(
    criteria: EvaluationCriterion[],
    notes: EvaluationNote[],
  ): {
    totalScore: number;
    averageScore: number;
    eliminationReason: string | null;
    breakdown: Record<string, unknown>[];
  } {
    let totalScore = 0;
    let rawAverageAccumulator = 0;
    const reasons: string[] = [];

    const breakdown = criteria.map((criterion) => {
      const criterionNotes = notes.filter(
        (note) => note.criterionId === criterion.id,
      );
      if (criterionNotes.length === 0) {
        throw new BadRequestException(
          `Le critère "${criterion.code}" n'a pas encore été noté pour une ou plusieurs soumissions.`,
        );
      }

      const rawAverage = this.round(
        criterionNotes.reduce((sum, note) => sum + note.note, 0) /
          criterionNotes.length,
      );
      const weightedScore = this.round(
        (rawAverage / criterion.noteMax) * criterion.poids,
      );
      totalScore += weightedScore;
      rawAverageAccumulator += rawAverage;

      if (
        criterion.eliminatoire &&
        criterion.noteMinimale !== null &&
        rawAverage < criterion.noteMinimale
      ) {
        reasons.push(
          `Critère éliminatoire "${criterion.libelle}" en dessous du seuil (${rawAverage}/${criterion.noteMinimale}).`,
        );
      }

      return {
        criterionId: criterion.id,
        code: criterion.code,
        libelle: criterion.libelle,
        noteMoyenne: rawAverage,
        noteMax: criterion.noteMax,
        poids: criterion.poids,
        notePonderee: weightedScore,
        noteMinimale: criterion.noteMinimale,
        eliminatoire: criterion.eliminatoire,
        nombreNotes: criterionNotes.length,
      };
    });

    return {
      totalScore: this.round(totalScore),
      averageScore: this.round(rawAverageAccumulator / criteria.length),
      eliminationReason: reasons.length ? reasons.join(' ') : null,
      breakdown,
    };
  }

  private buildRecommendation(
    evaluation: Evaluation,
    score: number,
    eliminated: boolean,
  ): EvaluationRecommendation {
    if (eliminated) {
      return EvaluationRecommendation.ELIMINER;
    }

    if (score >= evaluation.recommendationThreshold) {
      return EvaluationRecommendation.RETENIR;
    }

    return EvaluationRecommendation.ANALYSER_PLUS;
  }

  private async computeScores(
    evaluation: Evaluation,
  ): Promise<SubmissionScore[]> {
    await this.validateReadiness(evaluation);

    const criteria = await this.criterionRepo.find({
      where: { evaluationId: evaluation.id },
      order: { ordre: 'ASC' },
    });
    const submissions = await this.submissionRepo.find({
      where: { evaluationId: evaluation.id },
    });
    const notes = await this.noteRepo.find({
      where: { evaluationId: evaluation.id },
    });
    const parentResults = await this.getParentResults(
      evaluation,
      evaluation.type === EvaluationType.FINANCIERE,
    );

    const eligibleAmounts = submissions
      .filter((submission) => {
        if (!submission.montantOffre || submission.montantOffre <= 0) {
          return false;
        }

        if (evaluation.parentEvaluationId) {
          const parentResult = parentResults.get(
            submission.externalSubmissionId,
          );
          return Boolean(parentResult && !parentResult.eliminee);
        }

        return true;
      })
      .map((submission) => submission.montantOffre as number);

    const lowestAmount =
      eligibleAmounts.length > 0 ? Math.min(...eligibleAmounts) : null;

    const computed = submissions.map((submission): SubmissionScore => {
      const submissionNotes = notes.filter(
        (note) => note.evaluationSubmissionId === submission.id,
      );
      const detailCalcul: Record<string, unknown> = {
        evaluationType: evaluation.type,
        scoringMode: evaluation.scoringMode,
      };
      const eliminationReasons: string[] = [];
      let technicalScore: number | null = null;
      let financialScore: number | null = null;
      let averageScore: number | null = null;

      if (evaluation.parentEvaluationId) {
        const parentResult = parentResults.get(submission.externalSubmissionId);
        if (!parentResult || parentResult.eliminee) {
          eliminationReasons.push(
            "Soumission non qualifiée par l'évaluation technique parente.",
          );
        } else {
          technicalScore = parentResult.scoreGlobal;
          detailCalcul.parentEvaluation = {
            evaluationId: evaluation.parentEvaluationId,
            technicalScore,
          };
        }
      }

      if (evaluation.scoringMode === EvaluationScoringMode.GRILLE_CRITERES) {
        const criteriaScore = this.buildCriteriaScore(
          criteria,
          submissionNotes,
        );
        averageScore = criteriaScore.averageScore;
        detailCalcul.criteria = criteriaScore.breakdown;
        if (criteriaScore.eliminationReason) {
          eliminationReasons.push(criteriaScore.eliminationReason);
        }

        if (evaluation.type === EvaluationType.FINANCIERE) {
          financialScore = criteriaScore.totalScore;
        } else {
          technicalScore = criteriaScore.totalScore;
        }
      }

      if (
        evaluation.scoringMode === EvaluationScoringMode.FORMULE_MOINS_DISANTE
      ) {
        if (!submission.montantOffre || submission.montantOffre <= 0) {
          eliminationReasons.push('Montant financier manquant ou invalide.');
        } else if (!lowestAmount) {
          eliminationReasons.push(
            "Aucune base de calcul financière valide n'est disponible pour cette évaluation.",
          );
        } else {
          financialScore = this.round(
            (lowestAmount / submission.montantOffre) * 100,
          );
          averageScore = financialScore;
          detailCalcul.formuleFinanciere = {
            lowestAmount,
            montantOffre: submission.montantOffre,
            scoreFinancier: financialScore,
          };
        }
      }

      let globalScore = technicalScore ?? financialScore ?? 0;

      if (
        evaluation.type === EvaluationType.FINANCIERE &&
        financialScore !== null
      ) {
        if (evaluation.parentEvaluationId && technicalScore !== null) {
          globalScore = this.round(
            (technicalScore * evaluation.technicalWeight +
              financialScore * evaluation.financialWeight) /
              100,
          );
        } else {
          globalScore = financialScore;
        }
      }

      if (globalScore < evaluation.minimumOverallScore) {
        eliminationReasons.push(
          `Score global ${globalScore} inférieur au seuil requis (${evaluation.minimumOverallScore}).`,
        );
      }

      const eliminated = eliminationReasons.length > 0;
      const recommendation = this.buildRecommendation(
        evaluation,
        globalScore,
        eliminated,
      );

      return {
        submissionId: submission.id,
        externalSubmissionId: submission.externalSubmissionId,
        technicalScore,
        financialScore,
        globalScore,
        averageScore,
        eliminated,
        eliminationReason: eliminated ? eliminationReasons.join(' ') : null,
        recommendation,
        detailCalcul,
      };
    });

    const ranked = computed
      .filter((score) => !score.eliminated)
      .sort(
        (left, right) =>
          right.globalScore - left.globalScore ||
          (right.financialScore ?? -1) - (left.financialScore ?? -1) ||
          (right.technicalScore ?? -1) - (left.technicalScore ?? -1) ||
          left.externalSubmissionId.localeCompare(right.externalSubmissionId),
      );

    ranked.forEach((score, index) => {
      score.detailCalcul.rang = index + 1;
    });

    return computed;
  }

  async recalculateScores(evaluationId: string) {
    const evaluation = await this.evaluationRepo.findOne({
      where: { id: evaluationId },
    });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation "${evaluationId}" introuvable.`);
    }

    if (
      ![
        EvaluationStatus.PRETE,
        EvaluationStatus.EN_COURS,
        EvaluationStatus.TERMINEE,
      ].includes(evaluation.statut)
    ) {
      throw new ConflictException(
        'Le calcul des scores est autorisé uniquement pour une évaluation prête, en cours ou terminée.',
      );
    }

    const computedScores = await this.computeScores(evaluation);
    const existingResults = await this.resultRepo.find({
      where: { evaluationId },
    });
    const resultBySubmissionId = new Map(
      existingResults.map((result) => [result.evaluationSubmissionId, result]),
    );
    const submissionMap = new Map(
      (
        await this.submissionRepo.find({
          where: { evaluationId },
        })
      ).map((submission) => [submission.id, submission]),
    );

    const ranking = computedScores
      .filter((score) => !score.eliminated)
      .sort(
        (left, right) =>
          right.globalScore - left.globalScore ||
          (right.financialScore ?? -1) - (left.financialScore ?? -1) ||
          (right.technicalScore ?? -1) - (left.technicalScore ?? -1),
      );

    const rankBySubmissionId = new Map(
      ranking.map((score, index) => [score.submissionId, index + 1]),
    );

    const now = new Date();
    const resultsToSave = computedScores.map((computed) => {
      const existing = resultBySubmissionId.get(computed.submissionId);
      const rank = computed.eliminated
        ? null
        : (rankBySubmissionId.get(computed.submissionId) ?? null);

      if (existing) {
        Object.assign(existing, {
          scoreTechnique: computed.technicalScore,
          scoreFinancier: computed.financialScore,
          scoreGlobal: computed.globalScore,
          scoreMoyen: computed.averageScore,
          rang: rank,
          recommandation: computed.recommendation,
          eliminee: computed.eliminated,
          motifElimination: computed.eliminationReason,
          detailCalcul: {
            ...computed.detailCalcul,
            rang: rank,
          },
          calculatedAt: now,
        });
        return existing;
      }

      return this.resultRepo.create({
        evaluationId,
        evaluationSubmissionId: computed.submissionId,
        scoreTechnique: computed.technicalScore,
        scoreFinancier: computed.financialScore,
        scoreGlobal: computed.globalScore,
        scoreMoyen: computed.averageScore,
        rang: rank,
        recommandation: computed.recommendation,
        eliminee: computed.eliminated,
        motifElimination: computed.eliminationReason,
        detailCalcul: {
          ...computed.detailCalcul,
          rang: rank,
        },
        calculatedAt: now,
      });
    });

    const submissionsToSave = computedScores.map((computed) => {
      const submission = submissionMap.get(computed.submissionId);
      if (!submission) {
        throw new NotFoundException(
          `Soumission "${computed.submissionId}" introuvable.`,
        );
      }

      const rank = computed.eliminated
        ? null
        : (rankBySubmissionId.get(computed.submissionId) ?? null);
      submission.scoreTechnique = computed.technicalScore;
      submission.scoreFinancier = computed.financialScore;
      submission.scoreGlobal = computed.globalScore;
      submission.scoreMoyen = computed.averageScore;
      submission.rang = rank;
      submission.recommandation = computed.recommendation;
      submission.motifElimination = computed.eliminationReason;
      submission.statut = computed.eliminated
        ? EvaluationSubmissionStatus.ELIMINEE
        : evaluation.type === EvaluationType.FINANCIERE
          ? EvaluationSubmissionStatus.CLASSEE
          : EvaluationSubmissionStatus.QUALIFIEE;
      return submission;
    });

    await this.resultRepo.save(resultsToSave);
    await this.submissionRepo.save(submissionsToSave);

    evaluation.lastCalculatedAt = now;
    await this.evaluationRepo.save(evaluation);

    this.emit(EVALUATION_EVENTS.SCORES_CALCULATED, {
      evaluationId,
      calculatedAt: now,
      submissionCount: submissionsToSave.length,
    });
    this.emit(EVALUATION_EVENTS.RANKING_FINALIZED, {
      evaluationId,
      calculatedAt: now,
      rankedSubmissionCount: ranking.length,
    });

    return this.getRanking(evaluationId, true);
  }

  async getRanking(evaluationId: string, revealIdentity = false) {
    const evaluation = await this.getEvaluationEntity(evaluationId);
    const results = await this.resultRepo.find({
      where: { evaluationId },
      order: { rang: 'ASC', scoreGlobal: 'DESC' },
    });
    const resultBySubmissionId = new Map(
      results.map((result) => [result.evaluationSubmissionId, result]),
    );

    return evaluation.soumissions
      .map((submission) => ({
        ...this.serializeSubmission(submission, evaluation, revealIdentity),
        resultat: resultBySubmissionId.get(submission.id)
          ? {
              scoreTechnique: resultBySubmissionId.get(submission.id)
                ?.scoreTechnique,
              scoreFinancier: resultBySubmissionId.get(submission.id)
                ?.scoreFinancier,
              scoreGlobal: resultBySubmissionId.get(submission.id)?.scoreGlobal,
              scoreMoyen: resultBySubmissionId.get(submission.id)?.scoreMoyen,
              rang: resultBySubmissionId.get(submission.id)?.rang,
              recommandation: resultBySubmissionId.get(submission.id)
                ?.recommandation,
              eliminee: resultBySubmissionId.get(submission.id)?.eliminee,
              motifElimination: resultBySubmissionId.get(submission.id)
                ?.motifElimination,
              detailCalcul: resultBySubmissionId.get(submission.id)
                ?.detailCalcul,
              calculatedAt: resultBySubmissionId.get(submission.id)
                ?.calculatedAt,
            }
          : null,
      }))
      .sort(
        (left, right) =>
          (left.resultat?.rang ?? Number.MAX_SAFE_INTEGER) -
            (right.resultat?.rang ?? Number.MAX_SAFE_INTEGER) ||
          (right.resultat?.scoreGlobal ?? -1) -
            (left.resultat?.scoreGlobal ?? -1),
      );
  }

  private async buildReportBuffer(evaluation: Evaluation): Promise<Buffer> {
    const ranking = await this.getRanking(evaluation.id, true);
    const criteria = await this.findCriteria(evaluation.id);

    return new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({ margin: 48 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).font('Helvetica-Bold').text("RAPPORT D'EVALUATION", {
        align: 'center',
      });
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .font('Helvetica')
        .text(`Référence: ${evaluation.reference}`, { align: 'center' });
      doc.moveDown();

      doc.fontSize(12).font('Helvetica');
      doc.text(`Objet: ${evaluation.objet}`);
      doc.text(`Appel d'offres: ${evaluation.appelOffreId}`);
      doc.text(`Commission: ${evaluation.commissionId}`);
      doc.text(`Type: ${evaluation.type}`);
      doc.text(`Statut: ${evaluation.statut}`);
      doc.text(`Mode de scoring: ${evaluation.scoringMode}`);
      doc.text(
        `Dernier calcul des scores: ${
          evaluation.lastCalculatedAt?.toISOString() ?? 'Non effectué'
        }`,
      );
      doc.moveDown();

      doc.fontSize(14).font('Helvetica-Bold').text('Grille et règles', {
        underline: true,
      });
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Seuil minimal global: ${evaluation.minimumOverallScore}`);
      doc.text(
        `Seuil de recommandation: ${evaluation.recommendationThreshold}`,
      );
      doc.text(
        `Pondérations technique/financière: ${evaluation.technicalWeight}% / ${evaluation.financialWeight}%`,
      );
      criteria.forEach((criterion, index) => {
        doc.text(
          `${index + 1}. ${criterion.code} - ${criterion.libelle} | poids ${criterion.poids}% | note max ${criterion.noteMax}${
            criterion.noteMinimale !== null
              ? ` | seuil ${criterion.noteMinimale}`
              : ''
          }${criterion.eliminatoire ? ' | éliminatoire' : ''}`,
        );
      });
      doc.moveDown();

      doc.fontSize(14).font('Helvetica-Bold').text('Classement final', {
        underline: true,
      });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      ranking.forEach((item, index) => {
        doc.text(
          `${index + 1}. ${item.aliasAnonyme} (${item.operateurNom ?? 'Identité masquée'}) - score global ${
            item.resultat?.scoreGlobal ?? 'N/A'
          } - rang ${item.resultat?.rang ?? 'ELIMINE'} - recommandation ${
            item.resultat?.recommandation ?? 'N/A'
          }`,
        );
        if (item.resultat?.motifElimination) {
          doc
            .fillColor('red')
            .text(`Motif d'élimination: ${item.resultat.motifElimination}`);
          doc.fillColor('black');
        }
      });

      doc.moveDown();
      doc
        .fontSize(10)
        .fillColor('gray')
        .text(`Généré le ${new Date().toLocaleString('fr-FR')}`, {
          align: 'right',
        });

      doc.end();
    });
  }

  async generateReport(evaluationId: string, userId?: string) {
    const evaluation = await this.evaluationRepo.findOne({
      where: { id: evaluationId },
      relations: { rapports: true },
    });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation "${evaluationId}" introuvable.`);
    }

    if (
      ![
        EvaluationStatus.TERMINEE,
        EvaluationStatus.VALIDEE,
        EvaluationStatus.ARCHIVEE,
      ].includes(evaluation.statut)
    ) {
      throw new ConflictException(
        "Le rapport final ne peut être généré qu'après la clôture de l'évaluation.",
      );
    }

    const buffer = await this.buildReportBuffer(evaluation);
    const checksum = createHash('sha256').update(buffer).digest('hex');
    const version = (evaluation.rapports?.length ?? 0) + 1;
    const fileName = `${evaluation.reference}-rapport-v${version}.pdf`;
    const objectKey = `${evaluation.reference}/${fileName}`;
    const storageUrl = await this.minioService.uploadFile(
      this.reportsBucket,
      objectKey,
      buffer,
      'application/pdf',
    );

    const report = this.reportRepo.create({
      evaluationId,
      version,
      fileName,
      bucket: this.reportsBucket,
      objectKey,
      contentType: 'application/pdf',
      size: buffer.byteLength,
      checksum,
      storageUrl,
      generatedBy: userId ?? null,
      generatedAt: new Date(),
    });

    const saved = await this.reportRepo.save(report);
    this.emit(EVALUATION_EVENTS.REPORT_GENERATED, {
      evaluationId,
      reportId: saved.id,
      version: saved.version,
      generatedBy: saved.generatedBy,
      generatedAt: saved.generatedAt,
    });

    return this.getLatestReport(evaluationId);
  }

  async getLatestReport(evaluationId: string) {
    const reports = await this.reportRepo.find({
      where: { evaluationId },
      order: { version: 'DESC' },
      take: 1,
    });
    const latest = reports[0];
    if (!latest) {
      throw new NotFoundException(
        `Aucun rapport n'a encore été généré pour l'évaluation "${evaluationId}".`,
      );
    }

    const downloadUrl = await this.minioService.getPresignedUrl(
      latest.bucket,
      latest.objectKey,
    );

    return {
      id: latest.id,
      evaluationId: latest.evaluationId,
      version: latest.version,
      fileName: latest.fileName,
      checksum: latest.checksum,
      size: latest.size,
      generatedBy: latest.generatedBy,
      generatedAt: latest.generatedAt,
      storageUrl: latest.storageUrl,
      downloadUrl,
    };
  }
}
