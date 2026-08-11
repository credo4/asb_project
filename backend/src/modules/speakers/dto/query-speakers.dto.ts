import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { FeeTierPublic, SpeakerStatus } from '@prisma/client';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export enum SpeakerSortBy {
  NAME = 'name',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class QuerySpeakersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pillarId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  themeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  countryId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  languageId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  formatId?: number;

  @IsOptional()
  @IsEnum(FeeTierPublic)
  feeTierPublic?: FeeTierPublic;

  @IsOptional()
  @IsEnum(SpeakerStatus)
  status?: SpeakerStatus;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isFeaturedHome?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isTopRequested?: boolean;

  @IsOptional()
  @IsIn(Object.values(SpeakerSortBy))
  sortBy?: SpeakerSortBy = SpeakerSortBy.UPDATED_AT;

  @IsOptional()
  @IsIn(Object.values(SortOrder))
  sortOrder?: SortOrder = SortOrder.DESC;
}
