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
import { Evaluation } from './evaluation.entity';

@Entity('evaluation_criteria')
@Unique(['evaluationId', 'code'])
export class EvaluationCriterion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Evaluation, (evaluation) => evaluation.criteres, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: Evaluation;

  @Column('uuid')
  evaluationId: string;

  @Column({ length: 64 })
  code: string;

  @Column({ length: 160 })
  libelle: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    transformer: decimalTransformer,
  })
  poids: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 100,
    transformer: decimalTransformer,
  })
  noteMax: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  noteMinimale: number | null;

  @Column({ default: false })
  eliminatoire: boolean;

  @Column({ type: 'int', default: 1 })
  ordre: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
