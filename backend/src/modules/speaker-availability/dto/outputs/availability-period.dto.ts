import { AvailabilityPeriodType } from '@prisma/client';

export class AvailabilityPeriodDto {
  id!: number;
  type!: AvailabilityPeriodType;
  startDate!: Date;
  endDate!: Date;
  reason!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
