import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class PricingInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsNumber()
  minFee?: number;

  @IsOptional()
  @IsNumber()
  recommendedFee?: number;

  @IsOptional()
  @IsNumber()
  feeKeynote?: number;

  @IsOptional()
  @IsNumber()
  feePanel?: number;

  @IsOptional()
  @IsNumber()
  feeWebinar?: number;

  @IsOptional()
  @IsNumber()
  feeMasterclass?: number;

  @IsOptional()
  @IsNumber()
  feeAdvisory?: number;

  @IsOptional()
  @IsNumber()
  feeOneToOne?: number;

  @IsOptional()
  @IsString()
  travelFees?: string;

  @IsOptional()
  @IsString()
  negotiationTerms?: string;

  @IsOptional()
  @IsNumber()
  agencyCommission?: number;

  @IsOptional()
  @IsString()
  internalNotes?: string;
}
