import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { PASSWORD_MIN_LENGTH } from '../../roster-applications/roster-application.constants';

// POST /auth/me/change-password — exige le mot de passe ACTUEL (§A2) :
// jamais suffisant de tenir un access token valide (vol de session/poste
// laissé déverrouillé) pour changer le mot de passe. Même politique que le
// reste du projet (PASSWORD_MIN_LENGTH, module roster-applications —
// import cross-module délibéré plutôt qu'une constante dupliquée, voir
// AcceptInvitationDto qui fait déjà de même).
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  })
  newPassword!: string;
}
