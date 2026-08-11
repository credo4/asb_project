import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

// §7 — retirer un speaker devenu SPEAKER_UNAVAILABLE et le remplacer par un
// autre, en UNE action atomique (voir BookingRequestSpeakersService#replace).
export class ReplaceBookingRequestSpeakerDto {
  @ApiProperty()
  @IsInt()
  replacementSpeakerId!: number;
}
