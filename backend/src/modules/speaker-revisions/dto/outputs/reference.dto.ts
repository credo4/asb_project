export class SpeakerRefDto {
  id!: number;
  displayName!: string;
  slug!: string | null;
}

export class AdminRefDto {
  id!: number;
  email!: string;
  firstName!: string | null;
  lastName!: string | null;
}
