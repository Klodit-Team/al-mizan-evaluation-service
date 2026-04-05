import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCriterionDto {
  @ApiProperty({ example: 'TECH-01' })
  @IsString()
  @MaxLength(64)
  code: string;

  @ApiProperty({ example: 'Méthodologie proposée' })
  @IsString()
  @MaxLength(160)
  libelle: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ minimum: 0.01, maximum: 100, example: 30 })
  @IsNumber()
  @Min(0.01)
  @Max(100)
  poids: number;

  @ApiPropertyOptional({ default: 100, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  noteMax?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  noteMinimale?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  eliminatoire?: boolean;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  ordre?: number;
}
