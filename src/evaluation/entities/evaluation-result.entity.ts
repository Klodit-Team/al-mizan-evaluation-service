import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { EvaluationRecommendation } from '../enums/evaluation-recommendation.enum';
import { EvaluationSubmission } from './evaluation-submission.entity';
import { Evaluation } from './evaluation.entity';

@Entity('evaluation_results')
@Unique(['evaluationId', 'evaluationSubmissionId'])
export class EvaluationResult {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Evaluation, (evaluation) => evaluation.resultats, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: Evaluation;

  @ApiProperty()
  @Column('uuid')
  evaluationId: string;

  @OneToOne(() => EvaluationSubmission, (submission) => submission.resultat, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluationSubmissionId' })
  evaluationSubmission: EvaluationSubmission;

  @ApiProperty()
  @Column('uuid')
  evaluationSubmissionId: string;

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

  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 7,
    scale: 2,
    transformer: decimalTransformer,
  })
  scoreGlobal: number;

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

  @ApiProperty({ enum: EvaluationRecommendation })
  @Column({
    type: 'enum',
    enum: EvaluationRecommendation,
  })
  recommandation: EvaluationRecommendation;

  @ApiProperty()
  @Column({ default: false })
  eliminee: boolean;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  motifElimination: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'simple-json', nullable: true })
  detailCalcul: Record<string, unknown> | null;

  @ApiProperty()
  @Column({ type: 'datetime' })
  calculatedAt: Date;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}