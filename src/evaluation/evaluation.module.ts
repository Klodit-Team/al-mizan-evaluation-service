import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvaluationController } from './evaluation.controller';
import { EvaluationService } from './evaluation.service';
import { EvaluationCriterion } from './entities/evaluation-criterion.entity';
import { EvaluationNote } from './entities/evaluation-note.entity';
import { EvaluationReport } from './entities/evaluation-report.entity';
import { EvaluationResult } from './entities/evaluation-result.entity';
import { EvaluationSubmission } from './entities/evaluation-submission.entity';
import { Evaluation } from './entities/evaluation.entity';
import { RabbitMQModule } from '../common/messaging/rabbitmq.module';
import { MinioService } from '../common/services/minio.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Evaluation,
      EvaluationCriterion,
      EvaluationSubmission,
      EvaluationNote,
      EvaluationResult,
      EvaluationReport,
    ]),
    RabbitMQModule,
  ],
  controllers: [EvaluationController],
  providers: [EvaluationService, MinioService],
  exports: [EvaluationService],
})
export class EvaluationModule {}
