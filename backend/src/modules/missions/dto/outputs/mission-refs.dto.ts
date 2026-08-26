import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MissionSpeakerRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional({ nullable: true })
  slug!: string | null;

  @ApiPropertyOptional({ nullable: true })
  profilePhotoUrl!: string | null;
}

export class MissionBookingRequestRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  reference!: string;

  @ApiPropertyOptional({ nullable: true })
  eventName!: string | null;
}

export class MissionOrganizationRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;
}
