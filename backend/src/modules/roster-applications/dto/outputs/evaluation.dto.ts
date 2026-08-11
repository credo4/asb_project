import { AdminRefDto } from './reference.dto';

// Strictement interne (CLAUDE.md §5) : ce DTO ne doit JAMAIS transiter par
// une réponse accessible au candidat ou à un rôle SPEAKER — seuls les
// endpoints admin de ce module l'exposent (voir roster-applications.controller.ts
// et roster-application-evaluations.controller.ts, tous deux @Roles(ADMIN, SUPER_ADMIN)).
export class RosterApplicationEvaluationDto {
  id!: number;
  evaluator!: AdminRefDto | null;

  expertiseLevel!: number;
  professionalCredibility!: number;
  stageExperience!: number;
  speakingQuality!: number;
  internationalRelevance!: number;
  languageProficiency!: number;
  mediaQuality!: number;
  pillarFit!: number;
  commercialPotential!: number;

  comment!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}
