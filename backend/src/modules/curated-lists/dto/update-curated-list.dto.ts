// `@nestjs/swagger` réexporte le même PartialType que `@nestjs/mapped-types`
// (même comportement de validation) MAIS propage aussi les métadonnées
// Swagger héritées de CreateCuratedListDto -- `@nestjs/mapped-types` ne le
// fait pas, ce qui faisait ressortir ce DTO totalement vide dans le schéma
// OpenAPI généré pour le back-office (voir CLAUDE.md, plugin CLI swagger).
import { PartialType } from '@nestjs/swagger';
import { CreateCuratedListDto } from './create-curated-list.dto';

// PATCH partiel — mêmes règles de validation que la création, tout optionnel.
// `status` n'y figure PAS : géré par son propre endpoint dédié
// (PATCH .../status), même séparation que BookingRequest/RosterApplication.
export class UpdateCuratedListDto extends PartialType(CreateCuratedListDto) {}
