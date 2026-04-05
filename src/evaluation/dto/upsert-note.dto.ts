import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EvaluationNoteSource } from '../enums/evaluation-note-source.enum';

export class UpsertNoteDto {
  @ApiProperty({ example: 'criterion-uuid' })
  @IsString()
  @MaxLength(128)
  criterionId: string;

  @ApiProperty({ example: 82.5, minimum: 0, maximum: 100 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  note: number;

  @ApiProperty({
    example: 'La méthodologie répond précisément aux exigences du CDC.',
  })
  @IsString()
  justification: string;

  @ApiPropertyOptional({
    enum: EvaluationNoteSource,
    default: EvaluationNoteSource.HUMAIN,
  })
  @IsOptional()
  @IsEnum(EvaluationNoteSource)
  source?: EvaluationNoteSource;

  @ApiPropertyOptional({ example: 'Mme. Analyste' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  evaluatorName?: string;

  @ApiPropertyOptional({ example: 91.5, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  scoreConfiance?: number;
}
