export class AdminRefDto {
  id!: number;
  email!: string;
  firstName!: string | null;
  lastName!: string | null;
}

export class ConvertedSpeakerRefDto {
  id!: number;
  displayName!: string;
  slug!: string | null;
}

// Volontairement minimal (pas de firstName/lastName — le compte vient
// juste d'être créé, sans profil rempli) : sert surtout à confirmer "oui,
// cette candidature a bien un compte" et donner l'email pour l'admin.
export class ConvertedUserRefDto {
  id!: number;
  email!: string;
  status!: string;
}
