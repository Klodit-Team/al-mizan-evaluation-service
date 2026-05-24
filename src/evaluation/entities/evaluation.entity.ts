import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ unique: true, length: 32 })
  reference: string;

  @ApiProperty()
  @Column({ length: 128 })
  appelOffreId: string;

  @ApiProperty()
  @Column({ length: 128 })
  commissionId: string;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 128, nullable: true })
  parentEvaluationId: string | null;

  @ApiProperty({ enum: EvaluationType })
  @Column({
    type: 'enum',
    enum: EvaluationType,
  })
  type: EvaluationType;

  @ApiProperty({ enum: EvaluationScoringMode })
  @Column({
    type: 'enum',
    enum: EvaluationScoringMode,
    default: EvaluationScoringMode.GRILLE_CRITERES,
  })
  scoringMode: EvaluationScoringMode;

  @ApiProperty()
  @Column()
  objet: string;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty()
  @Column({ default: true })
  modeAveugle: boolean;

  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  minimumOverallScore: number;

  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 70,
    transformer: decimalTransformer,
  })
  recommendationThreshold: number;

  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 100,
    transformer: decimalTransformer,
  })
  technicalWeight: number;

  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  financialWeight: number;

  @ApiProperty({ enum: EvaluationStatus })
  @Column({
    type: 'enum',
    enum: EvaluationStatus,
    default: EvaluationStatus.BROUILLON,
  })
  statut: EvaluationStatus;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 128, nullable: true })
  createdBy: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 128, nullable: true })
  validatedBy: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'datetime', nullable: true })
  startedAt: Date | null;

  @ApiPropertyOptional()
  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @ApiPropertyOptional()
  @Column({ type: 'datetime', nullable: true })
  validatedAt: Date | null;

  @ApiPropertyOptional()
  @Column({ type: 'datetime', nullable: true })
  lastCalculatedAt: Date | null;

  @ApiPropertyOptional()
  @Column({ type: 'simple-json', nullable: true })
  integrationMetadata: Record<string, unknown> | null;

  @ApiProperty({ type: () => [EvaluationCriterion] })
  @OneToMany(() => EvaluationCriterion, (criterion) => criterion.evaluation, {
    cascade: true,
  })
  criteres: EvaluationCriterion[];

  @ApiProperty({ type: () => [EvaluationSubmission] })
  @OneToMany(
    () => EvaluationSubmission,
    (submission) => submission.evaluation,
    {
      cascade: true,
    },
  )
  soumissions: EvaluationSubmission[];

  @ApiProperty({ type: () => [EvaluationNote] })
  @OneToMany(() => EvaluationNote, (note) => note.evaluation)
  notes: EvaluationNote[];

  @ApiProperty({ type: () => [EvaluationResult] })
  @OneToMany(() => EvaluationResult, (result) => result.evaluation)
  resultats: EvaluationResult[];

  @ApiProperty({ type: () => [EvaluationReport] })
  @OneToMany(() => EvaluationReport, (report) => report.evaluation)
  rapports: EvaluationReport[];

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}