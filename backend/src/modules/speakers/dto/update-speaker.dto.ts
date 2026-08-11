import { PartialType } from '@nestjs/mapped-types';
import { CreateSpeakerDto } from './create-speaker.dto';

// Tous les champs deviennent optionnels. Sémantique PATCH : un champ absent
// du payload n'est pas touché ; pour les relations (pillars, languages...),
// une clé absente laisse les associations existantes inchangées, alors
// qu'un tableau vide [] les remplace par "aucune" (voir SpeakersService).
export class UpdateSpeakerDto extends PartialType(CreateSpeakerDto) {}
