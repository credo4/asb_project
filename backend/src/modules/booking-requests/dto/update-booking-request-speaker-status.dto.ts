import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { BookingRequestSpeakerStatus } from '@prisma/client';

export class UpdateBookingRequestSpeakerStatusDto {
  @ApiProperty({ enum: BookingRequestSpeakerStatus })
  @IsEnum(BookingRequestSpeakerStatus)
  status!: BookingRequestSpeakerStatus;
}
