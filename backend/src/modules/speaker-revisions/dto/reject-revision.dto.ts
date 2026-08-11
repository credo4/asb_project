import { IsOptional, IsString, MaxLength } from 'class-validator';

// Motif recommandé mais non strictement obligatoire (contrairement à
// RequestChangesDto) — cf. §5 : "refus avec motif", formulation différente
// de "commentaire obligatoire" pour request-changes.
export class RejectRevisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reviewerComment?: string;
}
