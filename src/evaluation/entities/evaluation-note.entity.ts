import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { EvaluationNoteSource } from '../enums/evaluation-note-source.enum';
import { EvaluationCriterion } from './evaluation-criterion.entity';
import { EvaluationSubmission } from './evaluation-submission.entity';
import { Evaluation } from './evaluation.entity';

@Entity('evaluation_notes')
@Unique(['evaluationSubmissionId', 'criterionId', 'evaluatorId', 'source'])
export class EvaluationNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Evaluation, (evaluation) => evaluation.notes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: Evaluation;

  @Column('uuid')
  evaluationId: string;

  @ManyToOne(() => EvaluationSubmission, (submission) => submission.notes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluationSubmissionId' })
  evaluationSubmission: EvaluationSubmission;

  @Column('uuid')
  evaluationSubmissionId: string;

  @ManyToOne(() => EvaluationCriterion, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'criterionId' })
  criterion: EvaluationCriterion;

  @Column('uuid')
  criterionId: string;

  @Column({ length: 128 })
  evaluatorId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  evaluatorName: string | null;

  @Column({
    type: 'enum',
    enum: EvaluationNoteSource,
    default: EvaluationNoteSource.HUMAIN,
  })
  source: EvaluationNoteSource;

  @Column({
    type: 'decimal',
    precision: 7,
    scale: 2,
    transformer: decimalTransformer,
  })
  note: number;

  @Column({ type: 'text' })
  justification: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  scoreConfiance: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
