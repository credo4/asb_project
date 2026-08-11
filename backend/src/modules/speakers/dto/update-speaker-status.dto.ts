import { IsEnum } from 'class-validator';
import { SpeakerStatus } from '@prisma/client';

export class UpdateSpeakerStatusDto {
  @IsEnum(SpeakerStatus)
  status!: SpeakerStatus;
}
