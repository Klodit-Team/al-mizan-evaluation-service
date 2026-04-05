import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class RegisterSubmissionDto {
  @ApiProperty({ example: 'submission-2026-001' })
  @IsString()
  @MaxLength(128)
  externalSubmissionId: string;

  @ApiPropertyOptional({ example: 'oe-2026-001' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  operateurEconomiqueId?: string;

  @ApiPropertyOptional({ example: 'SARL Atlas Equipements' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  operateurNom?: string;

  @ApiPropertyOptional({ example: 'lot-01' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  lotId?: string;

  @ApiPropertyOptional({ example: 1520000.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montantOffre?: number;

  @ApiPropertyOptional({ default: 'DZD' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  devise?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
