// AuthService retourne `TokenPair` (interface TS, voir auth.service.ts) --
// une interface s'efface à l'exécution, donc même avec le plugin CLI
// @nestjs/swagger actif (voir nest-cli.json), Swagger ne peut PAS en
// déduire de schéma : il lui faut une classe. Ce DTO n'est utilisé QUE
// comme annotation de type de retour sur AuthController (login/refresh) --
// structurellement identique à TokenPair, aucune conversion nécessaire.
export class TokenPairDto {
  accessToken!: string;
  refreshToken!: string;
}
