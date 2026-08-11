import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Commentaire OBLIGATOIRE (cf. §5) : le speaker doit savoir précisément quoi
// corriger.
export class RequestChangesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  reviewerComment!: string;
}
