import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Evaluation } from './evaluation.entity';

@Entity('evaluation_reports')
@Unique(['evaluationId', 'version'])
export class EvaluationReport {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Evaluation, (evaluation) => evaluation.rapports, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: Evaluation;

  @ApiProperty()
  @Column('uuid')
  evaluationId: string;

  @ApiProperty()
  @Column({ type: 'int' })
  version: number;

  @ApiProperty()
  @Column({ length: 255 })
  fileName: string;

  @ApiProperty()
  @Column({ length: 128 })
  bucket: string;

  @ApiProperty()
  @Column({ length: 255 })
  objectKey: string;

  @ApiProperty()
  @Column({ length: 128, default: 'application/pdf' })
  contentType: string;

  @ApiProperty()
  @Column({ type: 'int' })
  size: number;

  @ApiProperty()
  @Column({ length: 64 })
  checksum: string;

  @ApiProperty()
  @Column({ type: 'text' })
  storageUrl: string;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 128, nullable: true })
  generatedBy: string | null;

  @ApiProperty()
  @Column({ type: 'datetime' })
  generatedAt: Date;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;
}