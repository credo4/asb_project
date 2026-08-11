import {
  Equals,
  IsBoolean,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { PASSWORD_MIN_LENGTH } from '../roster-application.constants';

// POST /auth/accept-invitation (public — voir InvitationAcceptController).
// Valide le token, exige un mot de passe conforme à la politique existante,
// enregistre l'acceptation des conditions de collaboration. `acceptedTerms`
// doit être explicitement `true` — même pattern que
// CreateRosterApplicationDto.gdprConsent : sans lui, la définition du mot de
// passe échoue (§4.4).
export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  })
  password!: string;

  @IsBoolean()
  @Equals(true, {
    message: "L'acceptation des conditions de collaboration est requise.",
  })
  acceptedTerms!: boolean;
}
