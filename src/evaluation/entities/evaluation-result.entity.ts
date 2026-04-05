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
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { EvaluationRecommendation } from '../enums/evaluation-recommendation.enum';
import { EvaluationSubmission } from './evaluation-submission.entity';
import { Evaluation } from './evaluation.entity';

@Entity('evaluation_results')
@Unique(['evaluationId', 'evaluationSubmissionId'])
export class EvaluationResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Evaluation, (evaluation) => evaluation.resultats, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: Evaluation;

  @Column('uuid')
  evaluationId: string;

  @OneToOne(() => EvaluationSubmission, (submission) => submission.resultat, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluationSubmissionId' })
  evaluationSubmission: EvaluationSubmission;

  @Column('uuid')
  evaluationSubmissionId: string;

  @Column({
    type: 'decimal',
    precision: 7,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  scoreTechnique: number | null;

  @Column({
    type: 'decimal',
    precision: 7,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  scoreFinancier: number | null;

  @Column({
    type: 'decimal',
    precision: 7,
    scale: 2,
    transformer: decimalTransformer,
  })
  scoreGlobal: number;

  @Column({
    type: 'decimal',
    precision: 7,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  scoreMoyen: number | null;

  @Column({ type: 'int', nullable: true })
  rang: number | null;

  @Column({
    type: 'enum',
    enum: EvaluationRecommendation,
  })
  recommandation: EvaluationRecommendation;

  @Column({ default: false })
  eliminee: boolean;

  @Column({ type: 'text', nullable: true })
  motifElimination: string | null;

  @Column({ type: 'simple-json', nullable: true })
  detailCalcul: Record<string, unknown> | null;

  @Column({ type: 'datetime' })
  calculatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
