// Valeurs EFFECTIVES (§A4) : jamais null, le fallback (valeur en base ->
// .env/constante existante -> valeur de repli codée en dur) est déjà
// appliqué par AppSettingsService#getEffectiveSettings — un SUPER_ADMIN qui
// ouvre l'écran "Général" voit toujours ce qui est réellement en vigueur,
// jamais un champ vide sans savoir ce qui s'applique par défaut.
export class AppSettingsDto {
  agencyName!: string;
  teamEmail!: string | null;
  responseSlaBusinessDays!: number;
  defaultCurrency!: string;
  collaborationTermsVersion!: string;
  updatedAt!: Date | null;
  updatedBy!: { id: number; email: string } | null;
}
