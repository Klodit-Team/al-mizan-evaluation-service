import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { EvaluationStatus } from '../enums/evaluation-status.enum';
import { EvaluationScoringMode } from '../enums/evaluation-scoring-mode.enum';
import { EvaluationType } from '../enums/evaluation-type.enum';
import { EvaluationCriterion } from './evaluation-criterion.entity';
import { EvaluationNote } from './evaluation-note.entity';
import { EvaluationReport } from './evaluation-report.entity';
import { EvaluationResult } from './evaluation-result.entity';
import { EvaluationSubmission } from './evaluation-submission.entity';

@Entity('evaluations')
@Index(['appelOffreId', 'type'])
export class Evaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 32 })
  reference: string;

  @Column({ length: 128 })
  appelOffreId: string;

  @Column({ length: 128 })
  commissionId: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  parentEvaluationId: string | null;

  @Column({
    type: 'enum',
    enum: EvaluationType,
  })
  type: EvaluationType;

  @Column({
    type: 'enum',
    enum: EvaluationScoringMode,
    default: EvaluationScoringMode.GRILLE_CRITERES,
  })
  scoringMode: EvaluationScoringMode;

  @Column()
  objet: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: true })
  modeAveugle: boolean;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  minimumOverallScore: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 70,
    transformer: decimalTransformer,
  })
  recommendationThreshold: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 100,
    transformer: decimalTransformer,
  })
  technicalWeight: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  financialWeight: number;

  @Column({
    type: 'enum',
    enum: EvaluationStatus,
    default: EvaluationStatus.BROUILLON,
  })
  statut: EvaluationStatus;

  @Column({ type: 'varchar', length: 128, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  validatedBy: string | null;

  @Column({ type: 'datetime', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  validatedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastCalculatedAt: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  integrationMetadata: Record<string, unknown> | null;

  @OneToMany(() => EvaluationCriterion, (criterion) => criterion.evaluation, {
    cascade: true,
  })
  criteres: EvaluationCriterion[];

  @OneToMany(
    () => EvaluationSubmission,
    (submission) => submission.evaluation,
    {
      cascade: true,
    },
  )
  soumissions: EvaluationSubmission[];

  @OneToMany(() => EvaluationNote, (note) => note.evaluation)
  notes: EvaluationNote[];

  @OneToMany(() => EvaluationResult, (result) => result.evaluation)
  resultats: EvaluationResult[];

  @OneToMany(() => EvaluationReport, (report) => report.evaluation)
  rapports: EvaluationReport[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
