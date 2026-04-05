import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Evaluation } from './evaluation.entity';

@Entity('evaluation_reports')
@Unique(['evaluationId', 'version'])
export class EvaluationReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Evaluation, (evaluation) => evaluation.rapports, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: Evaluation;

  @Column('uuid')
  evaluationId: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ length: 255 })
  fileName: string;

  @Column({ length: 128 })
  bucket: string;

  @Column({ length: 255 })
  objectKey: string;

  @Column({ length: 128, default: 'application/pdf' })
  contentType: string;

  @Column({ type: 'int' })
  size: number;

  @Column({ length: 64 })
  checksum: string;

  @Column({ type: 'text' })
  storageUrl: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  generatedBy: string | null;

  @Column({ type: 'datetime' })
  generatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
