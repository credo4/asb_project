// `@nestjs/swagger` réexporte le même PartialType que `@nestjs/mapped-types`
// (même comportement de validation) MAIS propage aussi les métadonnées
// Swagger héritées de CreateSpeakerDto -- `@nestjs/mapped-types` ne le fait
// pas, ce qui faisait ressortir ce DTO totalement vide dans le schéma
// OpenAPI généré pour le back-office (voir CLAUDE.md, plugin CLI swagger).
import { PartialType } from '@nestjs/swagger';
import { CreateSpeakerDto } from './create-speaker.dto';

// Tous les champs deviennent optionnels. Sémantique PATCH : un champ absent
// du payload n'est pas touché ; pour les relations (pillars, languages...),
// une clé absente laisse les associations existantes inchangées, alors
// qu'un tableau vide [] les remplace par "aucune" (voir SpeakersService).
export class UpdateSpeakerDto extends PartialType(CreateSpeakerDto) {}
