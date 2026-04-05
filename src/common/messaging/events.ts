/**
 * Patterns d'événements RabbitMQ publiés par le Evaluation Service.
 * Consommés par : Audit Service, Notification Service, Attribution Service.
 */
export const EVALUATION_EVENTS = {
  CREATED: 'evaluation.created',
  UPDATED: 'evaluation.updated',
  STATUS_CHANGED: 'evaluation.status_changed',
  CRITERION_CREATED: 'evaluation.criterion.created',
  CRITERION_UPDATED: 'evaluation.criterion.updated',
  CRITERION_REMOVED: 'evaluation.criterion.removed',
  SUBMISSION_REGISTERED: 'evaluation.submission.registered',
  SUBMISSION_UPDATED: 'evaluation.submission.updated',
  SUBMISSION_REMOVED: 'evaluation.submission.removed',
  NOTE_RECORDED: 'evaluation.note.recorded',
  SCORES_CALCULATED: 'evaluation.scores.calculated',
  RANKING_FINALIZED: 'evaluation.ranking.finalized',
  REPORT_GENERATED: 'evaluation.report.generated',
} as const;

export const EvaluationEvents = EVALUATION_EVENTS;
