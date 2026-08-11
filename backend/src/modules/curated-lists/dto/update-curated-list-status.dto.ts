import { IsEnum } from 'class-validator';
import { CuratedListStatus } from '@prisma/client';

// Workflow à seulement 2 états (DRAFT <-> PUBLISHED, dans les deux sens) —
// pas de matrice dédiée comme BookingStatus/ApplicationStatus : la
// validation directe (DRAFT -> PUBLISHED ou PUBLISHED -> DRAFT, jamais un
// no-op silencieux inutile) est faite dans CuratedListsService#updateStatus.
export class UpdateCuratedListStatusDto {
  @IsEnum(CuratedListStatus)
  status!: CuratedListStatus;
}
