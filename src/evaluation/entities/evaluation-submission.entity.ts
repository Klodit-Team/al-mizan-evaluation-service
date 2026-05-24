import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { EvaluationRecommendation } from '../enums/evaluation-recommendation.enum';
import { EvaluationSubmissionStatus } from '../enums/evaluation-submission-status.enum';
import { Evaluation } from './evaluation.entity';
import { EvaluationNote } from './evaluation-note.entity';
import { EvaluationResult } from './evaluation-result.entity';

@Entity('evaluation_submissions')
@Unique(['evaluationId', 'externalSubmissionId'])
export class EvaluationSubmission {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Evaluation, (evaluation) => evaluation.soumissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: Evaluation;

  @ApiProperty()
  @Column('uuid')
  evaluationId: string;

  @ApiProperty()
  @Column({ length: 128 })
  externalSubmissionId: string;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 128, nullable: true })
  operateurEconomiqueId: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 255, nullable: true })
  operateurNom: string | null;

  @ApiProperty()
  @Column({ length: 64 })
  aliasAnonyme: string;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 128, nullable: true })
  lotId: string | null;

  @ApiPropertyOptional()
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  montantOffre: number | null;

  @ApiProperty()
  @Column({ length: 8, default: 'DZD' })
  devise: string;

  @ApiProperty({ enum: EvaluationSubmissionStatus })
  @Column({
    type: 'enum',
    enum: EvaluationSubmissionStatus,
    default: EvaluationSubmissionStatus.EN_ATTENTE,
  })
  statut: EvaluationSubmissionStatus;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  motifElimination: string | null;

  @ApiPropertyOptional()
  @Column({
    type: 'decimal',
    precision: 7,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  scoreTechnique: number | null;

  @ApiPropertyOptional()
  @Column({
    type: 'decimal',
    precision: 7,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  scoreFinancier: number | null;

  @ApiPropertyOptional()
  @Column({
    type: 'decimal',
    precision: 7,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  scoreGlobal: number | null;

  @ApiPropertyOptional()
  @Column({
    type: 'decimal',
    precision: 7,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  scoreMoyen: number | null;

  @ApiPropertyOptional()
  @Column({ type: 'int', nullable: true })
  rang: number | null;

  @ApiPropertyOptional({ enum: EvaluationRecommendation })
  @Column({
    type: 'enum',
    enum: EvaluationRecommendation,
    nullable: true,
  })
  recommandation: EvaluationRecommendation | null;

  @ApiPropertyOptional()
  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @ApiProperty({ type: () => [EvaluationNote] })
  @OneToMany(() => EvaluationNote, (note) => note.evaluationSubmission)
  notes: EvaluationNote[];

  @ApiPropertyOptional({ type: () => EvaluationResult })
  @OneToOne(() => EvaluationResult, (result) => result.evaluationSubmission)
  resultat: EvaluationResult;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}