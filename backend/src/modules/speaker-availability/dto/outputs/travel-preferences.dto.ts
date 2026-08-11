import { TravelScope } from '@prisma/client';
import { CountryRefDto } from '../../../speakers/dto/outputs/reference.dto';

export class TravelPreferencesDto {
  travelScope!: TravelScope;
  // Toujours [] quand travelScope != SELECTED_COUNTRIES (voir le service).
  countries!: CountryRefDto[];
  availableForVirtual!: boolean;
  minimumNoticeDays!: number;
  notes!: string | null;
  updatedAt!: Date;
}
