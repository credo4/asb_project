import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Même helper que QuerySpeakersDto (isFeaturedHome/isTopRequested) : un
// query param booléen arrive toujours en string ("true"/"false"), et
// `@Type(() => Boolean)` de class-transformer convertirait n'importe quelle
// chaîne non vide (y compris "false") en `true` — piège classique.
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export class QueryAvailableSpeakersDto {
  @Matches(DATE_ONLY_PATTERN, {
    message: 'from doit être au format YYYY-MM-DD.',
  })
  from!: string;

  @Matches(DATE_ONLY_PATTERN, { message: 'to doit être au format YYYY-MM-DD.' })
  to!: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string; // ISO2

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isVirtual?: boolean;
}
