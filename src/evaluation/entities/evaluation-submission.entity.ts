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
import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { EvaluationRecommendation } from '../enums/evaluation-recommendation.enum';
import { EvaluationSubmissionStatus } from '../enums/evaluation-submission-status.enum';
import { Evaluation } from './evaluation.entity';
import { EvaluationNote } from './evaluation-note.entity';
import { EvaluationResult } from './evaluation-result.entity';

@Entity('evaluation_submissions')
@Unique(['evaluationId', 'externalSubmissionId'])
export class EvaluationSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Evaluation, (evaluation) => evaluation.soumissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: Evaluation;

  @Column('uuid')
  evaluationId: string;

  @Column({ length: 128 })
  externalSubmissionId: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  operateurEconomiqueId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  operateurNom: string | null;

  @Column({ length: 64 })
  aliasAnonyme: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  lotId: string | null;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  montantOffre: number | null;

  @Column({ length: 8, default: 'DZD' })
  devise: string;

  @Column({
    type: 'enum',
    enum: EvaluationSubmissionStatus,
    default: EvaluationSubmissionStatus.EN_ATTENTE,
  })
  statut: EvaluationSubmissionStatus;

  @Column({ type: 'text', nullable: true })
  motifElimination: string | null;

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
    nullable: true,
    transformer: decimalTransformer,
  })
  scoreGlobal: number | null;

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
    nullable: true,
  })
  recommandation: EvaluationRecommendation | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => EvaluationNote, (note) => note.evaluationSubmission)
  notes: EvaluationNote[];

  @OneToOne(() => EvaluationResult, (result) => result.evaluationSubmission)
  resultat: EvaluationResult;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
