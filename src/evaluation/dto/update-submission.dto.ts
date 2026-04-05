import { PartialType } from '@nestjs/swagger';
import { RegisterSubmissionDto } from './register-submission.dto';

export class UpdateSubmissionDto extends PartialType(RegisterSubmissionDto) {}
