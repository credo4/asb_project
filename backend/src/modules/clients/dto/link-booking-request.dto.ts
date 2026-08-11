import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';

// Au moins un des 4 champs doit être fourni (vérifié dans le service, pas
// ici : c'est une règle "au moins un parmi", pas une contrainte par champ —
// voir ClientLinkingService#linkBookingRequest).
//
// - contactId / organizationId : rattache à une fiche EXISTANTE.
// - createContactFromIntake / createOrganizationFromIntake : « convertir en
//   fiche client » — crée une nouvelle fiche à partir des données d'intake
//   de la demande (fullName/workEmail/phone/organization), SANS jamais
//   modifier ces champs d'origine (voir CLAUDE.md).
export class LinkBookingRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  contactId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  organizationId?: number;

  @IsOptional()
  @IsBoolean()
  createContactFromIntake?: boolean;

  @IsOptional()
  @IsBoolean()
  createOrganizationFromIntake?: boolean;
}
