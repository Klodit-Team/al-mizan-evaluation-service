import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  GatewayUser,
} from '../common/decorators/current-user.decorator';
import { GatewayGuard } from '../common/guards/gateway.guard';
import { ChangeEvaluationStatusDto } from './dto/change-evaluation-status.dto';
import { CreateCriterionDto } from './dto/create-criterion.dto';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { FindEvaluationsQueryDto } from './dto/find-evaluations-query.dto';
import { RegisterSubmissionDto } from './dto/register-submission.dto';
import { UpdateCriterionDto } from './dto/update-criterion.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { UpsertNoteDto } from './dto/upsert-note.dto';
import { EvaluationService } from './evaluation.service';
import { Evaluation } from './entities/evaluation.entity';
import { EvaluationCriterion } from './entities/evaluation-criterion.entity';
import { EvaluationSubmission } from './entities/evaluation-submission.entity';
import { EvaluationNote } from './entities/evaluation-note.entity';
import { EvaluationReport } from './entities/evaluation-report.entity';

@ApiTags('evaluations')
@ApiHeader({
  name: 'x-user-id',
  required: true,
  description: "ID utilisateur injecté par l'API Gateway",
})
@ApiHeader({
  name: 'x-user-roles',
  required: false,
  description: 'Rôles utilisateur injectés par la Gateway',
})
@UseGuards(GatewayGuard)
@Controller('api/v1/evaluations')
export class EvaluationController {
  constructor(private readonly service: EvaluationService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les évaluations avec filtres et pagination',
  })
  findAll(@Query() query: FindEvaluationsQueryDto) {
    return this.service.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une nouvelle évaluation' })
  @ApiResponse({ status: 201, description: 'Évaluation créée avec succès', type: Evaluation })
  create(@Body() dto: CreateEvaluationDto, @CurrentUser() user: GatewayUser): Promise<any> {
    return this.service.create(dto, user?.id);
  }

  @Get(':id')
  @ApiOperation({ summary: "Obtenir le détail d'une évaluation" })
  @ApiParam({ name: 'id', description: "UUID de l'évaluation" })
  @ApiQuery({
    name: 'revealIdentity',
    required: false,
    type: Boolean,
    description:
      'Révéler les identités si la politique de confidentialité le permet',
  })
  @ApiResponse({ status: 200, type: Evaluation })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('revealIdentity') revealIdentity?: string,
  ): Promise<any> {
    return this.service.findOne(id, revealIdentity === 'true');
  }

  @Put(':id')
  @ApiOperation({ summary: 'Mettre à jour une évaluation' })
  @ApiResponse({ status: 200, type: Evaluation })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEvaluationDto,
  ): Promise<any> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une évaluation en brouillon ou annulée' })
  @ApiResponse({ status: 204 })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }

  @Patch(':id/statut')
  @ApiOperation({ summary: "Changer le statut d'une évaluation" })
  @ApiResponse({ status: 200, type: Evaluation })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeEvaluationStatusDto,
    @CurrentUser() user: GatewayUser,
  ): Promise<any> {
    return this.service.changeStatus(id, dto, user?.id);
  }

  @Get(':id/criteres')
  @ApiOperation({ summary: "Lister les critères d'une évaluation" })
  @ApiResponse({ status: 200, type: [EvaluationCriterion] })
  findCriteria(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    return this.service.findCriteria(id);
  }

  @Post(':id/criteres')
  @ApiOperation({ summary: 'Ajouter un critère à une évaluation' })
  @ApiResponse({ status: 201, type: EvaluationCriterion })
  addCriterion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCriterionDto,
  ): Promise<any> {
    return this.service.addCriterion(id, dto);
  }

  @Put(':id/criteres/:criterionId')
  @ApiOperation({ summary: "Mettre à jour un critère d'évaluation" })
  @ApiResponse({ status: 200, type: EvaluationCriterion })
  updateCriterion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('criterionId', ParseUUIDPipe) criterionId: string,
    @Body() dto: UpdateCriterionDto,
  ): Promise<any> {
    return this.service.updateCriterion(id, criterionId, dto);
  }

  @Delete(':id/criteres/:criterionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Supprimer un critère d'évaluation" })
  @ApiResponse({ status: 204 })
  removeCriterion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('criterionId', ParseUUIDPipe) criterionId: string,
  ): Promise<void> {
    return this.service.removeCriterion(id, criterionId);
  }

  @Get(':id/soumissions')
  @ApiOperation({
    summary: 'Lister les soumissions rattachées à une évaluation',
  })
  @ApiQuery({
    name: 'revealIdentity',
    required: false,
    type: Boolean,
    description:
      'Révéler les identités si la politique de confidentialité le permet',
  })
  @ApiResponse({ status: 200, type: [EvaluationSubmission] })
  listSubmissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('revealIdentity') revealIdentity?: string,
  ): Promise<any> {
    return this.service.listSubmissions(id, revealIdentity === 'true');
  }

  @Post(':id/soumissions')
  @ApiOperation({ summary: "Enregistrer une soumission dans l'évaluation" })
  @ApiResponse({ status: 201, type: EvaluationSubmission })
  registerSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterSubmissionDto,
  ): Promise<any> {
    return this.service.registerSubmission(id, dto);
  }

  @Put(':id/soumissions/:submissionId')
  @ApiOperation({ summary: "Mettre à jour les métadonnées d'une soumission" })
  @ApiResponse({ status: 200, type: EvaluationSubmission })
  updateSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: UpdateSubmissionDto,
    @Query('revealIdentity') revealIdentity?: string,
  ): Promise<any> {
    return this.service.updateSubmission(
      id,
      submissionId,
      dto,
      revealIdentity === 'true',
    );
  }

  @Delete(':id/soumissions/:submissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Retirer une soumission de l'évaluation" })
  @ApiResponse({ status: 204 })
  removeSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ): Promise<void> {
    return this.service.removeSubmission(id, submissionId);
  }

  @Get(':id/soumissions/:submissionId/notes')
  @ApiOperation({ summary: 'Lister les notes attribuées à une soumission' })
  @ApiResponse({ status: 200, type: [EvaluationNote] })
  listNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ): Promise<any> {
    return this.service.listNotes(id, submissionId);
  }

  @Post(':id/soumissions/:submissionId/notes')
  @ApiOperation({
    summary: "Créer ou mettre à jour la note d'un évaluateur pour un critère",
  })
  @ApiResponse({ status: 201, type: EvaluationNote })
  upsertNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: UpsertNoteDto,
    @CurrentUser() user: GatewayUser,
  ): Promise<any> {
    return this.service.upsertNote(id, submissionId, dto, user.id);
  }

  @Post(':id/recalculer-scores')
  @ApiOperation({
    summary: 'Calculer les scores, le classement et les recommandations',
  })
  @ApiResponse({ status: 201, type: [EvaluationSubmission] })
  recalculateScores(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    return this.service.recalculateScores(id);
  }

  @Get(':id/classement')
  @ApiOperation({ summary: "Consulter le classement courant d'une évaluation" })
  @ApiQuery({
    name: 'revealIdentity',
    required: false,
    type: Boolean,
    description:
      'Révéler les identités si la politique de confidentialité le permet',
  })
  @ApiResponse({ status: 200, type: [EvaluationSubmission] })
  getRanking(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('revealIdentity') revealIdentity?: string,
  ): Promise<any> {
    return this.service.getRanking(id, revealIdentity === 'true');
  }

  @Post(':id/rapport')
  @ApiOperation({
    summary: "Générer et archiver le rapport final d'évaluation",
  })
  @ApiResponse({ status: 201, type: EvaluationReport })
  generateReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: GatewayUser,
  ): Promise<any> {
    return this.service.generateReport(id, user?.id);
  }

  @Get(':id/rapport')
  @ApiOperation({
    summary: "Consulter le dernier rapport généré d'une évaluation",
  })
  @ApiResponse({ status: 200, type: EvaluationReport })
  getLatestReport(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    return this.service.getLatestReport(id);
  }
}