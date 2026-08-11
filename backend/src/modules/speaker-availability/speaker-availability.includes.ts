import { Prisma } from '@prisma/client';

export const TRAVEL_PREFERENCE_INCLUDE = {
  countries: {
    include: { country: { select: { id: true, name: true, iso2: true } } },
  },
} satisfies Prisma.SpeakerTravelPreferenceInclude;

export type TravelPreferenceRow = Prisma.SpeakerTravelPreferenceGetPayload<{
  include: typeof TRAVEL_PREFERENCE_INCLUDE;
}>;

// Projection minimale utilisée par evaluate-availability.util.ts (recherche
// admin en masse ET checkAvailability) : seuls les champs qui entrent dans
// le calcul, pas la forme complète destinée aux DTO de sortie.
export const TRAVEL_PREFERENCE_EVAL_SELECT = {
  travelScope: true,
  availableForVirtual: true,
  minimumNoticeDays: true,
  countries: { select: { country: { select: { iso2: true } } } },
} satisfies Prisma.SpeakerTravelPreferenceSelect;

export type TravelPreferenceEvalRow = Prisma.SpeakerTravelPreferenceGetPayload<{
  select: typeof TRAVEL_PREFERENCE_EVAL_SELECT;
}>;
