import { ApiProperty } from '@nestjs/swagger';

// Accusé minimal renvoyé par POST /public/roster-applications — jamais
// l'enregistrement complet (cf. CLAUDE.md §5).
export class RosterApplicationAckDto {
  @ApiProperty({ example: 'APP-2026-000045' })
  reference!: string;

  @ApiProperty({
    example:
      'Merci pour votre candidature. Notre équipe reviendra vers vous prochainement.',
  })
  message!: string;
}
