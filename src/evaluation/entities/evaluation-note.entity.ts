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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { EvaluationNoteSource } from '../enums/evaluation-note-source.enum';
import { EvaluationCriterion } from './evaluation-criterion.entity';
import { EvaluationSubmission } from './evaluation-submission.entity';
import { Evaluation } from './evaluation.entity';

@Entity('evaluation_notes')
@Unique(['evaluationSubmissionId', 'criterionId', 'evaluatorId', 'source'])
export class EvaluationNote {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Evaluation, (evaluation) => evaluation.notes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: Evaluation;

  @ApiProperty()
  @Column('uuid')
  evaluationId: string;

  @ManyToOne(() => EvaluationSubmission, (submission) => submission.notes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluationSubmissionId' })
  evaluationSubmission: EvaluationSubmission;

  @ApiProperty()
  @Column('uuid')
  evaluationSubmissionId: string;

  @ManyToOne(() => EvaluationCriterion, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'criterionId' })
  criterion: EvaluationCriterion;

  @ApiProperty()
  @Column('uuid')
  criterionId: string;

  @ApiProperty()
  @Column({ length: 128 })
  evaluatorId: string;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 255, nullable: true })
  evaluatorName: string | null;

  @ApiProperty({ enum: EvaluationNoteSource })
  @Column({
    type: 'enum',
    enum: EvaluationNoteSource,
    default: EvaluationNoteSource.HUMAIN,
  })
  source: EvaluationNoteSource;

  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 7,
    scale: 2,
    transformer: decimalTransformer,
  })
  note: number;

  @ApiProperty()
  @Column({ type: 'text' })
  justification: string;

  @ApiPropertyOptional()
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  scoreConfiance: number | null;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}