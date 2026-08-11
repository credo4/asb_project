import { SetMetadata } from '@nestjs/common';

// `SetMetadata` attache une donnée arbitraire (ici `isPublic: true`) sur le
// handler/la classe ciblée. `JwtAuthGuard` la relit via `Reflector` pour
// savoir s'il doit laisser passer la requête sans exiger de token.
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
