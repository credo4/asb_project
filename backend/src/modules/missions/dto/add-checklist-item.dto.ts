import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

// §4 — "l'admin peut ajouter un point propre à une mission" : pas de
// `code` en entrée (réservé aux points du modèle standard, voir
// mission-checklist.constants.ts) — un code dérivé du label suffit, pas
// besoin d'exposer cette mécanique à l'appelant.
export class AddChecklistItemDto {
  @ApiProperty()
  @IsString()
  @MaxLength(250)
  label!: string;
}
