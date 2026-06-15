import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class WriteComparisonDto {
  @ApiProperty({ description: 'Écart entre score IA et score commission (points)', minimum: 0 })
  @IsNumber()
  @Min(0)
  divergenceScore: number;

  @ApiPropertyOptional({ description: 'Caractérisation de la divergence (ex: MAJEURE, MINEURE, NULLE)' })
  @IsOptional()
  @IsString()
  characterization?: string;

  @ApiPropertyOptional({ description: 'Détails textuels de la comparaison' })
  @IsOptional()
  @IsString()
  details?: string;
}
