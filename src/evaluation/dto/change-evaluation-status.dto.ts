import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EvaluationStatus } from '../enums/evaluation-status.enum';

export class ChangeEvaluationStatusDto {
  @ApiProperty({ enum: EvaluationStatus })
  @IsEnum(EvaluationStatus)
  statut: EvaluationStatus;
}
