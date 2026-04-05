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
  @ApiResponse({ status: 201, description: 'Évaluation créée avec succès' })
  create(@Body() dto: CreateEvaluationDto, @CurrentUser() user: GatewayUser) {
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
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('revealIdentity') revealIdentity?: string,
  ) {
    return this.service.findOne(id, revealIdentity === 'true');
  }

  @Put(':id')
  @ApiOperation({ summary: 'Mettre à jour une évaluation' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEvaluationDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une évaluation en brouillon ou annulée' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/statut')
  @ApiOperation({ summary: "Changer le statut d'une évaluation" })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeEvaluationStatusDto,
    @CurrentUser() user: GatewayUser,
  ) {
    return this.service.changeStatus(id, dto, user?.id);
  }

  @Get(':id/criteres')
  @ApiOperation({ summary: "Lister les critères d'une évaluation" })
  findCriteria(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findCriteria(id);
  }

  @Post(':id/criteres')
  @ApiOperation({ summary: 'Ajouter un critère à une évaluation' })
  addCriterion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCriterionDto,
  ) {
    return this.service.addCriterion(id, dto);
  }

  @Put(':id/criteres/:criterionId')
  @ApiOperation({ summary: "Mettre à jour un critère d'évaluation" })
  updateCriterion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('criterionId', ParseUUIDPipe) criterionId: string,
    @Body() dto: UpdateCriterionDto,
  ) {
    return this.service.updateCriterion(id, criterionId, dto);
  }

  @Delete(':id/criteres/:criterionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Supprimer un critère d'évaluation" })
  removeCriterion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('criterionId', ParseUUIDPipe) criterionId: string,
  ) {
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
  listSubmissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('revealIdentity') revealIdentity?: string,
  ) {
    return this.service.listSubmissions(id, revealIdentity === 'true');
  }

  @Post(':id/soumissions')
  @ApiOperation({ summary: "Enregistrer une soumission dans l'évaluation" })
  registerSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterSubmissionDto,
  ) {
    return this.service.registerSubmission(id, dto);
  }

  @Put(':id/soumissions/:submissionId')
  @ApiOperation({ summary: "Mettre à jour les métadonnées d'une soumission" })
  updateSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: UpdateSubmissionDto,
    @Query('revealIdentity') revealIdentity?: string,
  ) {
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
  removeSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ) {
    return this.service.removeSubmission(id, submissionId);
  }

  @Get(':id/soumissions/:submissionId/notes')
  @ApiOperation({ summary: 'Lister les notes attribuées à une soumission' })
  listNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ) {
    return this.service.listNotes(id, submissionId);
  }

  @Post(':id/soumissions/:submissionId/notes')
  @ApiOperation({
    summary: "Créer ou mettre à jour la note d'un évaluateur pour un critère",
  })
  upsertNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: UpsertNoteDto,
    @CurrentUser() user: GatewayUser,
  ) {
    return this.service.upsertNote(id, submissionId, dto, user.id);
  }

  @Post(':id/recalculer-scores')
  @ApiOperation({
    summary: 'Calculer les scores, le classement et les recommandations',
  })
  recalculateScores(@Param('id', ParseUUIDPipe) id: string) {
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
  getRanking(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('revealIdentity') revealIdentity?: string,
  ) {
    return this.service.getRanking(id, revealIdentity === 'true');
  }

  @Post(':id/rapport')
  @ApiOperation({
    summary: "Générer et archiver le rapport final d'évaluation",
  })
  generateReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: GatewayUser,
  ) {
    return this.service.generateReport(id, user?.id);
  }

  @Get(':id/rapport')
  @ApiOperation({
    summary: "Consulter le dernier rapport généré d'une évaluation",
  })
  getLatestReport(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getLatestReport(id);
  }
}
