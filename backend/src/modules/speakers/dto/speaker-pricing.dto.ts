// DTO de sortie DÉDIÉ aux tarifs — volontairement distinct de SpeakerDetailDto
// (property `pricing` typée explicitement) pour qu'il soit impossible de le
// mélanger par erreur avec une projection destinée à sortir de ce module
// (ex: la future API publique n'aura simplement jamais connaissance de cette
// classe). Les montants Decimal de Prisma sont convertis en string pour
// éviter toute perte de précision en JSON.
export class SpeakerPricingDto {
  currency!: string;
  minFee!: string | null;
  recommendedFee!: string | null;
  feeKeynote!: string | null;
  feePanel!: string | null;
  feeWebinar!: string | null;
  feeMasterclass!: string | null;
  feeAdvisory!: string | null;
  feeOneToOne!: string | null;
  travelFees!: string | null;
  negotiationTerms!: string | null;
  agencyCommission!: string | null;
  internalNotes!: string | null;
  updatedAt!: Date;
}
