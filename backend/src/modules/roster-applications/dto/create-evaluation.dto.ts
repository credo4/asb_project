import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// PUT /admin/roster-applications/:applicationId/evaluations/me — upsert de
// l'évaluation de L'ÉVALUATEUR COURANT (dérivé de actor.id, jamais fourni
// par l'appelant — même principe de non-contournement que
// SpeakerRevisionsService#getOwnSpeakerOrThrow). Les 9 critères du §5.3 du
// cahier des charges, notés de 1 à 5.
export class CreateEvaluationDto {
  @IsInt()
  @Min(1)
  @Max(5)
  expertiseLevel!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  professionalCredibility!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  stageExperience!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  speakingQuality!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  internationalRelevance!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  languageProficiency!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  mediaQuality!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  pillarFit!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  commercialPotential!: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string;
}
