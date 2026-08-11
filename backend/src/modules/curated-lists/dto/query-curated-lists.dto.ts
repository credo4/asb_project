import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CuratedListStatus } from '@prisma/client';

export class QueryCuratedListsDto {
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
  @IsEnum(CuratedListStatus)
  status?: CuratedListStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
