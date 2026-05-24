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
import { Evaluation } from './evaluation.entity';

@Entity('evaluation_criteria')
@Unique(['evaluationId', 'code'])
export class EvaluationCriterion {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Omit ApiProperty to prevent circular dependency in Swagger
  @ManyToOne(() => Evaluation, (evaluation) => evaluation.criteres, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: Evaluation;

  @ApiProperty()
  @Column('uuid')
  evaluationId: string;

  @ApiProperty()
  @Column({ length: 64 })
  code: string;

  @ApiProperty()
  @Column({ length: 160 })
  libelle: string;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    transformer: decimalTransformer,
  })
  poids: number;

  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 100,
    transformer: decimalTransformer,
  })
  noteMax: number;

  @ApiPropertyOptional()
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  noteMinimale: number | null;

  @ApiProperty()
  @Column({ default: false })
  eliminatoire: boolean;

  @ApiProperty()
  @Column({ type: 'int', default: 1 })
  ordre: number;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}