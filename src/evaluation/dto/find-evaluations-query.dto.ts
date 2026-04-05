import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { EvaluationType } from '../enums/evaluation-type.enum';

export class FindEvaluationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EvaluationType })
  @IsOptional()
  @IsEnum(EvaluationType)
  type?: EvaluationType;

  @ApiPropertyOptional({ example: 'ao-2026-001' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  appelOffreId?: string;

  @ApiPropertyOptional({ example: 'commission-cope-001' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  commissionId?: string;
}
