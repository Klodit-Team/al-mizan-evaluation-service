import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EvaluationScoringMode } from '../enums/evaluation-scoring-mode.enum';
import { EvaluationType } from '../enums/evaluation-type.enum';

export class CreateEvaluationDto {
  @ApiProperty({ example: 'ao-2026-001' })
  @IsString()
  @MaxLength(128)
  appelOffreId: string;

  @ApiProperty({ example: 'commission-cope-001' })
  @IsString()
  @MaxLength(128)
  commissionId: string;

  @ApiPropertyOptional({ example: 'c4d56c66-a7f5-4d1d-b6e0-91f4c1b0df6e' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  parentEvaluationId?: string;

  @ApiProperty({ enum: EvaluationType, example: EvaluationType.TECHNIQUE })
  @IsEnum(EvaluationType)
  type: EvaluationType;

  @ApiPropertyOptional({
    enum: EvaluationScoringMode,
    example: EvaluationScoringMode.GRILLE_CRITERES,
  })
  @IsOptional()
  @IsEnum(EvaluationScoringMode)
  scoringMode?: EvaluationScoringMode;

  @ApiProperty({ example: "Evaluation technique de l'AO 2026-001" })
  @IsString()
  @MaxLength(255)
  objet: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  modeAveugle?: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minimumOverallScore?: number;

  @ApiPropertyOptional({ default: 70, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  recommendationThreshold?: number;

  @ApiPropertyOptional({ default: 100, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  technicalWeight?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  financialWeight?: number;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  integrationMetadata?: Record<string, unknown>;
}
