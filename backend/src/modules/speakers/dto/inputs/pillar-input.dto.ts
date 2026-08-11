import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class PillarInputDto {
  @IsInt()
  pillarId!: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
