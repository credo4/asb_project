// DTO de sortie dédié pour POST /admin/users (§A1) — UsersService#invite()
// renvoie un type inféré (pas une classe), invisible pour le plugin CLI
// Swagger sans ce doublon explicite sur le CONTROLLER (même gotcha déjà
// rencontré pour TokenPairDto, voir CLAUDE.md §2b).
export class InviteUserResultDto {
  id!: number;
  email!: string;
  // Reflète le résultat RÉEL de la tentative d'envoi (voir MailService#sendAndLog) --
  // jamais annoncée "envoyée" si l'email a échoué, même pattern que la
  // conversion de candidature (Phase 3c).
  invitationSent!: boolean;
}
