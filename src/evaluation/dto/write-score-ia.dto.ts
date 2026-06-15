import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class WriteScoreIaDto {
  @ApiPropertyOptional({ description: 'Score technique IA (0-100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  scoreTechnique?: number;

  @ApiPropertyOptional({ description: 'Score financier IA (0-100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  scoreFinancier?: number;

  @ApiProperty({ description: 'Score global IA (0-100)', minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  scoreGlobal: number;

  @ApiPropertyOptional({ description: 'Classement IA proposé', minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  ranking?: number;

  @ApiPropertyOptional({ description: 'Recommandation IA (RETENIR | ANALYSER_PLUS | ELIMINER)' })
  @IsOptional()
  @IsString()
  recommendation?: string;

  @ApiPropertyOptional({ description: 'Score de confiance du modèle (0-1)', minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confianceScore?: number;
}
