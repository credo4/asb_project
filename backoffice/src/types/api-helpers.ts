// Petits utilitaires de type au-dessus de `api.ts` (généré, voir le script
// npm `types:generate`) : `paths`/`components` bruts sont verbeux à indexer
// à chaque appel — ces alias extraient le corps de requête / de réponse
// d'un endpoint donné, en réutilisant TypeScript pour ne jamais dupliquer
// une forme déjà décrite par l'API.
//
// Concept TS : les types conditionnels (`A extends B ? X : Y`) et les types
// mappés indexés (`{ [K in ...]: ... }[...]`) permettent de "creuser" dans
// une structure générée sans la récrire à la main — si l'API change, ces
// alias suivent automatiquement au prochain `types:generate`.
import type { paths } from './api';

type SuccessCode = 200 | 201 | 204;

/** Corps JSON de la réponse de succès (200/201/204) d'un endpoint donné. */
export type ApiResponse<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends { responses: infer R }
  ? {
      [K in Extract<keyof R, SuccessCode>]: R[K] extends {
        content: { 'application/json': infer Body };
      }
        ? Body
        : never;
    }[Extract<keyof R, SuccessCode>]
  : never;

/** Corps JSON attendu en entrée (requestBody) d'un endpoint donné. */
export type ApiRequestBody<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends {
  requestBody: { content: { 'application/json': infer Body } };
}
  ? Body
  : never;
