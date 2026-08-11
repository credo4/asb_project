import { AvailabilityPeriodDto } from './availability-period.dto';
import { TravelPreferencesDto } from './travel-preferences.dto';

// Réponse combinée de GET .../availability : périodes + préférences. Ni
// l'une ni l'autre ne passent par le workflow de révision (speaker_revisions,
// Phase 2a) — voir CLAUDE.md : donnée interne, effective immédiatement,
// jamais soumise à validation admin. Toujours l'état LIVE.
export class SpeakerAvailabilityDto {
  periods!: AvailabilityPeriodDto[];
  // null si le speaker n'a jamais renseigné ses préférences (les valeurs par
  // défaut implicites — WORLDWIDE, virtuel oui, préavis 0 jour — s'appliquent
  // alors côté checkAvailability, mais ne sont PAS matérialisées ici tant que
  // le speaker n'a rien soumis).
  preferences!: TravelPreferencesDto | null;
}
