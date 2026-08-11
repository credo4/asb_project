import { PartialType } from '@nestjs/mapped-types';
import { CreateCuratedListDto } from './create-curated-list.dto';

// PATCH partiel — mêmes règles de validation que la création, tout optionnel.
// `status` n'y figure PAS : géré par son propre endpoint dédié
// (PATCH .../status), même séparation que BookingRequest/RosterApplication.
export class UpdateCuratedListDto extends PartialType(CreateCuratedListDto) {}
